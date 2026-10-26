<?php
/**
 * This file handles all front end ajax action callbacks.
 *
 * @version 1.0.0
 * @package DevDiggers Hide Price for WooCommerce
 */

namespace DDWCHidePriceForGuest\Includes\Front;

use DDWCHidePriceForGuest\Helper\DDWCHPG_Stats_Helper;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Front_Ajax_Functions' ) ) {
	/**
	 * Front Ajax Functions Handler
	 */
	class DDWCHPG_Front_Ajax_Functions {
		/**
		 * Count a click on a hidden-price button.
		 *
		 * Ponytail: guests share one nonce, so a script can inflate the counter. It only feeds
		 * the dashboard; add a per-IP throttle if the numbers ever drive anything else.
		 *
		 * @return void
		 */
		public function ddwchpg_track_click() {
			check_ajax_referer( 'ddwchpg_front_nonce', 'nonce' );

			$product_id = ! empty( $_POST['product_id'] ) ? absint( wp_unslash( $_POST['product_id'] ) ) : 0;

			if ( $product_id && 'product' === get_post_type( $product_id ) ) {
				DDWCHPG_Stats_Helper::record_click( $product_id );
			}

			wp_send_json_success();
		}
	}
}
