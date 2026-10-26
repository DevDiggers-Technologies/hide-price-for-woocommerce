/**
 * View lifecycle ledger.
 *
 * Plugin admin scripts were written for full page loads: they bind `DOMContentLoaded`, add
 * document/window level listeners, `jQuery( document ).on()` handlers and timers. When a view is
 * replaced in place those would stay bound (and double-bind once the script re-runs).
 *
 * While a *view script* runs (or a callback it registered), this module records every global
 * listener, jQuery global handler and timer it creates, so `teardown()` can remove exactly those
 * before the next view. Listeners on elements inside the swapped area need no tracking: they are
 * garbage collected together with the old DOM.
 *
 * @package DevDiggers\Framework
 */

import { isViewScript } from './handles';

const nativeAddEventListener    = EventTarget.prototype.addEventListener;
const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
const nativeSetTimeout          = window.setTimeout;
const nativeSetInterval         = window.setInterval;
const nativeClearTimeout        = window.clearTimeout;
const nativeClearInterval       = window.clearInterval;

let generation   = 1;
let contextDepth = 0;
let deferReady   = false;
let ledger       = [];
let readyQueue   = [];
const wrappedReadyListeners = new WeakMap();

/**
 * Whether the currently executing code belongs to the active view.
 *
 * @return {boolean} True inside view context.
 */
const inViewContext = () => contextDepth > 0 || isViewScript( document.currentScript );

/**
 * Whether the target outlives view swaps.
 *
 * @param {*} target Event target.
 * @return {boolean} True for document, window, html and body.
 */
const isGlobalTarget = ( target ) => target === document || target === window || target === document.documentElement || target === document.body;

/**
 * Run a function inside view context.
 *
 * @param {Function} fn   Function.
 * @param {*}        self This value.
 * @param {Array}    args Arguments.
 * @return {*} Function result.
 */
export const runInViewContext = ( fn, self, args = [] ) => {
	contextDepth++;

	try {
		return fn.apply( self, args );
	} finally {
		contextDepth--;
	}
};

/**
 * Wrap a callback so it executes inside view context.
 *
 * @param {Function|Object} listener Callback or EventListener object.
 * @return {Function} Wrapped callback.
 */
const wrapInViewContext = ( listener ) => function( ...args ) {
	return runInViewContext( 'function' === typeof listener ? listener : listener.handleEvent, 'function' === typeof listener ? this : listener, args );
};

/**
 * Report a view callback error the same way the browser does on a full page load, without
 * aborting the remaining callbacks.
 *
 * @param {Error} error Thrown error.
 */
const reportError = ( error ) => {
	nativeSetTimeout( () => {
		throw error;
	} );
};

/**
 * Patch global listener and timer APIs. Called once, before any plugin script runs.
 *
 * @return {void}
 */
export const install = () => {
	EventTarget.prototype.addEventListener = function( type, listener, options ) {
		// A persistent script loaded by a soft visit (for example the editor scripts) waits for an
		// event that already fired: run it once the pass ends, without tracking it.
		if ( deferReady && listener && ! inViewContext() && ( ( 'DOMContentLoaded' === type && this === document ) || ( 'load' === type && this === window ) ) ) {
			readyQueue.push( () => ( 'function' === typeof listener ? listener.call( this, new Event( type ) ) : listener.handleEvent( new Event( type ) ) ) );
			return undefined;
		}

		if ( ! listener || ! isGlobalTarget( this ) || ! inViewContext() ) {
			return nativeAddEventListener.call( this, type, listener, options );
		}

		const isReadyEvent = ( 'DOMContentLoaded' === type && this === document ) || ( 'load' === type && this === window );

		if ( isReadyEvent ) {
			const wrapped = wrapInViewContext( listener );

			if ( deferReady ) {
				// Soft visit: the document is long past ready, so fire once the view scripts ran.
				readyQueue.push( () => wrapped.call( this, new Event( type ) ) );
				return undefined;
			}

			wrappedReadyListeners.set( listener, wrapped );

			return nativeAddEventListener.call( this, type, wrapped, options );
		}

		const capture = 'boolean' === typeof options ? options : !! ( options && options.capture );

		ledger.push( () => nativeRemoveEventListener.call( this, type, listener, capture ) );

		return nativeAddEventListener.call( this, type, listener, options );
	};

	EventTarget.prototype.removeEventListener = function( type, listener, options ) {
		const wrapped = listener && wrappedReadyListeners.get( listener );

		return nativeRemoveEventListener.call( this, type, wrapped || listener, options );
	};

	window.setTimeout = function( handler, timeout, ...args ) {
		if ( 'function' !== typeof handler || ! inViewContext() ) {
			return nativeSetTimeout.call( window, handler, timeout, ...args );
		}

		const id = nativeSetTimeout.call( window, wrapInViewContext( handler ), timeout, ...args );

		// Zero-delay timers (jQuery ready, microtask-like deferrals) finish before any teardown.
		if ( timeout > 0 ) {
			ledger.push( () => nativeClearTimeout.call( window, id ) );
		}

		return id;
	};

	window.setInterval = function( handler, timeout, ...args ) {
		if ( 'function' !== typeof handler || ! inViewContext() ) {
			return nativeSetInterval.call( window, handler, timeout, ...args );
		}

		const id = nativeSetInterval.call( window, wrapInViewContext( handler ), timeout, ...args );

		ledger.push( () => nativeClearInterval.call( window, id ) );

		return id;
	};

	patchJQuery();
};

/**
 * Namespace jQuery handlers bound on global targets from view context, so they can be removed
 * with a single `.off( '.ddfwv{generation}' )`.
 *
 * @return {void}
 */
const patchJQuery = () => {
	const $ = window.jQuery;

	if ( ! $ || ! $.fn || $.fn.ddfwTurboPatched ) {
		return;
	}

	const namespaceTypes = ( types ) => types.split( /\s+/ ).filter( Boolean ).map( ( type ) => `${ type }.ddfwv${ generation }` ).join( ' ' );

	[ 'on', 'one' ].forEach( ( method ) => {
		const original = $.fn[ method ];

		$.fn[ method ] = function( types, ...rest ) {
			if ( ! inViewContext() || ! this.toArray().some( isGlobalTarget ) ) {
				return original.call( this, types, ...rest );
			}

			if ( 'string' === typeof types ) {
				types = namespaceTypes( types );
			} else if ( types && 'object' === typeof types ) {
				types = Object.keys( types ).reduce( ( map, key ) => {
					map[ namespaceTypes( key ) ] = types[ key ];
					return map;
				}, {} );
			}

			const namespace = `.ddfwv${ generation }`;
			const targets   = this;

			ledger.push( () => $( targets ).off( namespace ) );

			return original.call( this, types, ...rest );
		};
	} );

	$.fn.ddfwTurboPatched = true;
};

/**
 * Remove everything the previous view registered and open a new generation.
 *
 * @return {void}
 */
export const teardown = () => {
	const entries = ledger;

	ledger     = [];
	readyQueue = [];

	entries.reverse().forEach( ( remove ) => {
		try {
			remove();
		} catch ( error ) {
			reportError( error );
		}
	} );

	generation++;
};

/**
 * Start collecting DOMContentLoaded/load callbacks instead of binding them.
 *
 * @return {void}
 */
export const beginScriptPass = () => {
	deferReady = true;
	readyQueue = [];
};

/**
 * Stop collecting and fire the collected ready callbacks in registration order.
 *
 * @return {void}
 */
export const flushReadyQueue = () => {
	deferReady = false;

	const queue = readyQueue;
	readyQueue  = [];

	queue.forEach( ( callback ) => {
		try {
			callback();
		} catch ( error ) {
			reportError( error );
		}
	} );
};

/**
 * Current view generation, stamped on re-executed scripts.
 *
 * @return {number} Generation.
 */
export const getGeneration = () => generation;
