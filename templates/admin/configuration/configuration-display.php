<?php
/**
 * Display Configuration template class
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Templates\Admin\Configuration;

use DDWCHidePriceForGuest\Includes\DDWCHPG_Admin_Dashboard;
use DevDiggers\Framework\Includes\DDFW_Layout;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Configuration_Display' ) ) {
	/**
	 * Display Configuration template class
	 */
	class DDWCHPG_Configuration_Display {
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
			$this->ddwchpg_render_display_configuration();
		}

		/**
		 * Render display configuration
		 *
		 * @return void
		 */
		public function ddwchpg_render_display_configuration() {
			$config = $this->ddwchpg_configuration;

			$args = [
				[
					'header' => [
						'heading'     => esc_html__( 'Price Message', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'What visitors see in place of the price.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'fields' => [
						[
							'type'        => 'text',
							'label'       => esc_html__( 'Hidden Price Text', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'Basic HTML allowed. Placeholders: {login_url}, {register_url}, {product_name}. Example: <a href="{login_url}">Login</a> to see wholesale prices', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-price-title',
							'value'       => $config['price_title'],
							'placeholder' => esc_html__( 'Login to view price', 'devdiggers-hide-price-for-woocommerce' ),
						],
						[
							'type'        => 'colorpicker',
							'label'       => esc_html__( 'Text Color', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'Leave empty to use the theme price color.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-price-text-color',
							'value'       => $config['price_text_color'],
						],
						[
							'type'        => 'colorpicker',
							'label'       => esc_html__( 'Background Color', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'Shows the message as a badge. Leave empty for plain text.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-price-bg-color',
							'value'       => $config['price_bg_color'],
						],
					],
				],
				[
					'header' => [
						'heading'     => esc_html__( 'Replacement Button', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'What replaces the add to cart button. A dead end loses the sale, so give visitors a next step.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'fields' => [
						[
							'type'        => 'select',
							'label'       => esc_html__( 'Button Action', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'What visitors can do instead of buying. Logged-in visitors never see a login button.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-button-action',
							'options'     => [
								'login'      => esc_html__( 'Login to see the price', 'devdiggers-hide-price-for-woocommerce' ),
								'custom_url' => esc_html__( 'Go to a custom URL', 'devdiggers-hide-price-for-woocommerce' ),
								'none'       => esc_html__( 'No button', 'devdiggers-hide-price-for-woocommerce' ),
							],
							'value'       => $config['button_action'],
							'show_fields' => [
								'login'      => [ 'ddwchpg-button-title', 'ddwchpg-login-popup', 'ddwchpg-custom-url', 'ddwchpg-button-class' ],
								'custom_url' => [ 'ddwchpg-button-title', 'ddwchpg-custom-url', 'ddwchpg-button-class' ],
							],
						],
						[
							'type'        => 'text',
							'label'       => esc_html__( 'Button Text', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'Label of the login or custom URL button.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-button-title',
							'value'       => $config['button_title'],
							'placeholder' => esc_html__( 'Login to purchase', 'devdiggers-hide-price-for-woocommerce' ),
						],
						[
							'type'           => 'checkbox',
							'label'          => esc_html__( 'Login Popup', 'devdiggers-hide-price-for-woocommerce' ),
							'checkbox_label' => esc_html__( 'Open the login form in a popup', 'devdiggers-hide-price-for-woocommerce' ),
							'description'    => esc_html__( 'Visitors log in without leaving the product and land back on it. When off, the button goes to My Account.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'             => 'ddwchpg-login-popup',
							'value'          => $config['login_popup'],
						],
						[
							'type'        => 'url',
							'label'       => esc_html__( 'Custom URL', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'For example a contact page or a wholesale application form. With the login action, logged-in visitors in your audience get this link instead.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-custom-url',
							'value'       => $config['custom_url'],
							'placeholder' => 'https://',
						],
						[
							'type'        => 'text',
							'label'       => esc_html__( 'Extra Button Classes', 'devdiggers-hide-price-for-woocommerce' ),
							'description' => esc_html__( 'Space separated CSS classes, for example "alt" to use your theme accent button.', 'devdiggers-hide-price-for-woocommerce' ),
							'id'          => 'ddwchpg-button-class',
							'value'       => $config['button_class'],
						],
					],
				],
				[
					'header'            => [
						'heading'     => esc_html__( 'Request a Quote', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Give visitors who will not log in a way to ask for a price.', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'after_header_html' => ddfw_get_upgrade_to_pro_section(
						[
							'image_url'     => DDWCHPG_Admin_Dashboard::ddwchpg_get_pro_image( 'quote-form' ),
							'heading'       => esc_html__( 'Collect quote requests instead of losing the visitor, with Pro', 'devdiggers-hide-price-for-woocommerce' ),
							'description'   => esc_html__( 'Pro adds "Request a quote" as a button action: a popup form on the product, an inbox in your dashboard and emails to you and the customer.', 'devdiggers-hide-price-for-woocommerce' ),
							'list_features' => [
								esc_html__( 'Your own button text and success message', 'devdiggers-hide-price-for-woocommerce' ),
								esc_html__( 'Send new requests to one or several email addresses', 'devdiggers-hide-price-for-woocommerce' ),
								esc_html__( 'Email the customer a copy of their request', 'devdiggers-hide-price-for-woocommerce' ),
								esc_html__( 'Edit both emails under WooCommerce > Settings > Emails', 'devdiggers-hide-price-for-woocommerce' ),
							],
							'upgrade_url'   => 'https://devdiggers.com/product/woocommerce-hide-price-for-guest/',
						]
					),
				],
			];

			$layout = new DDFW_Layout();
			$layout->get_form_section_layout( $args, 'ddwchpg-configuration-display-fields' );
		}
	}
}
