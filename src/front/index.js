'use strict';

import './front.less';

( $ => {
	const { ajaxUrl, nonce, tracking } = window.ddwchpgFrontObject || {};

	// Count one click per product per browser tab. Nothing is stored on the server but the count.
	const trackClick = productId => {
		if ( ! tracking || ! productId ) {
			return;
		}

		const key = `ddwchpg_click_${ productId }`;
		try {
			if ( sessionStorage.getItem( key ) ) {
				return;
			}
			sessionStorage.setItem( key, '1' );
		} catch ( e ) {}

		const body = new FormData();
		body.append( 'action', 'ddwchpg_track_click' );
		body.append( 'nonce', nonce );
		body.append( 'product_id', productId );
		if ( ! ( navigator.sendBeacon && navigator.sendBeacon( ajaxUrl, body ) ) ) {
			fetch( ajaxUrl, { method: 'POST', credentials: 'same-origin', body } ).catch( () => {} );
		}
	};

	let lastFocus = null;

	const closeModal = modal => {
		modal.hidden = true;
		document.body.classList.remove( 'ddwchpg-modal-open' );
		if ( lastFocus ) {
			lastFocus.focus();
		}
	};

	$( document ).on( 'click', '.ddwchpg-button', function ( e ) {
		trackClick( this.dataset.productId );

		const modal = 'login' === this.dataset.ddwchpgModal && document.getElementById( 'ddwchpg-modal-login' );
		if ( ! modal ) {
			return;
		}
		e.preventDefault();

		const redirect = modal.querySelector( 'input[name="redirect"]' );
		if ( redirect ) {
			redirect.value = this.dataset.redirect;
		}

		lastFocus = this;
		modal.hidden = false;
		document.body.classList.add( 'ddwchpg-modal-open' );
		const field = modal.querySelector( 'input:not([type=hidden])' );
		if ( field ) {
			field.focus();
		}
	} );

	$( document ).on( 'click', '[data-ddwchpg-close]', function () {
		closeModal( this.closest( '.ddwchpg-modal' ) );
	} );

	$( document ).on( 'keydown', e => {
		const open = document.querySelector( '.ddwchpg-modal:not([hidden])' );
		if ( open && 'Escape' === e.key ) {
			closeModal( open );
		}
	} );

	// Protected variations: WooCommerce disables the add to cart button; hide it so only
	// the replacement button shows.
	$( document ).on( 'found_variation', '.variations_form', function ( e, variation ) {
		$( this ).find( '.woocommerce-variation-add-to-cart' ).toggle( ! variation.ddwchpg_hidden );
	} );
	$( document ).on( 'reset_data', '.variations_form', function () {
		$( this ).find( '.woocommerce-variation-add-to-cart' ).show();
	} );
} )( jQuery );
