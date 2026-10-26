<?php
/**
 * File handler
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Includes;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_File_Handler' ) ) {
	/**
	 * File handler class
	 */
	class DDWCHPG_File_Handler {
		/**
		 * Configuration Variable
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Constructor
		 */
		public function __construct() {
			$this->ddwchpg_configuration = self::ddwchpg_set_globals();

			if ( is_admin() ) {
				new DDWCHPG_Admin_Dashboard( $this->ddwchpg_configuration );
				new Admin\DDWCHPG_Admin_Hooks();
				new Admin\DDWCHPG_Setup_Wizard( $this->ddwchpg_configuration );
			}

			if ( empty( $this->ddwchpg_configuration['enabled'] ) ) {
				return;
			}

			if ( 'yes' === $this->ddwchpg_configuration['enable_tracking'] ) {
				new Front\DDWCHPG_Front_Ajax_Hooks();
			}

			// Storefront requests, including admin-ajax, which quick-view plugins use to render products.
			if ( ! is_admin() || wp_doing_ajax() ) {
				new Front\DDWCHPG_Front_Hooks( $this->ddwchpg_configuration );
			}
		}

		/**
		 * Default value of every option, keyed by configuration key.
		 *
		 * The option name is `_ddwchpg_{key}`, except where mapped in ddwchpg_get_option_name().
		 * Keys are shared with the Pro edition, so upgrading keeps every setting: Pro turns
		 * hide_scope, allowed_products and allowed_categories into its first rule.
		 *
		 * @return array
		 */
		public static function ddwchpg_get_defaults() {
			return [
				// General.
				'enabled'              => '',
				'target_roles'         => [ 'ddwchpg_guest' ],
				'hide_mode'            => 'price',
				'hide_scope'           => 'all',
				'allowed_products'     => [],
				'allowed_categories'   => [],
				'excluded_products'    => [],
				'excluded_categories'  => [],
				'block_purchase'       => 'yes',
				'hide_structured_data' => 'yes',
				'hide_store_api'       => 'yes',
				'enable_tracking'      => 'yes',
				// Display.
				'price_title'          => esc_html__( 'Login to view price', 'devdiggers-hide-price-for-woocommerce' ),
				'button_title'         => esc_html__( 'Login to purchase', 'devdiggers-hide-price-for-woocommerce' ),
				'button_action'        => 'login',
				'custom_url'           => '',
				'login_popup'          => 'yes',
				'price_text_color'     => '#0256ff',
				'price_bg_color'       => '#e8f0ff',
				'button_class'         => '',
			];
		}

		/**
		 * Option name for a configuration key.
		 *
		 * @param string $key Configuration key.
		 * @return string
		 */
		public static function ddwchpg_get_option_name( $key ) {
			return 'enabled' === $key ? '_ddwchpg_enable_hide_price' : '_ddwchpg_' . $key;
		}

		/**
		 * Set globals function
		 *
		 * @return array
		 */
		public static function ddwchpg_set_globals() {
			$configuration = [];

			// Text settings saved empty fall back to their default so the storefront never shows a blank label.
			$text_keys = [ 'price_title', 'button_title' ];

			foreach ( self::ddwchpg_get_defaults() as $key => $default ) {
				$value = get_option( self::ddwchpg_get_option_name( $key ), $default );

				$configuration[ $key ] = ( '' === $value && in_array( $key, $text_keys, true ) ) ? $default : $value;
			}

			// A Pro-only action saved before a downgrade falls back to the login button.
			if ( ! in_array( $configuration['button_action'], [ 'login', 'custom_url', 'none' ], true ) ) {
				$configuration['button_action'] = 'login';
			}

			return $configuration;
		}
	}
}
