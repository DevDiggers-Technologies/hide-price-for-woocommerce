/**
 * DDFW Turbo: in-place navigation for DevDiggers plugin dashboards.
 *
 * Every visit requests the same URL a full page load would request, so all server side behaviour
 * (routing, screen options, settings API, redirects, nonces, capability checks) is unchanged.
 * Instead of letting the browser rebuild wp-admin, the view area is swapped in place, missing
 * assets are loaded and the plugin's view scripts are re-run. Whenever something can not be
 * reproduced safely, the engine falls back to a normal page load.
 *
 * @package DevDiggers\Framework
 */

import { config, log } from './config';
import * as lifecycle from './lifecycle';
import { applyScript, applyStyles, plan } from './assets';
import { initEditors, loadView, unloadView } from './integrations';
import * as ui from './ui';

const VIEW_SELECTOR      = '.devdiggers-wrap';
const PREFETCH_TTL       = 10000;
const PREFETCH_DELAY     = 65;
const BODY_CLASSES_KEPT  = [ 'js', 'sticky-menu', 'is-docked' ];

const prefetchCache = new Map();
let visitToken      = 0;
let initViewHandler = () => {};
let dirtySnapshot   = new Map();
let userEdited      = false;

/**
 * Hard navigation: the safety net.
 *
 * @param {string} url    URL.
 * @param {string} reason Reason for the debug log.
 */
const hardVisit = ( url, reason ) => {
	log( 'full page load:', reason, url );
	window.location.assign( url );
};

/**
 * Parse a URL relative to the current location.
 *
 * @param {string} href Href.
 * @return {URL|null} URL or null when invalid.
 */
const toUrl = ( href ) => {
	try {
		return new URL( href, window.location.href );
	} catch ( e ) {
		return null;
	}
};

/**
 * Whether a URL is a view of the current dashboard the engine may load in place.
 *
 * @param {URL} url URL.
 * @return {boolean} True when soft navigable.
 */
const isDashboardUrl = ( url ) => (
	!! url &&
	url.origin === window.location.origin &&
	/\/wp-admin\/admin\.php$/.test( url.pathname ) &&
	url.searchParams.get( 'page' ) === config.page &&
	! config.hardParams.some( ( param ) => url.searchParams.has( param ) )
);

/**
 * Whether a GET URL is free of side effects and can be fetched ahead of a click.
 *
 * @param {URL} url URL.
 * @return {boolean} True when prefetchable.
 */
const isPrefetchable = ( url ) => config.prefetch && isDashboardUrl( url ) && ! url.hash && Array.from( url.searchParams.keys() ).every( ( key ) => config.prefetchParams.includes( key ) );

/**
 * Serialize the POST forms of the view, used by the unsaved changes guard.
 *
 * @return {Map<HTMLFormElement, string>} Snapshot.
 */
const snapshotForms = () => {
	const snapshot = new Map();

	document.querySelectorAll( `${ VIEW_SELECTOR } form[method="post" i]` ).forEach( ( form ) => {
		snapshot.set( form, new URLSearchParams( new FormData( form ) ).toString() );
	} );

	return snapshot;
};

/**
 * Whether the user changed a form of the view without saving it.
 *
 * @param {HTMLFormElement|null} submitting Form being submitted (never dirty).
 * @return {boolean} True when there are unsaved changes.
 */
const hasUnsavedChanges = ( submitting = null ) => {
	if ( ! config.dirtyGuard || ! userEdited ) {
		return false;
	}

	return Array.from( dirtySnapshot.entries() ).some( ( [ form, serialized ] ) => (
		form !== submitting && form.isConnected && new URLSearchParams( new FormData( form ) ).toString() !== serialized
	) );
};

/**
 * Fetch a view.
 *
 * @param {string} url     URL.
 * @param {Object} options Fetch options.
 * @return {Promise<{response: Response, html: string|null}>} Result.
 */
const fetchView = async ( url, options = {} ) => {
	const response    = await window.fetch( url, Object.assign( {
		credentials: 'same-origin',
		redirect: 'follow',
		headers: { 'X-DDFW-Turbo': '1', Accept: 'text/html' },
	}, options ) );
	const contentType = response.headers.get( 'content-type' ) || '';
	const disposition = response.headers.get( 'content-disposition' ) || '';
	const isHtml      = -1 !== contentType.indexOf( 'text/html' ) && -1 === disposition.indexOf( 'attachment' );

	return { response, html: isHtml ? await response.text() : null };
};

/**
 * Get a prefetched view, or fetch it.
 *
 * @param {string} url URL.
 * @return {Promise<Object>} Result of fetchView().
 */
const fetchCachedView = ( url ) => {
	const cached = prefetchCache.get( url );

	if ( cached && Date.now() - cached.time < PREFETCH_TTL ) {
		prefetchCache.delete( url );
		log( 'prefetch hit', url );
		return cached.promise;
	}

	return fetchView( url );
};

/**
 * Save a response that is a file download without re-requesting it.
 *
 * @param {Response} response Response.
 * @return {Promise} Resolves after the download started.
 */
const saveDownload = async ( response ) => {
	const disposition = response.headers.get( 'content-disposition' ) || '';
	const match       = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec( disposition );
	const link        = document.createElement( 'a' );

	link.href     = URL.createObjectURL( await response.blob() );
	link.download = match ? decodeURIComponent( match[ 1 ] ) : '';
	document.body.appendChild( link );
	link.click();
	link.remove();

	window.setTimeout( () => URL.revokeObjectURL( link.href ), 30000 );
};

/**
 * Replace the whole document with a response that can not be applied in place, exactly like a
 * native form submission would display it. Used for POST responses, which must never be re-sent.
 *
 * @param {string} html     HTML.
 * @param {string} finalUrl Response URL.
 */
const replaceDocument = ( html, finalUrl ) => {
	log( 'full document replace for POST response', finalUrl );
	window.history.replaceState( null, '', finalUrl );
	document.open();
	document.write( html ); // phpcs:ignore -- Native form submission equivalent.
	document.close();
};

/**
 * Remember the scroll position of the current history entry.
 *
 * @return {void}
 */
const saveScroll = () => {
	const state = Object.assign( {}, window.history.state, { ddfw: true, scroll: window.scrollY } );

	window.history.replaceState( state, '', window.location.href );
};

/**
 * Swap the view area and the document level state that belongs to it.
 *
 * @param {Document} newDoc Parsed document.
 * @return {Element} New view container.
 */
const swapDom = ( newDoc ) => {
	const newView = newDoc.querySelector( VIEW_SELECTOR );

	// Id, or tag and first class: runtime state classes must not make printed markup look foreign.
	const signature = ( element ) => ( element.id ? `#${ element.id }` : `${ element.tagName }.${ element.classList[ 0 ] || '' }` );
	const printed   = new Set( Array.from( newDoc.querySelectorAll( 'body > *, #wpwrap > *' ), signature ) );

	document.querySelector( VIEW_SELECTOR ).replaceWith( newView );

	[ '#screen-meta', '#screen-meta-links' ].forEach( ( selector ) => {
		const live     = document.querySelector( selector );
		const incoming = newDoc.querySelector( selector );

		if ( live && incoming ) {
			live.replaceWith( incoming );
		} else if ( live ) {
			live.remove();
		} else if ( incoming ) {
			const wpBodyContent = document.getElementById( 'wpbody-content' );

			if ( wpBodyContent ) {
				wpBodyContent.insertBefore( incoming, wpBodyContent.firstChild );
			}
		}
	} );

	// Footer markup printed for the view outside the wrap (editor link dialog, for example).
	const wpWrap = document.getElementById( 'wpwrap' );

	newDoc.querySelectorAll( '#wpfooter ~ [id]:not(script):not(link):not(style)' ).forEach( ( element ) => {
		if ( wpWrap && ! document.getElementById( element.id ) ) {
			wpWrap.appendChild( element );
		}
	} );

	// Markup the plugin's view scripts appended outside the view (a widget preview on <body>, for
	// example) belongs to the outgoing view, unless the incoming view prints it too.
	if ( config.prefix ) {
		document.querySelectorAll( 'body > *, #wpwrap > *' ).forEach( ( element ) => {
			const owned = 0 === element.id.indexOf( config.prefix ) || Array.from( element.classList ).some( ( className ) => 0 === className.indexOf( config.prefix ) );

			if ( owned && ! [ 'SCRIPT', 'STYLE', 'LINK' ].includes( element.tagName ) && ! printed.has( signature( element ) ) ) {
				element.remove();
			}
		} );
	}

	document.title = newDoc.title;

	const kept = BODY_CLASSES_KEPT.filter( ( className ) => document.body.classList.contains( className ) );

	document.body.className = newDoc.body.className.replace( /\bno-js\b/, 'js' );
	kept.forEach( ( className ) => document.body.classList.add( className ) );

	return newView;
};

/**
 * Library-like globals (functions and objects) of the page.
 *
 * @return {Map<string, *>} Global name => value.
 */
const snapshotGlobals = () => {
	const globals = new Map();

	Object.keys( window ).forEach( ( key ) => {
		try {
			const value = window[ key ];

			if ( value && ( 'function' === typeof value || 'object' === typeof value ) ) {
				globals.set( key, value );
			}
		} catch ( e ) {
			// Inaccessible property.
		}
	} );

	return globals;
};

/**
 * Move keyboard focus to the new view for assistive technology.
 *
 * @param {Element} view View container.
 */
const focusView = ( view ) => {
	const target = view.querySelector( '.notice-error, .ddfw-template-wrapper h1, .ddfw-template-wrapper h2, .ddfw-template-wrapper h3' ) || view;

	if ( ! target.hasAttribute( 'tabindex' ) ) {
		target.setAttribute( 'tabindex', '-1' );
	}

	target.focus( { preventScroll: true } );
};

/**
 * Perform a visit.
 *
 * @param {string} href    URL.
 * @param {Object} options { method, body, history: push|replace|none, scroll: top|keep|number, form }.
 * @return {Promise<void>} Resolves when the visit settled.
 */
export const visit = async ( href, options = {} ) => {
	const method  = ( options.method || 'GET' ).toUpperCase();
	const isPost  = 'POST' === method;
	const url     = toUrl( href );
	const history = options.history || 'push';

	if ( ! url ) {
		return;
	}

	const beforeVisit = new CustomEvent( 'ddfw:before-visit', { cancelable: true, detail: { url: url.href, method } } );

	if ( ! document.dispatchEvent( beforeVisit ) ) {
		return;
	}

	if ( 'none' !== history && hasUnsavedChanges( options.form ) && ! window.confirm( config.i18n.unsavedChanges ) ) {
		return;
	}

	// Superseded visits are not aborted, only ignored (token check): aborting a fetch surfaces
	// unhandled rejections in browser extensions that wrap window.fetch.
	const token = ++visitToken;
	const timings = { start: performance.now() };
	const mark    = ( name ) => {
		timings[ name ] = Math.round( performance.now() - timings.start );
	};

	ui.start( { skeleton: options.skeleton, link: options.link, url: url.href } );

	let result;

	try {
		if ( isPost ) {
			prefetchCache.clear();
			result = await fetchView( url.href, { method, body: options.body } );
		} else {
			if ( url.searchParams.has( '_wpnonce' ) ) {
				prefetchCache.clear();
			}
			result = await fetchCachedView( url.href );
		}
	} catch ( error ) {
		if ( token === visitToken ) {
			ui.done();
			// A failed POST may still have been processed: never re-send it.
			if ( isPost ) {
				window.location.reload();
			} else {
				hardVisit( url.href, `network error: ${ error.message }` );
			}
		}
		return;
	}

	if ( token !== visitToken ) {
		return;
	}

	mark( 'fetched' );

	const { response, html } = result;
	const finalUrl           = toUrl( response.url ) || url;
	const fallback           = ( reason ) => {
		ui.done();

		if ( isPost && ! response.redirected && null !== html ) {
			replaceDocument( html, finalUrl.href );
		} else {
			hardVisit( finalUrl.href, reason );
		}
	};

	if ( null === html ) {
		ui.done();

		if ( response.ok && -1 !== ( response.headers.get( 'content-disposition' ) || '' ).indexOf( 'attachment' ) ) {
			log( 'download', finalUrl.href );
			await saveDownload( response );
		} else if ( isPost ) {
			window.location.reload();
		} else {
			hardVisit( finalUrl.href, 'non HTML response' );
		}
		return;
	}

	if ( ! response.ok ) {
		return fallback( `HTTP ${ response.status }` );
	}

	if ( ! isDashboardUrl( finalUrl ) ) {
		return fallback( 'response left the dashboard' );
	}

	const newDoc = new window.DOMParser().parseFromString( html, 'text/html' );

	if ( ! newDoc.querySelector( VIEW_SELECTOR ) || newDoc.querySelector( '.ddfw-setup-wizard-wrap' ) ) {
		return fallback( 'no dashboard view in response' );
	}

	mark( 'parsed' );

	const assetPlan = plan( newDoc );

	mark( 'planned' );

	if ( assetPlan.unsafe ) {
		return fallback( assetPlan.unsafe );
	}

	await applyStyles( assetPlan.styles );

	mark( 'styled' );

	if ( token !== visitToken ) {
		return;
	}

	const scroll = 'top' === ( options.scroll || 'top' ) ? 0 : ( 'keep' === options.scroll ? window.scrollY : options.scroll );

	if ( 'push' === history ) {
		saveScroll();
	}

	const oldView = document.querySelector( VIEW_SELECTOR );

	document.dispatchEvent( new CustomEvent( 'ddfw:view:unload', { detail: { container: oldView } } ) );
	unloadView( oldView );
	lifecycle.teardown();

	let newView;

	const applyDom = () => {
		newView = swapDom( newDoc );
		assetPlan.removeStyles.forEach( ( style ) => style.remove() );
		assetPlan.removeScripts.forEach( ( script ) => script.remove() );

		// Mirror the canonical URL (drops one-time args such as settings-updated) like core does.
		const canonical = newDoc.getElementById( 'wp-admin-canonical' );
		const shownUrl  = ( canonical && isDashboardUrl( toUrl( canonical.href ) ) ? canonical.href : finalUrl.href ) + url.hash;
		const state     = { ddfw: true, scroll };

		// A new entry per distinct URL, like native navigation. The entry always holds a GET URL
		// (redirect target or canonical), so reloading or going back never re-submits a POST.
		if ( 'push' === history && shownUrl !== window.location.href ) {
			window.history.pushState( state, '', shownUrl );
		} else {
			window.history.replaceState( state, '', shownUrl );
		}

		window.scrollTo( 0, scroll );
	};

	const reducedMotion = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	try {
		if ( config.transitions && document.startViewTransition && ! reducedMotion ) {
			await document.startViewTransition( applyDom ).updateCallbackDone;
		} else {
			applyDom();
		}
	} catch ( error ) {
		ui.done();
		hardVisit( finalUrl.href, `swap failed: ${ error.message }` );
		return;
	}

	mark( 'swapped' );

	ui.rememberShape( window.location.href, document );

	loadView();
	initViewHandler( newView );

	mark( 'initialized' );

	const generation = lifecycle.getGeneration();

	lifecycle.beginScriptPass();

	// Globals that a newly loaded library replaced (Chart.js v2 bundles its own `Color`, which
	// breaks core's iris picker). On a full load they would never meet: the page keeps its own.
	const replacedGlobals = new Map();

	try {
		for ( const entry of assetPlan.scripts ) {
			const before = 'load' === entry.action ? snapshotGlobals() : null;

			// eslint-disable-next-line no-await-in-loop
			await applyScript( entry, generation );

			if ( before ) {
				before.forEach( ( value, key ) => {
					if ( window[ key ] !== value && ! replacedGlobals.has( key ) ) {
						replacedGlobals.set( key, value );
					}
				} );
			}
		}
	} catch ( error ) {
		lifecycle.flushReadyQueue();
		ui.done();
		hardVisit( window.location.href, error.message );
		return;
	}

	// Checked after the pass: a library's own companion code may already have restored it (noConflict).
	replacedGlobals.forEach( ( value, key ) => {
		if ( window[ key ] !== value ) {
			log( 'restored global replaced by a loaded script:', key );
			window[ key ] = value;
		}
	} );

	lifecycle.flushReadyQueue();
	initEditors( newView );

	mark( 'scripted' );

	ui.done();
	ui.announce( document.title );
	focusView( newView );

	dirtySnapshot = snapshotForms();
	userEdited    = false;

	log( 'soft visit', window.location.href, timings, assetPlan );

	document.dispatchEvent( new CustomEvent( 'ddfw:view:load', { detail: { url: window.location.href, container: newView, timings } } ) );
};

/**
 * Link click interception.
 *
 * @param {MouseEvent} event Click event.
 */
const onClick = ( event ) => {
	if ( event.defaultPrevented || 0 !== event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) {
		return;
	}

	const link = event.target.closest && event.target.closest( 'a[href]' );

	if ( ! link || ( link.target && '_self' !== link.target ) || link.hasAttribute( 'download' ) || link.closest( '[data-ddfw-hard]' ) ) {
		return;
	}

	const href = link.getAttribute( 'href' );

	if ( ! href || '#' === href.charAt( 0 ) || 0 === href.indexOf( 'javascript:' ) ) {
		return;
	}

	const url = toUrl( link.href );

	if ( ! isDashboardUrl( url ) ) {
		return;
	}

	// Same document anchor.
	if ( url.hash && url.href.split( '#' )[ 0 ] === window.location.href.split( '#' )[ 0 ] ) {
		return;
	}

	event.preventDefault();

	// A left tab only replaces the content column; anything else may change the whole layout.
	visit( url.href, { link, skeleton: link.closest( '.ddfw-left-tab-wrapper' ) ? 'content' : 'container' } );
};

/**
 * Submit a dashboard form in place.
 *
 * @param {HTMLFormElement}  form      Form.
 * @param {HTMLElement|null} submitter Submit button.
 * @return {boolean} True when the engine took over the submission.
 */
const submitForm = ( form, submitter ) => {
	if ( ! form || 'FORM' !== form.tagName || form.closest( '[data-ddfw-hard]' ) ) {
		return false;
	}

	if ( ! form.closest( `${ VIEW_SELECTOR }, #screen-meta` ) || form.querySelector( 'input[type="file"]' ) || 'multipart/form-data' === form.enctype ) {
		return false;
	}

	const target    = ( submitter && submitter.getAttribute( 'formtarget' ) ) || form.getAttribute( 'target' );

	if ( target && '_self' !== target ) {
		return false;
	}

	const method   = ( ( submitter && submitter.getAttribute( 'formmethod' ) ) || form.getAttribute( 'method' ) || 'get' ).toUpperCase();
	const actionAttr = ( submitter && submitter.getAttribute( 'formaction' ) ) || form.getAttribute( 'action' );
	const action   = toUrl( actionAttr || window.location.href );

	if ( ! action ) {
		return false;
	}

	let formData;

	try {
		formData = new FormData( form, submitter );
	} catch ( e ) {
		formData = new FormData( form );

		if ( submitter && submitter.name ) {
			formData.append( submitter.name, submitter.value );
		}
	}

	const params = new URLSearchParams( formData );

	if ( 'GET' === method ) {
		action.search = params.toString();

		if ( ! isDashboardUrl( action ) ) {
			return false;
		}

		visit( action.href, { scroll: 'keep' } );
		return true;
	}

	if ( 'POST' !== method ) {
		return false;
	}

	const isOptionsApi = /\/wp-admin\/options\.php$/.test( action.pathname ) && action.origin === window.location.origin;

	if ( ! isOptionsApi && ! isDashboardUrl( action ) ) {
		return false;
	}

	const buttons = form.querySelectorAll( 'button[type="submit"], input[type="submit"]' );

	buttons.forEach( ( button ) => {
		button.disabled = true;
		button.setAttribute( 'aria-busy', 'true' );
	} );

	visit( action.href, { method: 'POST', body: params, scroll: 'keep', form } ).finally( () => {
		buttons.forEach( ( button ) => {
			if ( button.isConnected ) {
				button.disabled = false;
				button.removeAttribute( 'aria-busy' );
			}
		} );
	} );

	return true;
};

/**
 * Form submission interception.
 *
 * @param {SubmitEvent} event Submit event.
 */
const onSubmit = ( event ) => {
	if ( ! event.defaultPrevented && submitForm( event.target, event.submitter || null ) ) {
		event.preventDefault();
	}
};

/**
 * Prefetch on hover/focus intent.
 *
 * @param {Event} event Pointer or focus event.
 */
const onIntent = ( event ) => {
	const link = event.target.closest && event.target.closest( 'a[href]' );

	if ( ! link || link.ddfwPrefetchTimer || ( link.target && '_self' !== link.target ) || link.closest( '[data-ddfw-hard]' ) ) {
		return;
	}

	const url = toUrl( link.href );

	if ( ! url || ! isPrefetchable( url ) || url.href === window.location.href || ( navigator.connection && navigator.connection.saveData ) ) {
		return;
	}

	const cached = prefetchCache.get( url.href );

	if ( cached && Date.now() - cached.time < PREFETCH_TTL ) {
		return;
	}

	link.ddfwPrefetchTimer = window.setTimeout( () => {
		link.ddfwPrefetchTimer = 0;

		const promise = fetchView( url.href );

		promise.then( ( result ) => result.html && ui.rememberShape( url.href, result.html ), () => prefetchCache.delete( url.href ) );
		prefetchCache.set( url.href, { time: Date.now(), promise } );
		log( 'prefetch', url.href );
	}, PREFETCH_DELAY );

	link.addEventListener( 'pointerleave', () => {
		window.clearTimeout( link.ddfwPrefetchTimer );
		link.ddfwPrefetchTimer = 0;
	}, { once: true } );
};

/**
 * Browser back/forward.
 *
 * @param {PopStateEvent} event Pop state event.
 */
const onPopState = ( event ) => {
	if ( ! event.state || ! event.state.ddfw ) {
		return;
	}

	const url = toUrl( window.location.href );

	if ( ! isDashboardUrl( url ) ) {
		hardVisit( url.href, 'history entry outside dashboard' );
		return;
	}

	visit( url.href, { history: 'none', scroll: event.state.scroll || 0, skeleton: 'container' } );
};

/**
 * Whether soft navigation may run in this browser and page.
 *
 * @return {boolean} True when supported.
 */
const isSupported = () => {
	if ( ! config.enabled || ! config.page || ! window.fetch || ! window.DOMParser || ! window.history.pushState ) {
		return false;
	}

	if ( /[?&]ddfw-hard=1\b/.test( window.location.search ) || ! document.querySelector( VIEW_SELECTOR ) ) {
		return false;
	}

	return ! document.querySelector( '.ddfw-setup-wizard-wrap' );
};

/**
 * Install the lifecycle ledger. Must run while framework.js is evaluated, before plugin scripts.
 *
 * @return {boolean} True when the engine will boot.
 */
export const prepare = () => {
	// The view markup may not be parsed yet, so only the static checks run here; boot() re-checks.
	if ( ! config.enabled || ! config.page || ! window.fetch || ! window.DOMParser ) {
		return false;
	}

	lifecycle.install();

	return true;
};

/**
 * Boot the engine on DOMContentLoaded.
 *
 * @param {Function} initView Framework field initializer, run for every incoming view.
 * @return {boolean} True when soft navigation is active.
 */
export const boot = ( initView ) => {
	initViewHandler = initView;

	if ( ! isSupported() ) {
		return false;
	}

	if ( 'scrollRestoration' in window.history ) {
		window.history.scrollRestoration = 'manual';
	}

	window.history.replaceState( Object.assign( {}, window.history.state, { ddfw: true, scroll: window.scrollY } ), '', window.location.href );

	// Window listeners run after document level handlers, so plugin and framework handlers
	// (delete confirmations, AJAX forms) can still prevent the default action.
	window.addEventListener( 'click', onClick );
	window.addEventListener( 'submit', onSubmit );

	// Programmatic form.submit() fires no submit event (date range filter, plugin scripts):
	// same routing, and like the native method no submit handlers or validation run.
	const nativeSubmit = HTMLFormElement.prototype.submit;

	HTMLFormElement.prototype.submit = function() {
		if ( ! submitForm( this, null ) ) {
			nativeSubmit.call( this );
		}
	};
	window.addEventListener( 'popstate', onPopState );

	if ( config.prefetch ) {
		document.addEventListener( 'pointerover', onIntent, { passive: true } );
		document.addEventListener( 'focusin', onIntent );
	}

	document.addEventListener( 'input', ( event ) => {
		if ( event.isTrusted && event.target.closest && event.target.closest( VIEW_SELECTOR ) ) {
			userEdited = true;
		}
	}, true );
	document.addEventListener( 'change', ( event ) => {
		if ( event.isTrusted && event.target.closest && event.target.closest( VIEW_SELECTOR ) ) {
			userEdited = true;
		}
	}, true );

	window.addEventListener( 'load', () => {
		dirtySnapshot = snapshotForms();
	} );

	ui.rememberShape( window.location.href, document );
	document.documentElement.classList.add( 'ddfw-turbo' );
	log( 'ready', config );

	return true;
};
