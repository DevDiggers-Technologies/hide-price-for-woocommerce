<?php
/**
 * Plugin Name: DevDiggers Hide Price for WooCommerce
 * Description: Hide prices and the add to cart button from guests or chosen user roles, on your whole catalog or selected products and categories. Show a login popup or your own link instead, and stop hidden prices leaking through Google, blocks and the Store API.
 * Plugin URI: https://devdiggers.com/product/woocommerce-hide-price-for-guest/
 * Author: DevDiggers
 * Author URI: https://devdiggers.com/
 * Version: 1.0.0
 * Text Domain: devdiggers-hide-price-for-woocommerce
 * Domain Path: /i18n
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * WC requires at least: 9.0
 * WC tested up to: 11.2
 * DevDiggersPrefix: ddwchpg
 * Requires Plugins: woocommerce
 * License: GPLv3 or later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 *
 * @package DevDiggers Hide Price for WooCommerce
 */

// ddwchpg: DevDiggers Hide Price for WooCommerce.

use DDWCHidePriceForGuest\Includes\DDWCHPG_File_Handler;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Free_Init' ) ) {
	/**
	 * Free Init class.
	 */
	final class DDWCHPG_Free_Init {
		/**
		 * The single instance of this class.
		 *
		 * @var DDWCHPG_Free_Init|null
		 */
		private static $instance = null;

		/**
		 * Class constructor.
		 */
		public function __construct() {
			add_action( 'init', [ $this, 'ddwchpg_init' ] );
			add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), [ $this, 'ddwchpg_plugin_settings_link' ] );
			add_filter( 'plugin_row_meta', [ $this, 'ddwchpg_plugin_row_meta' ], 10, 2 );
		}

		/**
		 * Create a plugin instance.
		 *
		 * @return static
		 */
		public static function get_instance() {
			if ( null === self::$instance ) {
				self::$instance = new self();

				/**
				 * Fires when the main plugin instance is loaded.
				 *
				 * @since 1.0.0
				 */
				do_action( 'ddwchpg_loaded' );
			}

			return self::$instance;
		}

		/**
		 * Init function.
		 *
		 * @return void
		 */
		public function ddwchpg_init() {
			// WordPress.org loads plugin translations automatically.
			if ( ! class_exists( 'WooCommerce' ) ) {
				add_action(
					'admin_notices',
					function () {
						?>
						<div class="notice notice-error">
							<p>
								<?php
								/* translators: %1$s: opening link tag, %2$s: closing link tag */
								printf( esc_html__( 'DevDiggers Hide Price for WooCommerce is activated but not effective. It requires %1$sWooCommerce%2$s in order to work.', 'devdiggers-hide-price-for-woocommerce' ), '<a href="' . esc_url( 'https://wordpress.org/plugins/woocommerce/' ) . '" target="_blank">', '</a>' );
								?>
							</p>
						</div>
						<?php
					}
				);

				return;
			}

			require_once DDWCHPG_PLUGIN_FILE . 'autoload/autoload.php';
			new DDWCHPG_File_Handler();

			// Only on the plugin's own screens (plus AJAX so the dismiss button works).
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only admin routing input.
			$on_plugin_page = is_admin() && isset( $_GET['page'] ) && 'ddwchpg-dashboard' === sanitize_key( wp_unslash( $_GET['page'] ) );

			if ( ( $on_plugin_page || wp_doing_ajax() ) && class_exists( '\DevDiggers\Framework\Includes\DDFW_Review_Notice' ) ) {
				new \DevDiggers\Framework\Includes\DDFW_Review_Notice(
					[
						'plugin_name'   => esc_html__( 'DevDiggers Hide Price for WooCommerce', 'devdiggers-hide-price-for-woocommerce' ),
						'plugin_prefix' => 'ddwchpg',
						'review_url'    => 'https://wordpress.org/support/plugin/devdiggers-hide-price-for-woocommerce/reviews/#new-post',
					]
				);
			}
		}

		/**
		 * Plugin settings link.
		 *
		 * @param array $links Links array.
		 * @return array
		 */
		public function ddwchpg_plugin_settings_link( $links ) {
			ob_start();
			?>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=ddwchpg-dashboard' ) ); ?>"><?php esc_html_e( 'Dashboard', 'devdiggers-hide-price-for-woocommerce' ); ?></a>
			|
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=ddwchpg-dashboard&menu=configuration' ) ); ?>"><?php esc_html_e( 'Configuration', 'devdiggers-hide-price-for-woocommerce' ); ?></a>
			|
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=ddwchpg-dashboard&setup-wizard=true' ) ); ?>"><?php esc_html_e( 'Setup Wizard', 'devdiggers-hide-price-for-woocommerce' ); ?></a>
			|
			<a href="<?php echo esc_url( 'https://devdiggers.com/product/woocommerce-hide-price-for-guest/' ); ?>" style="color: #0256ff; font-weight: bold;" target="_blank"><?php esc_html_e( 'Upgrade to Pro', 'devdiggers-hide-price-for-woocommerce' ); ?></a>
			<?php
			array_unshift( $links, ob_get_clean() );

			return $links;
		}

		/**
		 * Plugin row meta links.
		 *
		 * @param array  $links Links.
		 * @param string $file  Plugin file.
		 * @return array
		 */
		public function ddwchpg_plugin_row_meta( $links, $file ) {
			if ( plugin_basename( __FILE__ ) === $file ) {
				$row_meta = [
					'support'       => '<a href="https://devdiggers.com/contact/" aria-label="' . esc_attr__( 'Support', 'devdiggers-hide-price-for-woocommerce' ) . '">' . esc_html__( 'Support', 'devdiggers-hide-price-for-woocommerce' ) . '</a>',
					'documentation' => '<a href="https://docs.devdiggers.com/woocommerce-hide-price-for-guest/" aria-label="' . esc_attr__( 'Documentation', 'devdiggers-hide-price-for-woocommerce' ) . '">' . esc_html__( 'Documentation', 'devdiggers-hide-price-for-woocommerce' ) . '</a>',
					'review'        => '<a href="https://wordpress.org/support/plugin/devdiggers-hide-price-for-woocommerce/reviews/#new-post" target="_blank" title="' . esc_attr__( 'Review', 'devdiggers-hide-price-for-woocommerce' ) . '" aria-label="' . esc_attr__( 'Review', 'devdiggers-hide-price-for-woocommerce' ) . '"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 32" height="10"><path d="M16 26.534L6.111 32 8 20.422l-8-8.2 11.056-1.688L16 0l4.944 10.534L32 12.223l-8 8.2L25.889 32zm40 0L46.111 32 48 20.422l-8-8.2 11.056-1.688L56 0l4.944 10.534L72 12.223l-8 8.2L65.889 32zm40 0L86.111 32 88 20.422l-8-8.2 11.056-1.688L96 0l4.944 10.534L112 12.223l-8 8.2L105.889 32zm40 0L126.111 32 128 20.422l-8-8.2 11.056-1.688L136 0l4.944 10.534L152 12.223l-8 8.2L145.889 32zm40 0L166.111 32 168 20.422l-8-8.2 11.056-1.688L176 0l4.944 10.534L192 12.223l-8 8.2L185.889 32z" fill="#F5A623" fill-rule="evenodd"/></svg></a>',
				];

				$links = array_merge( $links, $row_meta );
			}

			return $links;
		}
	}
}

// Step aside when the premium edition of this plugin is active.
add_action(
	'plugins_loaded',
	function () {
		if ( class_exists( 'DDWCHPG_Init' ) ) {
			return;
		}

		defined( 'DDWCHPG_PLUGIN_FILE' ) || define( 'DDWCHPG_PLUGIN_FILE', plugin_dir_path( __FILE__ ) );
		defined( 'DDWCHPG_PLUGIN_URL' ) || define( 'DDWCHPG_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

		DDWCHPG_Free_Init::get_instance();

		// Load DevDiggers Framework if not loaded already.
		if ( ! defined( 'DDFW_LOADED' ) && file_exists( DDWCHPG_PLUGIN_FILE . 'devdiggers-framework/init.php' ) ) {
			$should_load = true;

			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only admin routing input.
			if ( ! empty( $_GET['page'] ) ) {
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only admin routing input.
				$current_page = sanitize_text_field( wp_unslash( $_GET['page'] ) );
				$prefix       = explode( '-', $current_page )[0];

				if ( 0 === strpos( $prefix, 'ddwc' ) || 0 === strpos( $prefix, 'ddwp' ) ) {
					$pro_class  = strtoupper( $prefix ) . '_Init';
					$free_class = strtoupper( $prefix ) . '_Free_Init';

					// Yield to a sibling DevDiggers plugin except on this plugin's own pages.
					if ( class_exists( $free_class ) && ! class_exists( $pro_class ) && 'ddwchpg' !== $prefix ) {
						$should_load = false;
					}
				}
			}

			if ( $should_load ) {
				require DDWCHPG_PLUGIN_FILE . 'devdiggers-framework/init.php';
			}
		}
	},
	10
);

register_activation_hook(
	__FILE__,
	function () {
		// The review notice counts its delay from here.
		add_option( 'ddwchpg_installed_at', time() );

		// A store that already turned price hiding on (an earlier install) is configured.
		if ( get_option( '_ddwchpg_enable_hide_price' ) ) {
			update_option( 'ddfw_setup_wizard_completed_devdiggers-hide-price-for-woocommerce', true );
		} else {
			set_transient( 'ddfw_activation_redirect_devdiggers-hide-price-for-woocommerce', true, 30 );
		}
	}
);

// HPOS and Cart/Checkout Blocks compatibility.
add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
		}
	}
);
