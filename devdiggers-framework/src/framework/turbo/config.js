/**
 * DDFW Turbo runtime configuration, localized by DDFW_Plugin_Dashboard as `ddfwTurboConfig`.
 *
 * @package DevDiggers\Framework
 */

const defaults = {
	enabled: false,
	page: '',
	prefix: '',
	viewHandles: [],
	loadableHandles: [],
	hardParams: [],
	prefetchParams: [],
	prefetch: true,
	transitions: true,
	dirtyGuard: true,
	licenseInterval: 30,
	i18n: {},
};

export const config = Object.assign( {}, defaults, window.ddfwTurboConfig || {} );

let debugEnabled = false;

try {
	debugEnabled = '1' === window.localStorage.getItem( 'ddfwTurboDebug' );
} catch ( e ) {
	debugEnabled = false;
}

/**
 * Debug logger, enabled with `localStorage.ddfwTurboDebug = 1`.
 *
 * @param {...*} args Values to log.
 */
export const log = ( ...args ) => {
	if ( debugEnabled ) {
		if ( 'full page load:' === args[ 0 ] ) {
			// Survives the navigation, so the reason can be read on the next page.
			try {
				window.sessionStorage.setItem( 'ddfwTurboLastFallback', JSON.stringify( { reason: args[ 1 ], url: args[ 2 ], time: Date.now() } ) );
			} catch ( e ) {
				// Storage unavailable.
			}
		}

		// eslint-disable-next-line no-console
		console.log( '%c[DDFW Turbo]', 'color:#0256ff;font-weight:600', ...args );
	}
};
