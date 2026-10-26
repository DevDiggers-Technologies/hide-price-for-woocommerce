( function() {
	'use strict';

	document.addEventListener( 'click', function( event ) {
		const dismissButton = event.target.closest( '.notice-dismiss' );

		if ( ! dismissButton ) {
			return;
		}

		const notice = dismissButton.closest( '.ddfw-notification-dismissible' );

		if ( ! notice ) {
			return;
		}

		const formData = new FormData();
		formData.append( 'action', 'ddfw_dismiss_notification' );
		formData.append( 'id', notice.getAttribute( 'data-id' ) || '' );
		formData.append( 'slug', notice.getAttribute( 'data-slug' ) || '' );
		formData.append( 'nonce', notice.getAttribute( 'data-nonce' ) || '' );

		fetch( ajaxurl, {
			method: 'POST',
			body: formData,
		} );
	} );
}() );
