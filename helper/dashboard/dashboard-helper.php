<?php
/**
 * Dashboard helper: builds every number the dashboard shows.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Helper\Dashboard;

use DDWCHidePriceForGuest\Helper\DDWCHPG_Product_Helper;
use DDWCHidePriceForGuest\Helper\DDWCHPG_Stats_Helper;
use DevDiggers\Framework\Includes\DDFW_Dashboard_Data;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Dashboard_Helper' ) ) {
	/**
	 * Dashboard helper class
	 */
	class DDWCHPG_Dashboard_Helper {
		/**
		 * Coverage cache transient.
		 */
		const COVERAGE_TRANSIENT = 'ddwchpg_coverage';

		/**
		 * Max products scanned for coverage. ponytail: one-shot scan, move to Action Scheduler if
		 * catalogs above this size need an exact number.
		 */
		const COVERAGE_LIMIT = 3000;

		/**
		 * Configuration
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Construct
		 *
		 * @param array $ddwchpg_configuration Configuration.
		 */
		public function __construct( $ddwchpg_configuration ) {
			$this->ddwchpg_configuration = $ddwchpg_configuration;
		}

		/**
		 * Drop the cached coverage scan.
		 *
		 * @return void
		 */
		public static function ddwchpg_flush_coverage() {
			delete_transient( self::COVERAGE_TRANSIENT );
		}

		/**
		 * Labels of the reasons a price is hidden.
		 *
		 * @return array
		 */
		public static function ddwchpg_get_reason_labels() {
			return [
				'all'      => esc_html__( 'All products', 'devdiggers-hide-price-for-woocommerce' ),
				'selected' => esc_html__( 'Selected products and categories', 'devdiggers-hide-price-for-woocommerce' ),
				'override' => esc_html__( 'Per-product setting', 'devdiggers-hide-price-for-woocommerce' ),
			];
		}

		/**
		 * How many published products are protected, and why.
		 *
		 * @return array total, protected, reasons (reason => count), truncated.
		 */
		public function ddwchpg_get_coverage() {
			$coverage = get_transient( self::COVERAGE_TRANSIENT );

			if ( is_array( $coverage ) ) {
				return $coverage;
			}

			$ids    = wc_get_products(
				[
					'status' => 'publish',
					'limit'  => self::COVERAGE_LIMIT + 1,
					'return' => 'ids',
				]
			);
			$helper = new DDWCHPG_Product_Helper( $this->ddwchpg_configuration );

			$coverage = [
				'total'     => min( count( $ids ), self::COVERAGE_LIMIT ),
				'protected' => 0,
				'reasons'   => [],
				'truncated' => count( $ids ) > self::COVERAGE_LIMIT,
			];

			foreach ( array_slice( $ids, 0, self::COVERAGE_LIMIT ) as $id ) {
				$product = wc_get_product( $id );
				$reason  = $helper->ddwchpg_get_hide_reason( $product, false );

				// Picked variations: the product counts as protected when any of them is hidden.
				if ( '' === $reason && $product && $product->is_type( 'variable' ) ) {
					foreach ( $product->get_children() as $child_id ) {
						$reason = $helper->ddwchpg_get_hide_reason( wc_get_product( $child_id ), false );

						if ( '' !== $reason ) {
							break;
						}
					}
				}

				if ( '' !== $reason ) {
					++$coverage['protected'];
					$coverage['reasons'][ $reason ] = ( $coverage['reasons'][ $reason ] ?? 0 ) + 1;
				}
			}

			DDWCHPG_Product_Helper::ddwchpg_flush_cache();
			arsort( $coverage['reasons'] );

			set_transient( self::COVERAGE_TRANSIENT, $coverage, 12 * HOUR_IN_SECONDS );

			return $coverage;
		}

		/**
		 * All dashboard data.
		 *
		 * @return array
		 */
		public function ddwchpg_get_dashboard_data() {
			$range     = DDFW_Dashboard_Data::get_date_range();
			$days      = max( 1, (int) round( ( strtotime( $range['to'] ) - strtotime( $range['from'] ) ) / DAY_IN_SECONDS ) + 1 );
			$prev_to   = gmdate( 'Y-m-d', strtotime( $range['from'] . ' -1 day' ) );
			$prev_from = gmdate( 'Y-m-d', strtotime( $prev_to . ' -' . ( $days - 1 ) . ' days' ) );

			$daily    = DDWCHPG_Stats_Helper::get_range( $range['from'], $range['to'] );
			$current  = array_sum( $daily );
			$previous = array_sum( DDWCHPG_Stats_Helper::get_range( $prev_from, $prev_to ) );

			// Null when the previous period had nothing to compare with.
			$change = $previous ? ( $current - $previous ) / $previous * 100 : null;

			return [
				'date_range'   => $range,
				'coverage'     => $this->ddwchpg_get_coverage(),
				'clicks'       => [
					'value'    => $current,
					'change'   => $change,
					'previous' => $previous,
				],
				'timeline'     => DDFW_Dashboard_Data::build_time_series( $range['from'], $range['to'], [ 'clicks' => $daily ] ),
				'top_products' => array_slice( DDWCHPG_Stats_Helper::get()['products'], 0, 5, true ),
				'checklist'    => $this->ddwchpg_get_checklist(),
			];
		}

		/**
		 * Setup steps and whether each is done.
		 *
		 * @return array
		 */
		protected function ddwchpg_get_checklist() {
			$config = $this->ddwchpg_configuration;
			$url    = admin_url( 'admin.php?page=ddwchpg-dashboard&menu=configuration' );

			return [
				[
					'title' => esc_html__( 'Turn price hiding on', 'devdiggers-hide-price-for-woocommerce' ),
					'desc'  => esc_html__( 'Prices stay public until the master switch is on.', 'devdiggers-hide-price-for-woocommerce' ),
					'url'   => $url,
					'done'  => ! empty( $config['enabled'] ),
				],
				[
					'title' => esc_html__( 'Choose which products to protect', 'devdiggers-hide-price-for-woocommerce' ),
					'desc'  => esc_html__( 'Your whole catalog, or selected products and categories.', 'devdiggers-hide-price-for-woocommerce' ),
					'url'   => $url,
					'done'  => 'all' === $config['hide_scope'] || $config['allowed_products'] || $config['allowed_categories'],
				],
				[
					'title' => esc_html__( 'Word the hidden price message', 'devdiggers-hide-price-for-woocommerce' ),
					'desc'  => esc_html__( 'Tell visitors how to see prices, for example by logging in.', 'devdiggers-hide-price-for-woocommerce' ),
					'url'   => add_query_arg( 'tab', 'display', $url ),
					'done'  => false !== get_option( '_ddwchpg_price_title', false ),
				],
				[
					'title' => esc_html__( 'Check a product as a guest', 'devdiggers-hide-price-for-woocommerce' ),
					'desc'  => esc_html__( 'Open your shop in a private window to see what visitors see.', 'devdiggers-hide-price-for-woocommerce' ),
					'url'   => wc_get_page_permalink( 'shop' ),
					'done'  => (bool) DDWCHPG_Stats_Helper::get()['days'],
				],
			];
		}
	}
}
