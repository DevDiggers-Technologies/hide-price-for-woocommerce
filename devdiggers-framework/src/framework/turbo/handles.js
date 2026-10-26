/**
 * WordPress asset handle helpers shared by the asset planner and the lifecycle ledger.
 *
 * WordPress prints `id="{handle}-js"` on scripts, `{handle}-js-extra|before|after|translations`
 * on their inline companions, `{handle}-css` on styles and `{handle}-inline-css` on inline styles.
 *
 * @package DevDiggers\Framework
 */

import { config } from './config';

const SCRIPT_ID = /^(.+?)-js(?:-(extra|before|after|translations))?$/;
const STYLE_ID  = /^(.+?)-(?:inline-)?css$/;

/**
 * Parse a script element id into its handle and part.
 *
 * @param {string} id Element id.
 * @return {{handle: string, part: string}|null} Parsed id.
 */
export const parseScriptId = ( id ) => {
	const match = id ? SCRIPT_ID.exec( id ) : null;

	return match ? { handle: match[ 1 ], part: match[ 2 ] || 'src' } : null;
};

/**
 * Parse a style element id into its handle.
 *
 * @param {string} id Element id.
 * @return {string} Handle or empty string.
 */
export const parseStyleHandle = ( id ) => {
	const match = id ? STYLE_ID.exec( id ) : null;

	return match ? match[ 1 ] : '';
};

/**
 * Whether a handle belongs to the current dashboard view (re-run on every soft visit).
 *
 * @param {string} handle Asset handle.
 * @return {boolean} True for view handles.
 */
export const isViewHandle = ( handle ) => !! handle && (
	( config.prefix && 0 === handle.indexOf( config.prefix + '-' ) ) ||
	config.viewHandles.includes( handle )
);

/**
 * Whether a script element is a view script, used while the script is executing.
 *
 * @param {Element|null} script Script element (document.currentScript).
 * @return {boolean} True when the script is a view script.
 */
export const isViewScript = ( script ) => {
	if ( ! script || ! script.getAttribute ) {
		return false;
	}

	if ( script.hasAttribute( 'data-ddfw-view' ) ) {
		return true;
	}

	const parsed = parseScriptId( script.id );

	return !! parsed && isViewHandle( parsed.handle );
};

/**
 * Handles concatenated into a load-scripts.php / load-styles.php URL.
 *
 * @param {string} url Asset URL.
 * @return {string[]} Handles.
 */
export const concatHandles = ( url ) => {
	if ( ! url || ( -1 === url.indexOf( 'load-scripts.php' ) && -1 === url.indexOf( 'load-styles.php' ) ) ) {
		return [];
	}

	const handles = [];

	new URL( url, window.location.href ).searchParams.forEach( ( value, key ) => {
		if ( 0 === key.indexOf( 'load' ) ) {
			handles.push( ...value.split( ',' ).filter( Boolean ) );
		}
	} );

	return handles;
};

/**
 * Stable fingerprint for anonymous inline scripts/styles whose volatile parts (timestamps,
 * nonces, ids) change on every request.
 *
 * @param {string} text Inline content.
 * @return {string} Fingerprint.
 */
export const fingerprint = ( text ) => {
	const normalized = ( text || '' ).trim().replace( /\s+/g, ' ' ).replace( /[0-9a-f]{10}|\d+/gi, '0' );
	let hash         = 5381;

	// The whole content counts: scripts such as tinyMCEPreInit only differ after a long common prefix.
	for ( let i = 0; i < normalized.length; i++ ) {
		hash = ( ( hash * 33 ) ^ normalized.charCodeAt( i ) ) >>> 0;
	}

	return `${ normalized.slice( 0, 40 ) }|${ normalized.length }|${ hash.toString( 36 ) }`;
};
