( function() {
	'use strict';

	function dismissNotice( notice ) {
		notice.style.transition = 'opacity 0.5s';
		notice.style.opacity = '0';

		setTimeout( function() {
			notice.remove();
		}, 500 );
	}

	function bindNotice( notice ) {
		const buttons = notice.querySelectorAll( '.ddfw-review-notice-action' );

		buttons.forEach( function( button ) {
			button.addEventListener( 'click', function( event ) {
				const action = button.getAttribute( 'data-action' );
				const formData = new FormData();

				if ( button.getAttribute( 'data-open-review' ) !== 'true' ) {
					event.preventDefault();
				}

				formData.append( 'action', 'ddfw_dismiss_review_notice' );
				formData.append( 'dismiss_action', action );
				formData.append( 'prefix', notice.getAttribute( 'data-prefix' ) || '' );
				formData.append( 'nonce', notice.getAttribute( 'data-nonce' ) || '' );

				fetch( ajaxurl, {
					method: 'POST',
					body: formData,
				} )
					.then( function( response ) {
						return response.json();
					} )
					.then( function( data ) {
						if ( data.success ) {
							dismissNotice( notice );
						}
					} );
			} );
		} );
	}

	document.addEventListener( 'DOMContentLoaded', function() {
		document.querySelectorAll( '.ddfw-review-notice' ).forEach( bindNotice );
	} );
}() );
