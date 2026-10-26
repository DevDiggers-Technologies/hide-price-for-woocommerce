<?php
/**
 * This file handles all front end AJAX action hooks.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Includes\Front;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Front_Ajax_Hooks' ) ) {
	/**
	 * Handles Front AJAX Hooks
	 */
	class DDWCHPG_Front_Ajax_Hooks extends DDWCHPG_Front_Ajax_Functions {
		/**
		 * Construct
		 */
		public function __construct() {
			add_action( 'wp_ajax_nopriv_ddwchpg_track_click', [ $this, 'ddwchpg_track_click' ] );
			add_action( 'wp_ajax_ddwchpg_track_click', [ $this, 'ddwchpg_track_click' ] );
		}
	}
}
