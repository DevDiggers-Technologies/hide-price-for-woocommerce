<?php
/**
 * General Configuration template class
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Templates\Admin\Configuration;

use DDWCHidePriceForGuest\Includes\DDWCHPG_Admin_Dashboard;
use DevDiggers\Framework\Includes\DDFW_Layout;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Configuration_General' ) ) {
	/**
	 * General Configuration template class
	 */
	class DDWCHPG_Configuration_General {
		/**
		 * Configuration Variable
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
			$this->ddwchpg_render_general_configuration();
		}

		/**
		 * Audience options: guests plus every registered role.
		 *
		 * @return array
		 */
		public static function ddwchpg_get_audience_options() {
			$options = [ 'ddwchpg_guest' => esc_html__( 'Guests (not logged in)', 'devdiggers-hide-price-for-woocommerce' ) ];

			foreach ( wp_roles()->get_names() as $role => $name ) {
				$options[ $role ] = translate_user_role( $name );
			}

			return $options;
		}

		/**
		 * "What to hide" options.
		 *
		 * @return array
		 */
		public static function ddwchpg_get_hide_mode_options() {
			return [
				'price' => esc_html__( 'Price and add to cart button', 'devdiggers-hide-price-for-woocommerce' ),
				'cart'  => esc_html__( 'Add to cart button only (keep the price)', 'devdiggers-hide-price-for-woocommerce' ),
			];
		}

		/**
		 * Render general configuration
		 *
		 * @return void
		 */
		public function ddwchpg_render_general_configuration() {
			$config = $this->ddwchpg_configuration;

			$args = [
				[
					'header' => [
						'heading'     => esc_html__( 'Plugin Settings', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Turn price hiding on and choose who it applies to.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'fields' => [
						[
							'type'           => 'checkbox',
							'label'          => esc_html__( 'Enable/Disable', 'devdiggers-hide-price-for-woocommerce' ),
							'checkbox_label' => esc_html__( 'Enable DevDiggers Hide Price for WooCommerce', 'devdiggers-hide-price-for-woocommerce' ),
							'description'    => esc_html__( 'Master switch. When off, every visitor sees prices and your settings stay as they are.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'             => 'ddwchpg-enable-hide-price',
							'value'          => $config['enabled'],
						],
						[
							'type'              => 'select',
							'label'             => esc_html__( 'Hide Prices For', 'devdiggers-hide-price-for-woocommerce' ),
							'description'       => esc_html__( 'Visitors who do not see prices. Add roles such as Customer to run a wholesale or members-only catalog. Logged-in roles never get the login button: set a Custom URL under Display, such as your trade application page, and word the price text for them.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'                => 'ddwchpg-target-roles',
							'name'              => '_ddwchpg_target_roles[]',
							'options'           => self::ddwchpg_get_audience_options(),
							'value'             => (array) $config['target_roles'],
							'custom_attributes' => [ 'multiple' => true ],
						],
						[
							'type'        => 'radio',
							'label'       => esc_html__( 'What to Hide', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'Hide only the button to keep prices public but take orders another way, such as a login or your contact page.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-hide-mode',
							'options'     => self::ddwchpg_get_hide_mode_options(),
							'value'       => $config['hide_mode'],
						],
					],
				],
				[
					'header' => [
						'heading'     => esc_html__( 'Where to Hide', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Protect your whole catalog, or only the products and categories you pick.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'fields' => [
						[
							'type'        => 'select',
							'label'       => esc_html__( 'Hide Prices On', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'A product is protected when it is in one of the chosen categories or picked by name. Variations follow their product, or pick a single variation.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-hide-scope',
							'options'     => [
								'all'      => esc_html__( 'All products', 'devdiggers-hide-price-for-woocommerce' ),
								'selected' => esc_html__( 'Selected products and categories', 'devdiggers-hide-price-for-woocommerce' ),
							],
							'value'       => $config['hide_scope'],
							'show_fields' => [
								'selected' => [ 'ddwchpg-allowed-products', 'ddwchpg-allowed-categories' ],
							],
						],
						[
							'type'              => 'products',
							'label'             => esc_html__( 'Products', 'devdiggers-hide-price-for-woocommerce' ),
							'description'       => esc_html__( 'Hide the price of these products.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'                => 'ddwchpg-allowed-products',
							'name'              => '_ddwchpg_allowed_products[]',
							'value'             => $config['allowed_products'],
							'custom_attributes' => [ 'multiple' => true ],
						],
						[
							'type'              => 'categories',
							'label'             => esc_html__( 'Categories', 'devdiggers-hide-price-for-woocommerce' ),
							'description'       => esc_html__( 'Hide the price of every product in these categories.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'                => 'ddwchpg-allowed-categories',
							'name'              => '_ddwchpg_allowed_categories[]',
							'value'             => $config['allowed_categories'],
							'custom_attributes' => [ 'multiple' => true ],
						],
					],
				],
				[
					'header' => [
						'heading'     => esc_html__( 'Exclusions', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Products that always show their price. The per-product setting on the product edit screen still wins.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'fields' => [
						[
							'type'              => 'products',
							'label'             => esc_html__( 'Exclude Products', 'devdiggers-hide-price-for-woocommerce' ),
							'description'       => esc_html__( 'Always show the price of these products.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'                => 'ddwchpg-excluded-products',
							'name'              => '_ddwchpg_excluded_products[]',
							'value'             => $config['excluded_products'],
							'custom_attributes' => [ 'multiple' => true ],
						],
						[
							'type'              => 'categories',
							'label'             => esc_html__( 'Exclude Categories', 'devdiggers-hide-price-for-woocommerce' ),
							'description'       => esc_html__( 'Always show the price of products in these categories.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'                => 'ddwchpg-excluded-categories',
							'name'              => '_ddwchpg_excluded_categories[]',
							'value'             => $config['excluded_categories'],
							'custom_attributes' => [ 'multiple' => true ],
						],
					],
				],
				[
					'header' => [
						'heading'     => esc_html__( 'Protection', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Hiding a price on screen is not enough: these options close the other places a price or a purchase can leak through.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'fields' => [
						[
							'type'           => 'checkbox',
							'label'          => esc_html__( 'Block Purchases', 'devdiggers-hide-price-for-woocommerce' ),
							'checkbox_label' => esc_html__( 'Make protected products unpurchasable', 'devdiggers-hide-price-for-woocommerce' ),
							'description'    => esc_html__( 'Stops direct ?add-to-cart= links, the block cart and any theme button from adding the product to the cart.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'             => 'ddwchpg-block-purchase',
							'value'          => $config['block_purchase'],
						],
						[
							'type'           => 'checkbox',
							'label'          => esc_html__( 'Search Results', 'devdiggers-hide-price-for-woocommerce' ),
							'checkbox_label' => esc_html__( 'Remove prices from product schema markup', 'devdiggers-hide-price-for-woocommerce' ),
							'description'    => esc_html__( 'Keeps Google from showing the hidden price in search results.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'             => 'ddwchpg-hide-structured-data',
							'value'          => $config['hide_structured_data'],
						],
						[
							'type'           => 'checkbox',
							'label'          => esc_html__( 'Blocks and Store API', 'devdiggers-hide-price-for-woocommerce' ),
							'checkbox_label' => esc_html__( 'Remove prices from WooCommerce Store API responses', 'devdiggers-hide-price-for-woocommerce' ),
							'description'    => esc_html__( 'Covers product blocks (All Products, product collections) and anyone reading /wp-json/wc/store/ directly.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'             => 'ddwchpg-hide-store-api',
							'value'          => $config['hide_store_api'],
						],
						[
							'type'           => 'checkbox',
							'label'          => esc_html__( 'Click Counter', 'devdiggers-hide-price-for-woocommerce' ),
							'checkbox_label' => esc_html__( 'Count clicks on the replacement button', 'devdiggers-hide-price-for-woocommerce' ),
							'description'    => esc_html__( 'Powers the dashboard. Only a daily total and a per-product total are stored, in your own database. Nothing about the visitor is kept.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'             => 'ddwchpg-enable-tracking',
							'value'          => $config['enable_tracking'],
						],
					],
				],
				[
					'header'            => [
						'heading'     => esc_html__( 'Country Rules', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Hide prices only in some countries, or everywhere except some.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'after_header_html' => ddfw_get_upgrade_to_pro_section(
						[
							'image_url'     => DDWCHPG_Admin_Dashboard::ddwchpg_get_pro_image( 'countries' ),
							'heading'       => esc_html__( 'Hide prices by country, with Pro', 'devdiggers-hide-price-for-woocommerce' ),
							'description'   => esc_html__( 'Sell openly at home and quote export customers, or keep a regional price list private.', 'devdiggers-hide-price-for-woocommerce' ),
							'list_features' => [
								esc_html__( 'Hide prices only in the countries you choose, or everywhere except them', 'devdiggers-hide-price-for-woocommerce' ),
								esc_html__( 'Guests located with WooCommerce geolocation, customers by billing country', 'devdiggers-hide-price-for-woocommerce' ),
								esc_html__( 'Works together with roles and rules', 'devdiggers-hide-price-for-woocommerce' ),
							],
							'upgrade_url'   => 'https://devdiggers.com/product/woocommerce-hide-price-for-guest/',
						]
					),
				],
			];

			$layout = new DDFW_Layout();
			$layout->get_form_section_layout( $args, 'ddwchpg-configuration-general-fields' );
		}
	}
}
