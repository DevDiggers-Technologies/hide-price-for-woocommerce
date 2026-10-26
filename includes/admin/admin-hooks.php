<?php
/**
 * This file handles all admin end action hooks.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Includes\Admin;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Admin_Hooks' ) ) {
	/**
	 * Handles Admin Hooks
	 */
	class DDWCHPG_Admin_Hooks extends DDWCHPG_Admin_Functions {
		/**
		 * Construct
		 */
		public function __construct() {
			add_action( 'admin_init', [ $this, 'ddwchpg_register_settings_options' ] );
			add_action( 'updated_option', [ $this, 'ddwchpg_maybe_flush_coverage' ] );
			add_action( 'added_option', [ $this, 'ddwchpg_maybe_flush_coverage' ] );
			add_action( 'save_post_product', [ $this, 'ddwchpg_flush_coverage_on_product_save' ] );
			add_action( 'woocommerce_product_options_general_product_data', [ $this, 'ddwchpg_add_product_visibility_field' ] );
			add_action( 'woocommerce_admin_process_product_object', [ $this, 'ddwchpg_save_product_visibility_field' ] );
		}
	}
}
