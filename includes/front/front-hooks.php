<?php
/**
 * This file handles all front end action hooks.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Includes\Front;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Front_Hooks' ) ) {
	/**
	 * Handles Front Hooks
	 */
	class DDWCHPG_Front_Hooks extends DDWCHPG_Front_Functions {
		/**
		 * Construct
		 *
		 * @param array $ddwchpg_configuration Configuration.
		 */
		public function __construct( $ddwchpg_configuration ) {
			parent::__construct( $ddwchpg_configuration );

			// Runs during the login request itself, before the visitor is known.
			add_filter( 'woocommerce_login_redirect', [ $this, 'ddwchpg_change_my_account_redirect_url' ] );
			add_filter( 'woocommerce_registration_redirect', [ $this, 'ddwchpg_change_my_account_redirect_url' ] );

			// Everything below only matters for visitors in the configured audience.
			if ( ! $this->product_helper->ddwchpg_is_viewer_targeted() ) {
				return;
			}

			// "Add to cart only" keeps prices on show and only takes the purchase away.
			$hide_price = 'cart' !== $ddwchpg_configuration['hide_mode'];

			if ( $hide_price ) {
				add_filter( 'woocommerce_get_price_html', [ $this, 'ddwchpg_remove_price_from_the_site' ], 99, 2 );
			}

			add_filter( 'woocommerce_loop_add_to_cart_link', [ $this, 'ddwchpg_remove_add_to_cart_button' ], 99, 2 );
			add_action( 'woocommerce_single_product_summary', [ $this, 'ddwchpg_remove_single_add_to_cart_button' ], 1 );

			// Block themes render the form through these blocks and never fire the summary hook.
			add_filter( 'render_block_woocommerce/add-to-cart-form', [ $this, 'ddwchpg_filter_add_to_cart_block' ], 10, 3 );
			add_filter( 'render_block_woocommerce/add-to-cart-with-options', [ $this, 'ddwchpg_filter_add_to_cart_block' ], 10, 3 );
			add_filter( 'woocommerce_available_variation', [ $this, 'ddwchpg_filter_available_variation' ], 99, 3 );
			add_action( 'wp_footer', [ $this, 'ddwchpg_render_modals' ] );
			add_action( 'wp_enqueue_scripts', [ $this, 'ddwchpg_enqueue_scripts_front' ] );

			if ( 'yes' === $ddwchpg_configuration['block_purchase'] ) {
				add_filter( 'woocommerce_is_purchasable', [ $this, 'ddwchpg_make_product_unpurchasable' ], 99, 2 );
				add_filter( 'woocommerce_variation_is_purchasable', [ $this, 'ddwchpg_make_product_unpurchasable' ], 99, 2 );
			}

			if ( $hide_price && 'yes' === $ddwchpg_configuration['hide_structured_data'] ) {
				add_filter( 'woocommerce_structured_data_product', [ $this, 'ddwchpg_filter_structured_data' ], 99, 2 );
			}

			if ( $hide_price && 'yes' === $ddwchpg_configuration['hide_store_api'] ) {
				add_filter( 'rest_post_dispatch', [ $this, 'ddwchpg_filter_store_api_response' ], 99, 3 );
			}
		}
	}
}
