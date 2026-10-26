/**
 * Asset planner.
 *
 * Compares the assets of the live document with the assets of the fetched view and decides:
 *  - which stylesheets to add or remove,
 *  - which scripts to load once, re-run, or skip,
 *  - whether the view can be applied in place at all ("unsafe" => full page load).
 *
 * Handles are compared, not URLs: WordPress concatenates core scripts through load-scripts.php,
 * so the same handle can move between a concat URL and a standalone tag from one view to another.
 *
 * @package DevDiggers\Framework
 */

import { config } from './config';
import { concatHandles, fingerprint, isViewHandle, parseScriptId, parseStyleHandle } from './handles';

const DATA_SCRIPT_TYPES = [ 'text/html', 'text/template', 'text/x-template', 'application/json', 'application/ld+json', 'speculationrules' ];

/**
 * Normalized script type.
 *
 * @param {HTMLScriptElement} script Script.
 * @return {string} Type ('' for classic JavaScript).
 */
const scriptType = ( script ) => {
	const type = ( script.getAttribute( 'type' ) || '' ).trim().toLowerCase();

	return [ 'text/javascript', 'application/javascript' ].includes( type ) ? '' : type;
};

/**
 * Whether the element lives inside the swapped view area.
 *
 * @param {Element} element Element.
 * @return {boolean} True inside the view.
 */
export const inView = ( element ) => !! element.closest( '.devdiggers-wrap, #screen-meta, #screen-meta-links' );

/**
 * Inventory of the assets outside the view area of a document.
 *
 * @param {Document} doc Document.
 * @return {Object} Inventory.
 */
export const inventory = ( doc ) => {
	const scriptHandles = new Set();
	const styleHandles  = new Set();
	const inline        = new Map(); // element id => text.
	const anonymous     = new Set();
	const templates     = new Set();

	doc.querySelectorAll( 'script' ).forEach( ( script ) => {
		if ( inView( script ) ) {
			return;
		}

		const type   = scriptType( script );
		const parsed = parseScriptId( script.id );

		if ( DATA_SCRIPT_TYPES.includes( type ) ) {
			templates.add( script.id || fingerprint( script.textContent ) );
		} else if ( script.src ) {
			concatHandles( script.src ).forEach( ( handle ) => scriptHandles.add( handle ) );

			if ( parsed ) {
				scriptHandles.add( parsed.handle );
			} else if ( ! concatHandles( script.src ).length ) {
				scriptHandles.add( 'src:' + script.src.split( '?' )[ 0 ] );
			}
		} else if ( parsed ) {
			inline.set( script.id, script.textContent );
		} else {
			anonymous.add( type + fingerprint( script.textContent ) );
		}
	} );

	doc.querySelectorAll( 'link[rel="stylesheet"], style' ).forEach( ( style ) => {
		if ( inView( style ) ) {
			return;
		}

		const handle = parseStyleHandle( style.id );

		concatHandles( style.href ).forEach( ( concat ) => styleHandles.add( concat ) );

		if ( handle ) {
			styleHandles.add( style.id );
		} else if ( style.href ) {
			styleHandles.add( 'href:' + style.href.split( '?' )[ 0 ] );
		} else {
			styleHandles.add( 'inline:' + fingerprint( style.textContent ) );
		}
	} );

	return { scriptHandles, styleHandles, inline, anonymous, templates };
};

/**
 * Whether a missing persistent script handle may be loaded into a live page.
 *
 * @param {string} handle Handle.
 * @return {boolean} True when loadable.
 */
const isLoadableHandle = ( handle ) => config.loadableHandles.some( ( loadable ) => (
	'*' === loadable.slice( -1 ) ? 0 === handle.indexOf( loadable.slice( 0, -1 ) ) : loadable === handle
) );

/**
 * Build the execution/loading plan for a fetched view.
 *
 * @param {Document} newDoc Parsed response document.
 * @return {{unsafe: string|false, scripts: Object[], styles: Object[], removeStyles: Element[]}} Plan.
 */
export const plan = ( newDoc ) => {
	const current = inventory( document );
	const scripts = [];
	const styles  = [];
	let unsafe    = false;

	const markUnsafe = ( reason ) => {
		unsafe = unsafe || reason;
	};

	const incomingAnonymous = new Set();

	newDoc.querySelectorAll( 'script' ).forEach( ( script ) => {
		const type = scriptType( script );

		if ( inView( script ) ) {
			if ( '' === type ) {
				scripts.push( { action: 'run', element: script, inView: true } );
			}
			return;
		}

		const parsed = parseScriptId( script.id );

		if ( DATA_SCRIPT_TYPES.includes( type ) ) {
			// Templates (media modal, editor dialogs) are inert until read: add the missing ones.
			if ( ! current.templates.has( script.id || fingerprint( script.textContent ) ) && 'speculationrules' !== type ) {
				scripts.push( { action: 'inject', element: script } );
			}
			return;
		}

		if ( '' !== type ) {
			// Modules and import maps can not be re-evaluated in a live document.
			// An external module without a handle (Cloudflare Web Analytics) is known by its URL, as inventory() records it.
			const known = parsed ? current.scriptHandles.has( parsed.handle ) : ( script.src ? current.scriptHandles.has( 'src:' + script.src.split( '?' )[ 0 ] ) : current.anonymous.has( type + fingerprint( script.textContent ) ) );

			if ( ! known ) {
				markUnsafe( `new ${ type } script ${ script.id || '' }` );
			}
			return;
		}

		if ( parsed && isViewHandle( parsed.handle ) ) {
			scripts.push( { action: 'run', element: script, handle: parsed.handle } );
			return;
		}

		// Cloudflare Email Obfuscation adds its decoder to pages that show an email address. It only
		// decodes the addresses on the page and removes itself, so it runs again for every view.
		if ( script.src && /\/cdn-cgi\/scripts\/[^/]+\/cloudflare-static\/email-decode\.min\.js/.test( script.src ) ) {
			scripts.push( { action: 'run', element: script } );
			return;
		}

		if ( script.src ) {
			const handles = parsed ? [ parsed.handle ] : concatHandles( script.src );

			if ( ! handles.length ) {
				if ( ! current.scriptHandles.has( 'src:' + script.src.split( '?' )[ 0 ] ) ) {
					markUnsafe( `new script ${ script.src }` );
				}
				return;
			}

			const missing = handles.filter( ( handle ) => ! current.scriptHandles.has( handle ) );

			if ( ! missing.length ) {
				return;
			}

			const notLoadable = missing.filter( ( handle ) => ! isLoadableHandle( handle ) );

			if ( notLoadable.length ) {
				markUnsafe( `new core/third-party scripts: ${ notLoadable.join( ', ' ) }` );
				return;
			}

			scripts.push( { action: 'load', element: script, handles: missing, concat: ! parsed } );
			return;
		}

		if ( parsed ) {
			// Localized data of an already loaded persistent script: refresh it (pure variable
			// assignments). Other companions of loaded persistent scripts are init code: skip.
			if ( current.scriptHandles.has( parsed.handle ) ) {
				if ( 'extra' === parsed.part && current.inline.get( script.id ) !== script.textContent ) {
					scripts.push( { action: 'run', element: script } );
				}
			} else if ( isLoadableHandle( parsed.handle ) ) {
				scripts.push( { action: 'run', element: script } );
			}
			return;
		}

		// Footer inline code that the current view did not print (editor settings and init, for
		// example): it runs exactly like on a full page load, tracked as view code.
		incomingAnonymous.add( fingerprint( script.textContent ) );

		if ( ! current.anonymous.has( fingerprint( script.textContent ) ) ) {
			scripts.push( { action: 'run', element: script, anonymous: true } );
		}
	} );

	// Inline footer code of the current view that the next view does not print is dropped from the
	// document, so it runs again when a later view prints it (editor init on a return visit).
	const removeScripts = Array.from( document.querySelectorAll( 'script:not([src]):not([id])' ) ).filter( ( script ) => (
		! inView( script ) && '' === scriptType( script ) && ! incomingAnonymous.has( fingerprint( script.textContent ) )
	) );

	newDoc.querySelectorAll( 'link[rel="stylesheet"], style' ).forEach( ( style ) => {
		if ( inView( style ) ) {
			return;
		}

		const handles = concatHandles( style.href );

		if ( handles.length ) {
			if ( handles.some( ( handle ) => ! current.styleHandles.has( handle ) ) ) {
				styles.push( { element: style, handles: handles.filter( ( handle ) => ! current.styleHandles.has( handle ) ) } );
			}
			return;
		}

		const key = parseStyleHandle( style.id ) ? style.id : ( style.href ? 'href:' + style.href.split( '?' )[ 0 ] : 'inline:' + fingerprint( style.textContent ) );

		if ( ! current.styleHandles.has( key ) ) {
			styles.push( { element: style } );
		} else if ( style.id && ! style.href ) {
			const live = document.getElementById( style.id );

			if ( live && live.textContent !== style.textContent ) {
				styles.push( { element: style, replace: live } );
			}
		}
	} );

	// View styles of the previous view that the next view no longer needs.
	const removeStyles = Array.from( document.querySelectorAll( 'link[rel="stylesheet"][id], style[id]' ) ).filter( ( style ) => {
		const handle = parseStyleHandle( style.id );

		return handle && isViewHandle( handle ) && ! inView( style ) && ! newDoc.getElementById( style.id );
	} );

	return { unsafe, scripts, styles, removeStyles, removeScripts };
};

/**
 * Rebuild a load-*.php concat URL so it only contains the given handles.
 *
 * @param {string}   url     Concat URL.
 * @param {string[]} handles Handles to keep.
 * @return {string} URL.
 */
const narrowConcatUrl = ( url, handles ) => {
	const narrowed = new URL( url, window.location.href );

	Array.from( narrowed.searchParams.keys() ).filter( ( key ) => 0 === key.indexOf( 'load' ) ).forEach( ( key ) => narrowed.searchParams.delete( key ) );
	narrowed.searchParams.set( 'load[chunk_0]', handles.join( ',' ) );

	return narrowed.toString();
};

/**
 * Wait for a stylesheet to load (or fail), capped so a hanging request never blocks a visit.
 *
 * @param {HTMLLinkElement} link Link element.
 * @return {Promise} Settles when loaded.
 */
const whenStylesheetLoads = ( link ) => new Promise( ( resolve ) => {
	const done = () => resolve();

	link.addEventListener( 'load', done, { once: true } );
	link.addEventListener( 'error', done, { once: true } );
	window.setTimeout( done, 3000 );
} );

/**
 * Add the stylesheets a view needs before it is shown, to avoid a flash of unstyled content.
 *
 * @param {Object[]} styles Planned styles.
 * @return {Promise} Resolves once every stylesheet settled.
 */
export const applyStyles = ( styles ) => Promise.all( styles.map( ( entry ) => {
	const clone = document.createElement( entry.element.tagName.toLowerCase() );

	Array.from( entry.element.attributes ).forEach( ( attribute ) => clone.setAttribute( attribute.name, attribute.value ) );

	if ( entry.handles ) {
		clone.setAttribute( 'href', narrowConcatUrl( entry.element.href, entry.handles ) );
	}

	clone.textContent = entry.element.textContent;

	if ( entry.replace ) {
		entry.replace.replaceWith( clone );
		return Promise.resolve();
	}

	document.head.appendChild( clone );

	return 'LINK' === clone.tagName ? whenStylesheetLoads( clone ) : Promise.resolve();
} ) );

/**
 * Execute or load one planned script. External scripts resolve after they ran.
 *
 * @param {Object} entry      Planned script.
 * @param {number} generation View generation stamp.
 * @return {Promise} Resolves after execution; rejects when an external script fails to load.
 */
export const applyScript = ( entry, generation ) => new Promise( ( resolve, reject ) => {
	const source = entry.element;
	const script = document.createElement( 'script' );

	Array.from( source.attributes ).forEach( ( attribute ) => script.setAttribute( attribute.name, attribute.value ) );

	if ( 'inject' === entry.action ) {
		script.textContent = source.textContent;
		document.body.appendChild( script );
		resolve();
		return;
	}

	if ( 'run' === entry.action && ( entry.handle || entry.inView || entry.anonymous ) ) {
		script.setAttribute( 'data-ddfw-view', String( generation ) );
	}

	if ( entry.concat ) {
		script.setAttribute( 'src', narrowConcatUrl( source.src, entry.handles ) );
	}

	const live = entry.inView ? source : ( source.id && document.getElementById( source.id ) );

	if ( script.hasAttribute( 'src' ) ) {
		script.async = false;
		script.addEventListener( 'load', () => resolve(), { once: true } );
		script.addEventListener( 'error', () => reject( new Error( `Failed to load ${ script.src }` ) ), { once: true } );
	} else {
		script.textContent = source.textContent;
	}

	if ( live && live.isConnected ) {
		live.replaceWith( script );
	} else {
		document.body.appendChild( script );
	}

	if ( ! script.hasAttribute( 'src' ) ) {
		resolve();
	}
} );
