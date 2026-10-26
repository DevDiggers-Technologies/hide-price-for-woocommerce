/**
 * Integrations with WordPress core and bundled libraries whose state is not owned by view scripts.
 *
 * @package DevDiggers\Framework
 */

/**
 * Release resources held by the outgoing view.
 *
 * @param {Element} container Outgoing view container.
 * @return {void}
 */
export const unloadView = ( container ) => {
	const $ = window.jQuery;

	// Chart.js keeps a registry of instances bound to canvases (v3+: getChart(), v2: Chart.instances).
	if ( window.Chart ) {
		const charts = 'function' === typeof window.Chart.getChart
			? Array.from( container.querySelectorAll( 'canvas' ), ( canvas ) => window.Chart.getChart( canvas ) )
			: Object.values( window.Chart.instances || {} ).filter( ( chart ) => chart && chart.canvas && container.contains( chart.canvas ) );

		charts.forEach( ( chart ) => chart && chart.destroy() );
	}

	if ( $ && $.fn.select2 ) {
		$( container ).find( '.select2-hidden-accessible' ).each( function() {
			try {
				$( this ).select2( 'close' ).select2( 'destroy' );
			} catch ( e ) {
				// Already destroyed.
			}
		} );
	}

	// select2 and jQuery UI append dropdowns to <body>, outside the swapped area.
	document.querySelectorAll( 'body > .select2-container, body > .ui-datepicker, body > .ui-autocomplete' ).forEach( ( element ) => {
		if ( ! element.id || 'ui-datepicker-div' !== element.id ) {
			element.remove();
		}
	} );

	container.querySelectorAll( 'textarea.wp-editor-area' ).forEach( ( textarea ) => {
		const editor = window.tinymce && window.tinymce.get && window.tinymce.get( textarea.id );

		if ( editor ) {
			editor.remove();
		}

		// Quicktags keeps instances by textarea id; a returning view creates them again.
		if ( window.QTags && window.QTags.instances ) {
			delete window.QTags.instances[ textarea.id ];
		}

		if ( window.wpActiveEditor === textarea.id ) {
			window.wpActiveEditor = null;
		}
	} );

	if ( window.QTags && window.QTags.instances && window.QTags.instances[ '0' ] && ! window.QTags.instances[ window.QTags.instances[ '0' ].id ] ) {
		delete window.QTags.instances[ '0' ];
	}

	if ( window.wpLink && 'function' === typeof window.wpLink.close && document.querySelector( '#wp-link-wrap[style*="block"]' ) ) {
		window.wpLink.close( 'noReset' );
	}

	if ( 'function' === typeof window.tb_remove && document.getElementById( 'TB_window' ) ) {
		window.tb_remove();
	}

	if ( window.wp && window.wp.media && window.wp.media.frame && 'function' === typeof window.wp.media.frame.close ) {
		window.wp.media.frame.close();
	}
};

/**
 * Initialize the editors of the incoming view that core's footer init did not start. Core prints
 * the same init code for every view, so after the first editor view it is not re-run: this does
 * what it does, for the editors of this view only.
 *
 * @param {Element} container Incoming view container.
 * @return {void}
 */
export const initEditors = ( container ) => {
	const preInit = window.tinyMCEPreInit;

	if ( ! preInit || ! container.querySelector( '.wp-editor-wrap' ) ) {
		return;
	}

	const inView = ( id ) => {
		const textarea = document.getElementById( id );

		return textarea && container.contains( textarea );
	};

	Object.keys( preInit.mceInit || {} ).filter( inView ).forEach( ( id ) => {
		const wrap = document.getElementById( `wp-${ id }-wrap` );

		if ( window.tinymce && ! window.tinymce.get( id ) && ! preInit.mceInit[ id ].wp_skip_init && ( ( wrap && wrap.classList.contains( 'tmce-active' ) ) || ! ( preInit.qtInit || {} ).hasOwnProperty( id ) ) ) {
			window.tinymce.init( preInit.mceInit[ id ] );
		}

		window.wpActiveEditor = window.wpActiveEditor || id;
	} );

	if ( 'function' === typeof window.quicktags && window.QTags ) {
		const missing = Object.keys( preInit.qtInit || {} ).filter( ( id ) => inView( id ) && ! window.QTags.instances[ id ] );

		missing.forEach( ( id ) => window.quicktags( preInit.qtInit[ id ] ) );

		if ( missing.length ) {
			window.QTags._buttonsInit();
		}
	}
};

/**
 * Keep the two bulk action selectors of a list table in sync, like core's common.js does on load.
 *
 * @param {jQuery} topSelector    Top selector.
 * @param {jQuery} topSubmit      Top submit.
 * @param {jQuery} bottomSelector Bottom selector.
 * @param {jQuery} bottomSubmit   Bottom submit.
 * @return {void}
 */
const marryControls = ( topSelector, topSubmit, bottomSelector, bottomSubmit ) => {
	bottomSelector.on( 'change', function() {
		topSelector.val( window.jQuery( this ).val() );
	} );

	topSelector.on( 'change', function() {
		bottomSelector.val( window.jQuery( this ).val() );
	} );

	bottomSubmit.on( 'click', ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		topSubmit.trigger( 'click' );
	} );
};

/**
 * Re-run the element-bound parts of core admin scripts for the incoming view.
 *
 * @return {void}
 */
export const loadView = () => {
	const $ = window.jQuery;

	if ( ! $ ) {
		return;
	}

	if ( window.screenMeta && 'function' === typeof window.screenMeta.init ) {
		window.screenMeta.init();
	}

	if ( window.columns && 'function' === typeof window.columns.init ) {
		window.columns.init();
	}

	marryControls( $( '#bulk-action-selector-top' ), $( '#doaction' ), $( '#bulk-action-selector-bottom' ), $( '#doaction2' ) );

	// Adds the dismiss button to `.notice.is-dismissible` notices.
	$( document ).trigger( 'wp-notice-added' );
};
