/**
 * Dashboard JavaScript functionality for DevDiggers Framework
 */

import './dashboard.less';

// const ddfw = jQuery.noConflict();

document.addEventListener('DOMContentLoaded', () => {
    // Newsletter form submission
    const newsletterForm = document.querySelector( '.ddfw-newsletter-form' );
    if ( newsletterForm ) {
        newsletterForm.addEventListener( 'submit', e => {
            e.preventDefault();
            const formData       = new FormData( newsletterForm );
            const email          = formData.get( 'email' );
            const submitButton   = document.getElementById( 'ddfw-newsletter-submit' );
            const messageElement = document.getElementById( 'ddfw-newsletter-message' );

            // Clear previous messages
            messageElement.textContent = '';
            messageElement.className = 'ddfw-newsletter-message';

            // Disable button
            submitButton.disabled = true;
            submitButton.textContent = ddfwDashboardObject.i18n.subscribing || 'Subscribing...';

            fetch( ddfwDashboardObject.ajax.ajaxUrl, {
                method : 'POST',
                headers: new Headers( {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept'      : 'application/json',
                } ),
                body: `action=ddfw_newsletter_subscribe&nonce=${ddfwDashboardObject.ajax.ajaxNonce}&email=${encodeURIComponent( email )}`,
            })
            .then( response => response.json() )
            .then( response => {
                submitButton.disabled = false;
                submitButton.textContent = ddfwDashboardObject.i18n.subscribe || 'Subscribe';

                if ( response.success ) {
                    messageElement.textContent = response.data.message;
                    messageElement.classList.add( 'ddfw-newsletter-success' );
                    newsletterForm.reset();
                    // Reload page to show thank you message
                    setTimeout( () => {
                        window.location.reload();
                    }, 2000 );
                } else {
                    messageElement.textContent = response.data.message;
                    messageElement.classList.add( 'ddfw-newsletter-error' );
                }
            } )
            .catch( err => {
                submitButton.disabled = false;
                submitButton.textContent = ddfwDashboardObject.i18n.subscribe || 'Subscribe';
                console.log( err );
                messageElement.textContent = ddfwDashboardObject.i18n.subscriptionError || 'An error occurred. Please try again.';
                messageElement.classList.add( 'ddfw-newsletter-error' );
            } );
        } );
    }
});
