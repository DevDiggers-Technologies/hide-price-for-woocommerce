<?php
/**
 * This file handles all admin dashboard functionalities.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Includes;

use DevDiggers\Framework\Includes\DDFW_Plugin_Dashboard;
use DevDiggers\Framework\Includes\DDFW_Assets;
use DevDiggers\Framework\Includes\DDFW_SVG;
use DDWCHidePriceForGuest\Templates\Admin\Configuration;
use DDWCHidePriceForGuest\Templates\Admin\Dashboard\DDWCHPG_Dashboard_Template;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Admin_Dashboard' ) ) {
	/**
	 * Admin Dashboard Class
	 */
	class DDWCHPG_Admin_Dashboard {
		/**
		 * Configuration Variable
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Dashboard Variable
		 *
		 * @var DDFW_Plugin_Dashboard
		 */
		protected $dashboard;

		/**
		 * Construct
		 *
		 * @param array $ddwchpg_configuration Configuration.
		 */
		public function __construct( $ddwchpg_configuration ) {
			$this->ddwchpg_configuration = $ddwchpg_configuration;

			add_action( 'admin_enqueue_scripts', [ $this, 'ddwchpg_enqueue_admin_scripts' ] );
			add_filter( 'admin_footer_text', [ $this, 'ddwchpg_set_admin_footer_text' ], 99 );

			$this->ddwchpg_add_dashboard_menu();
		}

		/**
		 * Plugin logo, shared by the dashboard header and the setup wizard.
		 *
		 * @param int $size Size in pixels.
		 * @return string
		 */
		public static function ddwchpg_get_logo( $size = 32 ) {
			return '<svg width="' . absint( $size ) . '" height="' . absint( $size ) . '" viewBox="0 0 30 30" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
				<circle cx="15" cy="15" r="14" fill="var(--ddfw-tab-background-color)"/>
				<polygon points="6.5,8 14.5,8 22,15.5 14.5,23 6.5,15" fill="var(--ddfw-tab-background-color)" stroke="var(--ddfw-primary-color)" stroke-width="1.6" stroke-linejoin="round"/>
				<circle cx="10.5" cy="12" r="1.5" fill="var(--ddfw-primary-color)"/>
				<rect x="18.5" y="14.5" width="5" height="6" rx="2.5" stroke="var(--ddfw-primary-color)" stroke-width="1.4" fill="none"/>
				<rect x="17" y="18" width="8" height="6.5" rx="1.3" fill="var(--ddfw-primary-color)"/>
				<circle cx="21" cy="21.2" r="1" fill="#ffffff"/>
			</svg>';
		}

		/**
		 * Screenshot for an upgrade card, or an empty string when none is bundled.
		 *
		 * An empty string makes the card render on its own instead of over a broken image, so a
		 * screenshot can be dropped into assets/images/pro/ later without a code change.
		 *
		 * @param string $name File name without the extension.
		 * @return string
		 */
		public static function ddwchpg_get_pro_image( $name ) {
			$file = 'assets/images/pro/' . sanitize_file_name( $name ) . '.webp';

			return file_exists( DDWCHPG_PLUGIN_FILE . $file ) ? DDWCHPG_PLUGIN_URL . $file : '';
		}

		/**
		 * Add Admin menu function
		 *
		 * @return void
		 */
		public function ddwchpg_add_dashboard_menu() {
			$args = [
				'page_title'  => esc_html__( 'Hide Price', 'devdiggers-hide-price-for-woocommerce' ),
				'menu_title'  => esc_html__( 'Hide Price', 'devdiggers-hide-price-for-woocommerce' ),
				'slug'        => 'ddwchpg-dashboard',
				'plugin_name' => self::ddwchpg_get_logo() . esc_html__( 'Hide Price', 'devdiggers-hide-price-for-woocommerce' ),
				'upgrade_url' => 'https://devdiggers.com/product/woocommerce-hide-price-for-guest/',
				'menus'       => [
					'dashboard'     => [
						'label'    => esc_html__( 'Dashboard', 'devdiggers-hide-price-for-woocommerce' ),
						'layout'   => 'full-width',
						'callback' => [ $this, 'ddwchpg_get_dashboard_template' ],
					],
					'rules'         => [
						'label'    => esc_html__( 'Rules', 'devdiggers-hide-price-for-woocommerce' ),
						'layout'   => 'full-width',
						'callback' => [ $this, 'ddwchpg_get_rules_template' ],
					],
					'quotes'        => [
						'label'    => esc_html__( 'Quote Requests', 'devdiggers-hide-price-for-woocommerce' ),
						'layout'   => 'full-width',
						'callback' => [ $this, 'ddwchpg_get_quotes_template' ],
					],
					'configuration' => [
						'label'  => esc_html__( 'Configuration', 'devdiggers-hide-price-for-woocommerce' ),
						'layout' => 'sidebar',
						'tabs'   => [
							'general' => [
								'label'    => esc_html__( 'General', 'devdiggers-hide-price-for-woocommerce' ),
								'icon'     => DDFW_SVG::get_svg_icon( 'general', true, [ 'size' => 18 ] ),
								'callback' => [ $this, 'ddwchpg_get_general_configuration_template' ],
							],
							'display' => [
								'label'    => esc_html__( 'Display', 'devdiggers-hide-price-for-woocommerce' ),
								'icon'     => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
								'callback' => [ $this, 'ddwchpg_get_display_configuration_template' ],
							],
						],
					],
				],
			];

			$this->dashboard = new DDFW_Plugin_Dashboard( $args );
		}

		/**
		 * Dashboard screen.
		 *
		 * @return void
		 */
		public function ddwchpg_get_dashboard_template() {
			new DDWCHPG_Dashboard_Template( $this->ddwchpg_configuration );
		}

		/**
		 * Rules menu: what the Pro rules engine adds.
		 *
		 * @return void
		 */
		public function ddwchpg_get_rules_template() {
			ddfw_upgrade_to_pro_section(
				[
					'image_url'     => self::ddwchpg_get_pro_image( 'rules' ),
					'heading'       => esc_html__( 'Hide prices with as many rules as your catalog needs, in Pro', 'devdiggers-hide-price-for-woocommerce' ),
					'description'   => esc_html__( 'Free hides prices on your whole store or on the products and categories you pick. Pro adds a rules engine, so wholesale ranges, members-only lines and launch previews each get their own audience, message and button.', 'devdiggers-hide-price-for-woocommerce' ),
					'list_features' => [
						esc_html__( 'Match products by tag, type, price, stock, sale, featured, rating, reviews and published date', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Combine conditions with ALL or ANY, and order rules by priority', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'A different audience, price text, button and link for every rule', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Schedule a rule with start and end dates, for example to reveal prices at a launch', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Duplicate, pause and reactivate rules in one click', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'upgrade_url'   => 'https://devdiggers.com/product/woocommerce-hide-price-for-guest/',
				]
			);
		}

		/**
		 * Quote Requests menu: what the Pro quote inbox adds.
		 *
		 * @return void
		 */
		public function ddwchpg_get_quotes_template() {
			ddfw_upgrade_to_pro_section(
				[
					'image_url'     => self::ddwchpg_get_pro_image( 'quotes' ),
					'heading'       => esc_html__( 'Turn hidden prices into quote requests, with Pro', 'devdiggers-hide-price-for-woocommerce' ),
					'description'   => esc_html__( 'Visitors who will not log in still want a price. Pro swaps the button for a "Request a Quote" form and keeps every request in an inbox here.', 'devdiggers-hide-price-for-woocommerce' ),
					'list_features' => [
						esc_html__( 'A quote form in a popup: name, email, phone, quantity and message', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Every request listed with search, statuses (new, replied, closed) and bulk actions', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Email alerts to your team, a copy to the customer, and replies that go straight to them', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Spam protection with a honeypot and a per-visitor rate limit', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'upgrade_url'   => 'https://devdiggers.com/product/woocommerce-hide-price-for-guest/',
				]
			);
		}

		/**
		 * General configuration tab.
		 *
		 * @return void
		 */
		public function ddwchpg_get_general_configuration_template() {
			new Configuration\DDWCHPG_Configuration_General( $this->ddwchpg_configuration );
		}

		/**
		 * Display configuration tab.
		 *
		 * @return void
		 */
		public function ddwchpg_get_display_configuration_template() {
			new Configuration\DDWCHPG_Configuration_Display( $this->ddwchpg_configuration );
		}

		/**
		 * Enqueue admin scripts function
		 *
		 * @return void
		 */
		public function ddwchpg_enqueue_admin_scripts() {
			if ( ! $this->dashboard->is_a_plugin_page() ) {
				return;
			}

			wp_enqueue_style( DDFW_Assets::$framework_css_handle );
			wp_enqueue_script( DDFW_Assets::$framework_js_handle );
			wp_enqueue_style( 'ddwchpg-admin-style', DDWCHPG_PLUGIN_URL . 'assets/css/admin.css', [ DDFW_Assets::$framework_css_handle ], filemtime( DDWCHPG_PLUGIN_FILE . 'assets/css/admin.css' ) );
		}

		/**
		 * Thank-you footer on the plugin's own screens.
		 *
		 * @param string $footer_text Default footer text.
		 * @return string
		 */
		public function ddwchpg_set_admin_footer_text( $footer_text ) {
			if ( ! $this->dashboard->is_a_plugin_page() ) {
				return $footer_text;
			}

			$review_link = '<a href="' . esc_url( 'https://wordpress.org/support/plugin/devdiggers-hide-price-for-woocommerce/reviews/#new-post' ) . '" target="_blank" rel="noopener noreferrer" aria-label="' . esc_attr__( 'Five star review', 'devdiggers-hide-price-for-woocommerce' ) . '"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 32" height="10" aria-hidden="true"><path d="M16 26.534L6.111 32 8 20.422l-8-8.2 11.056-1.688L16 0l4.944 10.534L32 12.223l-8 8.2L25.889 32zm40 0L46.111 32 48 20.422l-8-8.2 11.056-1.688L56 0l4.944 10.534L72 12.223l-8 8.2L65.889 32zm40 0L86.111 32 88 20.422l-8-8.2 11.056-1.688L96 0l4.944 10.534L112 12.223l-8 8.2L105.889 32zm40 0L126.111 32 128 20.422l-8-8.2 11.056-1.688L136 0l4.944 10.534L152 12.223l-8 8.2L145.889 32zm40 0L166.111 32 168 20.422l-8-8.2 11.056-1.688L176 0l4.944 10.534L192 12.223l-8 8.2L185.889 32z" fill="#F5A623" fill-rule="evenodd"/></svg></a>';

			/* translators: %s: star rating link. */
			return sprintf( esc_html__( 'If DevDiggers Hide Price for WooCommerce is working well for you, please leave us a %s rating. It really helps.', 'devdiggers-hide-price-for-woocommerce' ), $review_link );
		}
	}
}
