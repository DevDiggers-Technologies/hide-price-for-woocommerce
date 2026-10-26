<?php
/**
 * Setup wizard integration.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Includes\Admin;

use DDWCHidePriceForGuest\Includes\DDWCHPG_File_Handler;
use DDWCHidePriceForGuest\Templates\Admin\Configuration\DDWCHPG_Configuration_General;
use DevDiggers\Framework\Includes\DDFW_Form_Field;
use DevDiggers\Framework\Includes\DDFW_Setup_Wizard;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Setup_Wizard' ) ) {
	/**
	 * Setup wizard class
	 */
	class DDWCHPG_Setup_Wizard {
		/**
		 * Plugin slug.
		 */
		const SLUG = 'devdiggers-hide-price-for-woocommerce';

		/**
		 * Configuration
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Constructor
		 *
		 * @param array $ddwchpg_configuration Configuration.
		 */
		public function __construct( $ddwchpg_configuration ) {
			$this->ddwchpg_configuration = $ddwchpg_configuration;

			if ( class_exists( '\\DevDiggers\\Framework\\Includes\\DDFW_Setup_Wizard' ) ) {
				new DDFW_Setup_Wizard( $this->ddwchpg_get_wizard_config() );
			}
		}

		/**
		 * Wizard configuration.
		 *
		 * @return array
		 */
		public function ddwchpg_get_wizard_config() {
			return [
				'plugin_slug'    => self::SLUG,
				'plugin_file'    => self::SLUG . '/functions.php',
				'dashboard_page' => 'ddwchpg-dashboard',
				'redirect_url'   => admin_url( 'admin.php?page=ddwchpg-dashboard' ),
				'brand'          => [
					'name'        => esc_html__( 'DevDiggers Hide Price', 'devdiggers-hide-price-for-woocommerce' ),
					'description' => esc_html__( 'A few quick steps to decide who sees prices, which products are protected and what visitors can do instead of buying.', 'devdiggers-hide-price-for-woocommerce' ),
				],
				'steps'          => [
					'welcome'  => [
						'label'         => esc_html__( 'Welcome', 'devdiggers-hide-price-for-woocommerce' ),
						'view_callback' => [ $this, 'ddwchpg_welcome_view' ],
					],
					'audience' => [
						'label'         => esc_html__( 'Audience', 'devdiggers-hide-price-for-woocommerce' ),
						'view_callback' => [ $this, 'ddwchpg_audience_view' ],
						'save_callback' => [ $this, 'ddwchpg_save_fields' ],
					],
					'display'  => [
						'label'         => esc_html__( 'Display', 'devdiggers-hide-price-for-woocommerce' ),
						'view_callback' => [ $this, 'ddwchpg_display_view' ],
						'save_callback' => [ $this, 'ddwchpg_save_fields' ],
					],
					'ready'    => [
						'label'             => esc_html__( 'Ready!', 'devdiggers-hide-price-for-woocommerce' ),
						'ready_title'       => esc_html__( 'Your prices are protected.', 'devdiggers-hide-price-for-woocommerce' ),
						'ready_description' => esc_html__( 'Fine-tune exclusions and protection in Configuration, set a product to always hide or show from its edit screen, and watch button clicks on the dashboard.', 'devdiggers-hide-price-for-woocommerce' ),
					],
				],
			];
		}

		/**
		 * Welcome view
		 *
		 * @return void
		 */
		public function ddwchpg_welcome_view() {
			?>
			<div class="ddfw-setup-wizard-ready ddfw-setup-wizard-onboarding">
				<div class="ddfw-success-icon-wrap"><?php echo wp_kses( \DDWCHidePriceForGuest\Includes\DDWCHPG_Admin_Dashboard::ddwchpg_get_logo( 100 ), ddfw_kses_allowed_svg_tags() ); ?></div>
				<h2 class="ddfw-setup-wizard-ready-title"><?php esc_html_e( 'Welcome to DevDiggers Hide Price!', 'devdiggers-hide-price-for-woocommerce' ); ?></h2>
				<p class="ddfw-setup-wizard-ready-desc"><?php esc_html_e( 'Hide prices from guests or any role, give visitors a login popup or your own link instead, and keep prices out of Google and the Store API.', 'devdiggers-hide-price-for-woocommerce' ); ?></p>
			</div>
			<?php
		}

		/**
		 * Render a list of fields inside the wizard section markup.
		 *
		 * @param string $heading     Heading.
		 * @param string $description Description.
		 * @param array  $fields      Fields.
		 * @return void
		 */
		protected function ddwchpg_render_fields( $heading, $description, $fields ) {
			?>
			<div class="ddfw-fields-section">
				<div class="ddfw-fields-section-header">
					<h3><?php echo esc_html( $heading ); ?></h3>
					<p><?php echo esc_html( $description ); ?></p>
				</div>
				<table class="form-table">
					<tbody>
						<?php
						foreach ( $fields as $field ) {
							DDFW_Form_Field::display_form_field( $field );
						}
						?>
					</tbody>
				</table>
			</div>
			<?php
		}

		/**
		 * Audience step
		 *
		 * @return void
		 */
		public function ddwchpg_audience_view() {
			$config = $this->ddwchpg_configuration;

			$this->ddwchpg_render_fields(
				esc_html__( 'Who should not see prices?', 'devdiggers-hide-price-for-woocommerce' ),
				esc_html__( 'Pick the visitors and products to protect. Exclusions and single products can be set later.', 'devdiggers-hide-price-for-woocommerce' ),
				[
					[
						'type'           => 'checkbox',
						'label'          => esc_html__( 'Enable/Disable', 'devdiggers-hide-price-for-woocommerce' ),
						'checkbox_label' => esc_html__( 'Enable DevDiggers Hide Price for WooCommerce', 'devdiggers-hide-price-for-woocommerce' ),
						'description'    => esc_html__( 'Turns price hiding on for your store.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'             => 'ddwchpg-enable-hide-price',
						'value'          => $config['enabled'] ? $config['enabled'] : 'yes',
					],
					[
						'type'              => 'select',
						'label'             => esc_html__( 'Hide Prices For', 'devdiggers-hide-price-for-woocommerce' ),
						'description'       => esc_html__( 'Visitors who will not see prices. Most stores pick Guests.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'                => 'ddwchpg-target-roles',
						'name'              => '_ddwchpg_target_roles[]',
						'options'           => DDWCHPG_Configuration_General::ddwchpg_get_audience_options(),
						'value'             => (array) $config['target_roles'],
						'custom_attributes' => [ 'multiple' => true ],
					],
					[
						'type'        => 'radio',
						'label'       => esc_html__( 'What to Hide', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Hide only the button to keep prices public but take orders another way.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'          => 'ddwchpg-hide-mode',
						'options'     => DDWCHPG_Configuration_General::ddwchpg_get_hide_mode_options(),
						'value'       => $config['hide_mode'],
					],
					[
						'type'        => 'select',
						'label'       => esc_html__( 'Hide Prices On', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Your whole catalog, or only some categories. Single products can be picked later in Configuration.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'          => 'ddwchpg-hide-scope',
						'options'     => [
							'all'      => esc_html__( 'All products', 'devdiggers-hide-price-for-woocommerce' ),
							'selected' => esc_html__( 'Only the categories I choose', 'devdiggers-hide-price-for-woocommerce' ),
						],
						'value'       => $config['hide_scope'],
						'show_fields' => [
							'selected' => [ 'ddwchpg-allowed-categories' ],
						],
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
				]
			);
		}

		/**
		 * Display step
		 *
		 * @return void
		 */
		public function ddwchpg_display_view() {
			$config = $this->ddwchpg_configuration;

			$this->ddwchpg_render_fields(
				esc_html__( 'What do visitors see instead?', 'devdiggers-hide-price-for-woocommerce' ),
				esc_html__( 'Give visitors a next step so a hidden price turns into a login instead of a lost visitor.', 'devdiggers-hide-price-for-woocommerce' ),
				[
					[
						'type'        => 'text',
						'label'       => esc_html__( 'Hidden Price Text', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Shown where the price would be.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'          => 'ddwchpg-price-title',
						'value'       => $config['price_title'],
					],
					[
						'type'        => 'select',
						'label'       => esc_html__( 'Button Action', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'What replaces the add to cart button.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'          => 'ddwchpg-button-action',
						'options'     => [
							'login'      => esc_html__( 'Login to see the price (popup)', 'devdiggers-hide-price-for-woocommerce' ),
							'custom_url' => esc_html__( 'Go to a custom URL', 'devdiggers-hide-price-for-woocommerce' ),
							'none'       => esc_html__( 'No button', 'devdiggers-hide-price-for-woocommerce' ),
						],
						'value'       => $config['button_action'],
						'show_fields' => [
							'login'      => [ 'ddwchpg-button-title' ],
							'custom_url' => [ 'ddwchpg-button-title', 'ddwchpg-custom-url' ],
						],
					],
					[
						'type'        => 'url',
						'label'       => esc_html__( 'Custom URL', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Where the button sends visitors, for example a contact or trade application page.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'          => 'ddwchpg-custom-url',
						'value'       => $config['custom_url'],
						'placeholder' => 'https://',
					],
					[
						'type'        => 'text',
						'label'       => esc_html__( 'Button Text', 'devdiggers-hide-price-for-woocommerce' ),
						'description' => esc_html__( 'Label of the login or custom URL button.', 'devdiggers-hide-price-for-woocommerce' ),
						'id'          => 'ddwchpg-button-title',
						'value'       => $config['button_title'],
					],
				]
			);
		}

		/**
		 * Save the fields of a step with the same sanitizers as the settings pages.
		 *
		 * @param array $form_data List of [ name, value ] pairs.
		 * @return bool
		 */
		public function ddwchpg_save_fields( $form_data ) {
			$callbacks = [];
			foreach ( DDWCHPG_Admin_Functions::ddwchpg_get_setting_groups() as $settings ) {
				foreach ( $settings as $key => $args ) {
					$callbacks[ DDWCHPG_File_Handler::ddwchpg_get_option_name( $key ) ] = $args['sanitize_callback'];
				}
			}

			$values = [];
			foreach ( (array) $form_data as $field ) {
				$name = isset( $field['name'] ) ? (string) $field['name'] : '';

				if ( '[]' === substr( $name, -2 ) ) {
					$values[ substr( $name, 0, -2 ) ][] = $field['value'];
				} else {
					// Checkboxes post a hidden '' first, then the checked value: last one wins.
					$values[ $name ] = $field['value'] ?? '';
				}
			}

			// The wizard posts plain text, so an HTML price message (a link to {login_url}) would come
			// back stripped. Unchanged text keeps the saved HTML.
			if ( isset( $values['_ddwchpg_price_title'] ) && wp_strip_all_tags( (string) get_option( '_ddwchpg_price_title', '' ) ) === $values['_ddwchpg_price_title'] ) {
				unset( $values['_ddwchpg_price_title'] );
			}

			foreach ( $values as $option => $value ) {
				if ( isset( $callbacks[ $option ] ) ) {
					update_option( $option, call_user_func( $callbacks[ $option ], $value ) );
				}
			}

			return true;
		}
	}
}
