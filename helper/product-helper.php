<?php
/**
 * Product Helper class.
 *
 * Owns the visibility decision: who is viewing and whether a product's price is hidden
 * (per-product override > exclusions > the "Hide Prices On" scope).
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Helper;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Product_Helper' ) ) {
	/**
	 * Product Helper class
	 */
	class DDWCHPG_Product_Helper {
		/**
		 * Pseudo role key used for logged-out visitors.
		 */
		const GUEST_ROLE = 'ddwchpg_guest';

		/**
		 * Configuration array
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Per-request cache of the decision, keyed by "viewer|product ID".
		 *
		 * @var array
		 */
		protected static $cache = [];

		/**
		 * Per-request cache of the visitor's role keys.
		 *
		 * @var array|null
		 */
		protected static $viewer_roles = null;

		/**
		 * Constructor
		 *
		 * @param array $ddwchpg_configuration Configuration array.
		 */
		public function __construct( $ddwchpg_configuration = [] ) {
			$this->ddwchpg_configuration = $ddwchpg_configuration;
		}

		/**
		 * Clear the per-request caches.
		 *
		 * @return void
		 */
		public static function ddwchpg_flush_cache() {
			self::$cache        = [];
			self::$viewer_roles = null;
		}

		/**
		 * Whether the price of this product is hidden for the current visitor.
		 *
		 * @param mixed $product Product.
		 * @return bool
		 */
		public function ddwchpg_check_product_to_hide_price( $product ) {
			return '' !== $this->ddwchpg_get_hide_reason( $product );
		}

		/**
		 * Why this product's price is hidden: 'override', 'all', 'selected', or '' when it shows.
		 *
		 * @param mixed $product      Product.
		 * @param bool  $check_viewer False to ignore who is viewing (coverage scan).
		 * @return string
		 */
		public function ddwchpg_get_hide_reason( $product, $check_viewer = true ) {
			if ( ! $product instanceof \WC_Product || empty( $this->ddwchpg_configuration['enabled'] ) ) {
				return '';
			}

			if ( $check_viewer && ! $this->ddwchpg_is_viewer_targeted() ) {
				return '';
			}

			$cache_key = ( $check_viewer ? 'v' : 'a' ) . '|' . $product->get_id();

			if ( ! array_key_exists( $cache_key, self::$cache ) ) {
				/**
				 * Filter why a product's price is hidden. Return '' to show the price.
				 *
				 * @since 1.0.0
				 */
				self::$cache[ $cache_key ] = (string) apply_filters( 'ddwchpg_hide_reason', $this->ddwchpg_resolve_reason( $product ), $product, $check_viewer );
			}

			return self::$cache[ $cache_key ];
		}

		/**
		 * Resolve the reason without caching.
		 *
		 * @param \WC_Product $product Product.
		 * @return string
		 */
		protected function ddwchpg_resolve_reason( $product ) {
			$config    = $this->ddwchpg_configuration;
			$parent_id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
			$ids       = array_map( 'strval', [ $product->get_id(), $parent_id ] );
			$override  = get_post_meta( $parent_id, '_ddwchpg_visibility', true );

			if ( 'show' === $override ) {
				return '';
			}

			if ( 'hide' === $override ) {
				return 'override';
			}

			if ( array_intersect( $ids, array_map( 'strval', (array) $config['excluded_products'] ) ) ) {
				return '';
			}

			$categories = array_map( 'strval', wc_get_product_term_ids( $parent_id, 'product_cat' ) );

			if ( array_intersect( $categories, array_map( 'strval', (array) $config['excluded_categories'] ) ) ) {
				return '';
			}

			if ( 'all' === $config['hide_scope'] ) {
				return 'all';
			}

			if ( array_intersect( $ids, array_map( 'strval', (array) $config['allowed_products'] ) ) || array_intersect( $categories, array_map( 'strval', (array) $config['allowed_categories'] ) ) ) {
				return 'selected';
			}

			return '';
		}

		/**
		 * Whether prices can be hidden from this visitor at all.
		 *
		 * Lets the front end skip hooking anything for visitors who always see prices.
		 *
		 * @return bool
		 */
		public function ddwchpg_is_viewer_targeted() {
			if ( empty( $this->ddwchpg_configuration['enabled'] ) ) {
				return false;
			}

			if ( null === self::$viewer_roles ) {
				self::$viewer_roles = is_user_logged_in() ? (array) wp_get_current_user()->roles : [ self::GUEST_ROLE ];
			}

			/**
			 * Filter whether the current visitor can have prices hidden.
			 *
			 * @since 1.0.0
			 */
			return (bool) apply_filters( 'ddwchpg_is_viewer_targeted', (bool) array_intersect( self::$viewer_roles, (array) $this->ddwchpg_configuration['target_roles'] ) );
		}
	}
}
