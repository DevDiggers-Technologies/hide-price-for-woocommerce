<?php
/**
 * Click counters behind the dashboard.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Helper;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Stats_Helper' ) ) {
	/**
	 * Counts clicks on the button that replaces add to cart.
	 *
	 * Ponytail: one non-autoloaded option, read-modify-write. Two clicks in the same instant can
	 * lose one count, which is fine for a trend line; move to a table with atomic increments if a
	 * store ever needs exact figures.
	 */
	class DDWCHPG_Stats_Helper {
		/**
		 * Option holding the counters.
		 */
		const OPTION = 'ddwchpg_click_stats';

		/**
		 * Days of history kept.
		 */
		const KEEP_DAYS = 400;

		/**
		 * Products kept in the per-product tally, busiest first.
		 */
		const KEEP_PRODUCTS = 200;

		/**
		 * Count one click.
		 *
		 * @param int $product_id Product ID.
		 * @return void
		 */
		public static function record_click( $product_id ) {
			if ( 'yes' !== get_option( '_ddwchpg_enable_tracking', 'yes' ) ) {
				return;
			}

			$stats      = self::get();
			$day        = current_time( 'Y-m-d' );
			$product_id = absint( $product_id );

			$stats['days'][ $day ]            = ( isset( $stats['days'][ $day ] ) ? (int) $stats['days'][ $day ] : 0 ) + 1;
			$stats['products'][ $product_id ] = ( isset( $stats['products'][ $product_id ] ) ? (int) $stats['products'][ $product_id ] : 0 ) + 1;

			// Keys are Y-m-d, so a string sort is a date sort.
			ksort( $stats['days'] );
			$stats['days'] = array_slice( $stats['days'], -self::KEEP_DAYS, null, true );

			arsort( $stats['products'] );
			$stats['products'] = array_slice( $stats['products'], 0, self::KEEP_PRODUCTS, true );

			update_option( self::OPTION, $stats, false );
		}

		/**
		 * Everything recorded so far.
		 *
		 * @return array days (Y-m-d => clicks), products (ID => clicks).
		 */
		public static function get() {
			$stats = get_option( self::OPTION, [] );

			return [
				'days'     => isset( $stats['days'] ) && is_array( $stats['days'] ) ? $stats['days'] : [],
				'products' => isset( $stats['products'] ) && is_array( $stats['products'] ) ? $stats['products'] : [],
			];
		}

		/**
		 * Clicks per day between two dates, inclusive.
		 *
		 * @param string $from Y-m-d.
		 * @param string $to   Y-m-d.
		 * @return array Y-m-d => clicks.
		 */
		public static function get_range( $from, $to ) {
			return array_filter(
				self::get()['days'],
				function ( $day ) use ( $from, $to ) {
					return $day >= $from && $day <= $to;
				},
				ARRAY_FILTER_USE_KEY
			);
		}
	}
}
