<?php
/**
 * This file handles all admin end action callbacks.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Includes\Admin;

use DDWCHidePriceForGuest\Includes\DDWCHPG_File_Handler;
use DDWCHidePriceForGuest\Helper\Dashboard\DDWCHPG_Dashboard_Helper;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Admin_Functions' ) ) {
	/**
	 * Admin Functions Class
	 */
	class DDWCHPG_Admin_Functions {
		/**
		 * Settings per group: key => type and sanitize callback.
		 *
		 * The setup wizard saves through the same list, so it can only write these options.
		 *
		 * @return array
		 */
		public static function ddwchpg_get_setting_groups() {
			$checkbox = [
				'type'              => 'string',
				'sanitize_callback' => [ __CLASS__, 'ddwchpg_sanitize_checkbox' ],
			];
			$ids      = [
				'type'              => 'array',
				'sanitize_callback' => [ __CLASS__, 'ddwchpg_sanitize_ids' ],
			];
			$text     = [
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			];
			$color    = [
				'type'              => 'string',
				'sanitize_callback' => [ __CLASS__, 'ddwchpg_sanitize_color' ],
			];

			return [
				'ddwchpg-configuration-general-fields' => [
					'enabled'              => $checkbox,
					'target_roles'         => [
						'type'              => 'array',
						'sanitize_callback' => [ __CLASS__, 'ddwchpg_sanitize_roles' ],
					],
					'hide_mode'            => [
						'type'              => 'string',
						'sanitize_callback' => [ __CLASS__, 'ddwchpg_sanitize_hide_mode' ],
					],
					'hide_scope'           => [
						'type'              => 'string',
						'sanitize_callback' => [ __CLASS__, 'ddwchpg_sanitize_hide_scope' ],
					],
					'allowed_products'     => $ids,
					'allowed_categories'   => $ids,
					'excluded_products'    => $ids,
					'excluded_categories'  => $ids,
					'block_purchase'       => $checkbox,
					'hide_structured_data' => $checkbox,
					'hide_store_api'       => $checkbox,
					'enable_tracking'      => $checkbox,
				],
				'ddwchpg-configuration-display-fields' => [
					'price_title'      => [
						'type'              => 'string',
						'sanitize_callback' => 'wp_kses_post',
					],
					'button_action'    => [
						'type'              => 'string',
						'sanitize_callback' => [ __CLASS__, 'ddwchpg_sanitize_button_action' ],
					],
					'button_title'     => $text,
					'login_popup'      => $checkbox,
					'custom_url'       => [
						'type'              => 'string',
						'sanitize_callback' => 'esc_url_raw',
					],
					'price_text_color' => $color,
					'price_bg_color'   => $color,
					'button_class'     => $text,
				],
			];
		}

		/**
		 * Register settings
		 *
		 * @return void
		 */
		public function ddwchpg_register_settings_options() {
			foreach ( self::ddwchpg_get_setting_groups() as $group => $settings ) {
				// Whoever can open the settings screen (shop managers too) can save it.
				add_filter( 'option_page_capability_' . $group, 'ddfw_get_menu_capability' );

				foreach ( $settings as $key => $args ) {
					register_setting(
						$group,
						DDWCHPG_File_Handler::ddwchpg_get_option_name( $key ),
						[
							'type'              => $args['type'],
							'sanitize_callback' => $args['sanitize_callback'],
						]
					);
				}
			}
		}

		/**
		 * Sanitize a checkbox: 'yes' or ''.
		 *
		 * @param mixed $value Raw value.
		 * @return string
		 */
		public static function ddwchpg_sanitize_checkbox( $value ) {
			return 'yes' === $value ? 'yes' : '';
		}

		/**
		 * Sanitize a list of product or term IDs.
		 *
		 * @param mixed $value Raw value.
		 * @return array
		 */
		public static function ddwchpg_sanitize_ids( $value ) {
			return array_values( array_filter( array_map( 'strval', array_map( 'absint', (array) $value ) ) ) );
		}

		/**
		 * Sanitize the audience: only guests and roles that exist.
		 *
		 * @param mixed $value Raw value.
		 * @return array
		 */
		public static function ddwchpg_sanitize_roles( $value ) {
			$allowed = array_merge( [ 'ddwchpg_guest' ], array_keys( wp_roles()->get_names() ) );

			return array_values( array_intersect( array_map( 'sanitize_key', (array) $value ), $allowed ) );
		}

		/**
		 * Sanitize "What to Hide".
		 *
		 * @param mixed $value Raw value.
		 * @return string
		 */
		public static function ddwchpg_sanitize_hide_mode( $value ) {
			return 'cart' === $value ? 'cart' : 'price';
		}

		/**
		 * Sanitize "Hide Prices On".
		 *
		 * @param mixed $value Raw value.
		 * @return string
		 */
		public static function ddwchpg_sanitize_hide_scope( $value ) {
			return 'selected' === $value ? 'selected' : 'all';
		}

		/**
		 * Sanitize the replacement button action.
		 *
		 * @param mixed $value Raw value.
		 * @return string
		 */
		public static function ddwchpg_sanitize_button_action( $value ) {
			return in_array( $value, [ 'login', 'custom_url', 'none' ], true ) ? $value : 'login';
		}

		/**
		 * Sanitize a hex colour, '' when empty or invalid.
		 *
		 * @param mixed $value Raw value.
		 * @return string
		 */
		public static function ddwchpg_sanitize_color( $value ) {
			return (string) sanitize_hex_color( $value );
		}

		/**
		 * Drop the cached coverage scan whenever a plugin option changes.
		 *
		 * @param string $option Option name.
		 * @return void
		 */
		public function ddwchpg_maybe_flush_coverage( $option ) {
			if ( 0 === strpos( $option, '_ddwchpg_' ) ) {
				DDWCHPG_Dashboard_Helper::ddwchpg_flush_coverage();
			}
		}

		/**
		 * Drop the coverage cache when a product is saved.
		 *
		 * @return void
		 */
		public function ddwchpg_flush_coverage_on_product_save() {
			DDWCHPG_Dashboard_Helper::ddwchpg_flush_coverage();
		}

		/**
		 * Per-product visibility override in the product General tab.
		 *
		 * @return void
		 */
		public function ddwchpg_add_product_visibility_field() {
			echo '<div class="options_group ddwchpg-product-options">';

			woocommerce_wp_select(
				[
					'id'          => '_ddwchpg_visibility',
					'label'       => esc_html__( 'Price visibility', 'devdiggers-hide-price-for-woocommerce' ),
					'desc_tip'    => true,
					'description' => esc_html__( 'Override DevDiggers Hide Price for this product. "Always hide" and "Always show" win over every other setting.', 'devdiggers-hide-price-for-woocommerce' ),
					'options'     => [
						''     => esc_html__( 'Follow plugin settings', 'devdiggers-hide-price-for-woocommerce' ),
						'hide' => esc_html__( 'Always hide price', 'devdiggers-hide-price-for-woocommerce' ),
						'show' => esc_html__( 'Always show price', 'devdiggers-hide-price-for-woocommerce' ),
					],
				]
			);

			echo '</div>';
		}

		/**
		 * Save the per-product override.
		 *
		 * @param \WC_Product $product Product.
		 * @return void
		 */
		public function ddwchpg_save_product_visibility_field( $product ) {
			$nonce = isset( $_POST['woocommerce_meta_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['woocommerce_meta_nonce'] ) ) : '';

			if ( ! wp_verify_nonce( $nonce, 'woocommerce_save_data' ) || ! current_user_can( 'edit_product', $product->get_id() ) ) {
				return;
			}

			$value = isset( $_POST['_ddwchpg_visibility'] ) ? sanitize_key( wp_unslash( $_POST['_ddwchpg_visibility'] ) ) : '';

			if ( in_array( $value, [ 'hide', 'show' ], true ) ) {
				$product->update_meta_data( '_ddwchpg_visibility', $value );
			} else {
				$product->delete_meta_data( '_ddwchpg_visibility' );
			}
		}
	}
}
