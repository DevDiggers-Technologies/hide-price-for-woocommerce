/**
 * Visual and accessibility feedback for soft visits: skeleton and live region.
 *
 * @package DevDiggers\Framework
 */

import { config } from './config';

let liveRegion  = null;
let showTimer   = 0;

/**
 * Lazily create the aria-live region.
 *
 * @return {void}
 */
const ensureElements = () => {
	if ( liveRegion ) {
		return;
	}

	liveRegion = document.createElement( 'div' );
	liveRegion.className = 'screen-reader-text';
	liveRegion.setAttribute( 'aria-live', 'polite' );
	liveRegion.setAttribute( 'aria-atomic', 'true' );
	document.body.appendChild( liveRegion );
};

const SHAPES_KEY = 'ddfwTurboShapes';

let shapes = {};

try {
	shapes = JSON.parse( window.localStorage.getItem( SHAPES_KEY ) || '{}' ) || {};
} catch ( e ) {
	shapes = {};
}

/**
 * Layout key of a dashboard URL: the parameters that choose the template.
 *
 * @param {string} href URL.
 * @return {string[]} [ exact key, menu key ].
 */
const shapeKeys = ( href ) => {
	const params = new URL( href, window.location.href ).searchParams;
	const menu   = `${ params.get( 'page' ) }|${ params.get( 'menu' ) || '' }`;

	return [ `${ menu }|${ params.get( 'tab' ) || '' }|${ params.get( 'action' ) || '' }`, menu ];
};

/**
 * Remember the layout of a view, so the next visit to it shows a matching skeleton.
 *
 * @param {string}          href   URL of the view.
 * @param {Document|string} source Parsed document or response HTML.
 * @return {void}
 */
export const rememberShape = ( href, source ) => {
	const has = ( selector, needle ) => ( 'string' === typeof source ? -1 !== source.indexOf( needle ) : !! source.querySelector( `.devdiggers-wrap ${ selector }` ) );

	if ( 'string' === typeof source ? -1 === source.indexOf( 'devdiggers-wrap' ) : ! source.querySelector( '.devdiggers-wrap' ) ) {
		return;
	}

	let kind = 'form';

	if ( has( '.ddfw-dash', 'ddfw-dash-header' ) ) {
		kind = 'dashboard';
	} else if ( has( '.wp-list-table', 'wp-list-table' ) ) {
		kind = 'table';
	}

	const shape         = { tabs: has( '.ddfw-left-tab-wrapper', 'ddfw-left-tab-wrapper' ), kind };
	const [ key, menu ] = shapeKeys( href );

	shapes[ key ]  = shape;
	shapes[ menu ] = shapes[ menu ] || shape;

	try {
		window.localStorage.setItem( SHAPES_KEY, JSON.stringify( shapes ) );
	} catch ( e ) {
		// Storage unavailable: the skeleton falls back to a guess.
	}
};

const block = ( style = '', extra = '' ) => `<span class="ddfw-skeleton-block ${ extra }" style="${ style }"></span>`;

const formCards = () => {
	const rows = [ 58, 44, 66, 50, 62 ].map( ( width ) => `<div class="ddfw-skeleton-row">${ block( '', 'ddfw-skeleton-label' ) }${ block( `width:${ width }%` ) }</div>` );
	const card = ( count ) => `<div class="ddfw-skeleton-card"><div class="ddfw-skeleton-card-header">${ block( 'width:180px;height:16px' ) }${ block( 'width:55%;height:12px;margin-top:10px' ) }</div>${ rows.slice( 0, count ).join( '' ) }</div>`;

	return card( 5 ) + card( 3 );
};

const tableCard = () => {
	const rows = Array.from( { length: 8 }, () => `<div class="ddfw-skeleton-table-row">${ block( 'width:16px;height:16px' ) }${ block( 'width:22%' ) }${ block( 'width:18%' ) }${ block( 'width:14%' ) }${ block( 'width:12%' ) }</div>` ).join( '' );

	return `<div class="ddfw-skeleton-card ddfw-skeleton-table">
		<div class="ddfw-skeleton-toolbar">${ block( 'width:160px;height:22px' ) }${ block( 'width:92px;height:32px' ) }${ block( 'width:92px;height:32px' ) }<span class="ddfw-skeleton-spacer"></span>${ block( 'width:220px;height:32px' ) }</div>
		<div class="ddfw-skeleton-toolbar">${ block( 'width:140px;height:30px' ) }${ block( 'width:64px;height:30px' ) }<span class="ddfw-skeleton-spacer"></span>${ block( 'width:120px;height:14px' ) }</div>
		<div class="ddfw-skeleton-table-row ddfw-skeleton-table-head">${ block( 'width:16px;height:16px' ) }${ block( 'width:12%' ) }${ block( 'width:10%' ) }${ block( 'width:10%' ) }${ block( 'width:8%' ) }</div>${ rows }</div>`;
};

const dashboard = () => `<div class="ddfw-skeleton-toolbar">${ block( 'width:200px;height:24px' ) }<span class="ddfw-skeleton-spacer"></span>${ block( 'width:240px;height:36px' ) }</div>
	<div class="ddfw-skeleton-stats">${ `<div class="ddfw-skeleton-card">${ block( 'width:50%;height:12px' ) }${ block( 'width:70%;height:26px;margin-top:14px' ) }</div>`.repeat( 5 ) }</div>
	<div class="ddfw-skeleton-card ddfw-skeleton-chart">${ block( 'width:180px;height:16px' ) }${ block( 'height:220px;margin-top:20px' ) }</div>
	<div class="ddfw-skeleton-columns">${ `<div class="ddfw-skeleton-card ddfw-skeleton-chart">${ block( 'width:160px;height:16px' ) }${ block( 'height:180px;margin-top:20px' ) }</div>`.repeat( 2 ) }</div>`;

/**
 * Skeleton markup for a layout.
 *
 * @param {Object}  shape    { tabs, kind }.
 * @param {boolean} withTabs Draw the left tab column.
 * @return {HTMLElement} Skeleton element.
 */
const buildSkeleton = ( shape, withTabs ) => {
	const skeleton = document.createElement( 'div' );
	const content  = { table: tableCard, dashboard }[ shape.kind ] || formCards;
	const tabs     = withTabs ? `<div class="ddfw-skeleton-tabs">${ block( '', 'ddfw-skeleton-tab-active' ) }${ block().repeat( 7 ) }</div>` : '';

	skeleton.className = `ddfw-skeleton ddfw-skeleton-${ shape.kind }`;
	skeleton.setAttribute( 'aria-hidden', 'true' );
	skeleton.innerHTML = `${ tabs }<div class="ddfw-skeleton-content">${ content() }</div>`;

	return skeleton;
};

/**
 * Remove the skeleton of the previous visit, if the view was not swapped.
 *
 * @return {void}
 */
const clearSkeleton = () => {
	document.querySelectorAll( '.ddfw-skeleton' ).forEach( ( skeleton ) => skeleton.remove() );
	document.querySelectorAll( '.ddfw-skeleton-host' ).forEach( ( host ) => host.classList.remove( 'ddfw-skeleton-host' ) );
};

/**
 * Show a skeleton of the incoming view's layout over the part of the page that changes.
 *
 * @param {string} scope 'content' (left tab: the tab column stays) or 'container'.
 * @param {string} href  URL being visited.
 * @return {void}
 */
const showSkeleton = ( scope, href ) => {
	const container = document.querySelector( '.devdiggers-wrap .ddfw-template-container' );
	const content   = container && container.querySelector( '.ddfw-template-wrapper' );

	if ( ! container ) {
		return;
	}

	const [ key, menu ] = shapeKeys( href );
	const current       = { tabs: !! container.querySelector( '.ddfw-left-tab-wrapper' ), kind: 'form' };
	const shape         = shapes[ key ] || shapes[ menu ] || current;

	if ( 'content' === scope && content && shape.tabs && current.tabs ) {
		content.classList.add( 'ddfw-skeleton-host' );
		content.appendChild( buildSkeleton( shape, false ) );
		return;
	}

	container.classList.add( 'ddfw-skeleton-host' );
	container.appendChild( buildSkeleton( shape, shape.tabs ) );
};

/**
 * Mark the clicked menu item active right away, so the navigation responds before the view arrives.
 *
 * @param {HTMLAnchorElement} link Clicked link.
 * @return {void}
 */
const activateLink = ( link ) => {
	const headerTab = link.closest( '.ddfw-header-tab' );

	if ( headerTab ) {
		headerTab.parentElement.querySelectorAll( '.ddfw-header-tab-active' ).forEach( ( tab ) => tab.classList.remove( 'ddfw-header-tab-active' ) );
		headerTab.classList.add( 'ddfw-header-tab-active' );
	} else if ( link.classList.contains( 'ddfw-left-tab' ) ) {
		link.closest( 'nav, ul' ).querySelectorAll( '.ddfw-left-tab-active' ).forEach( ( tab ) => tab.classList.remove( 'ddfw-left-tab-active' ) );
		link.classList.add( 'ddfw-left-tab-active' );
	}
};

/**
 * Start the loading feedback. The skeleton only appears when a visit takes longer than 120 ms,
 * so fast (prefetched) visits never flash.
 *
 * @param {Object} options { skeleton: 'content'|'container'|undefined, url: string, link: HTMLAnchorElement|undefined }.
 * @return {void}
 */
export const start = ( options = {} ) => {
	ensureElements();
	window.clearTimeout( showTimer );
	clearSkeleton();

	if ( options.link ) {
		activateLink( options.link );
	}

	if ( options.skeleton && options.url ) {
		showTimer = window.setTimeout( () => showSkeleton( options.skeleton, options.url ), 120 );
	}

	document.documentElement.classList.add( 'ddfw-turbo-loading' );
};

/**
 * Finish the loading feedback.
 *
 * @return {void}
 */
export const done = () => {
	window.clearTimeout( showTimer );
	document.documentElement.classList.remove( 'ddfw-turbo-loading' );
	clearSkeleton();
};

/**
 * Announce the loaded view to assistive technology.
 *
 * @param {string} title Document title.
 */
export const announce = ( title ) => {
	ensureElements();
	liveRegion.textContent = '';

	window.setTimeout( () => {
		liveRegion.textContent = ( config.i18n.loaded || '%s' ).replace( '%s', title.split( '‹' )[ 0 ].trim() );
	}, 50 );
};
