<?php
/**
 * Dashboard Template
 *
 * Supplies data and config to the shared framework dashboard builder (DDFW_Dashboard).
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

namespace DDWCHidePriceForGuest\Templates\Admin\Dashboard;

use DDWCHidePriceForGuest\Helper\Dashboard\DDWCHPG_Dashboard_Helper;
use DDWCHidePriceForGuest\Includes\DDWCHPG_Admin_Dashboard;
use DevDiggers\Framework\Includes\DDFW_Dashboard;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Dashboard_Template' ) ) {
	/**
	 * Dashboard template class
	 */
	class DDWCHPG_Dashboard_Template {
		/**
		 * Configuration
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Dashboard data
		 *
		 * @var array
		 */
		protected $data;

		/**
		 * Construct
		 *
		 * @param array $ddwchpg_configuration Configuration.
		 */
		public function __construct( $ddwchpg_configuration ) {
			$this->ddwchpg_configuration = $ddwchpg_configuration;
			$this->data                  = ( new DDWCHPG_Dashboard_Helper( $ddwchpg_configuration ) )->ddwchpg_get_dashboard_data();

			$this->ddwchpg_render_status_notice();
			$this->render();
		}

		/**
		 * Warn when nothing is actually being hidden.
		 *
		 * @return void
		 */
		protected function ddwchpg_render_status_notice() {
			if ( empty( $this->ddwchpg_configuration['enabled'] ) ) {
				$message = esc_html__( 'Price hiding is turned off, so every visitor sees prices.', 'devdiggers-hide-price-for-woocommerce' );
			} elseif ( empty( $this->data['coverage']['protected'] ) ) {
				$message = esc_html__( 'Price hiding is on but no product is protected yet.', 'devdiggers-hide-price-for-woocommerce' );
			} else {
				return;
			}
			?>
			<div class="notice notice-warning inline ddwchpg-dashboard-notice">
				<p><?php echo esc_html( $message ); ?> <a href="<?php echo esc_url( admin_url( 'admin.php?page=ddwchpg-dashboard&menu=configuration' ) ); ?>"><?php esc_html_e( 'Fix it', 'devdiggers-hide-price-for-woocommerce' ); ?></a></p>
			</div>
			<?php
		}

		/**
		 * Inline SVG icon.
		 *
		 * @param string $path SVG inner markup.
		 * @return string
		 */
		protected function icon( $path ) {
			return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' . $path . '</svg>';
		}

		/**
		 * Render dashboard via the framework builder.
		 *
		 * @return void
		 */
		protected function render() {
			$data     = $this->data;
			$coverage = $data['coverage'];
			$labels   = DDWCHPG_Dashboard_Helper::ddwchpg_get_reason_labels();
			$pending  = array_filter(
				$data['checklist'],
				function ( $step ) {
					return ! $step['done'];
				}
			);

			$reasons = [];
			foreach ( $coverage['reasons'] as $reason => $count ) {
				$reasons[] = [
					'label' => $labels[ $reason ] ?? $reason,
					'value' => $count,
				];
			}

			$share = $coverage['total'] ? round( $coverage['protected'] / $coverage['total'] * 100 ) : 0;

			new DDFW_Dashboard(
				[
					'columns'       => 3,
					'header'        => [
						/* translators: %s: current user display name. */
						'welcome'  => esc_html__( 'Welcome back, %s!', 'devdiggers-hide-price-for-woocommerce' ),
						'subtitle' => esc_html__( 'Which prices are hidden, and how often visitors try to see them', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'summary_cards' => [
						[
							'title'      => esc_html__( 'Protected Products', 'devdiggers-hide-price-for-woocommerce' ),
							'value'      => number_format_i18n( $coverage['protected'] ) . ' / ' . number_format_i18n( $coverage['total'] ) . ( $coverage['truncated'] ? '+' : '' ),
							'value_type' => 'text',
							'note'       => esc_html__( 'Published products, right now', 'devdiggers-hide-price-for-woocommerce' ),
							'icon'       => $this->icon( '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>' ),
						],
						[
							'title'      => esc_html__( 'Catalog Protected', 'devdiggers-hide-price-for-woocommerce' ),
							'value'      => $share . '%',
							'value_type' => 'text',
							'note'       => esc_html__( 'Share of published products, right now', 'devdiggers-hide-price-for-woocommerce' ),
							'icon'       => $this->icon( '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>' ),
						],
						[
							'title'       => esc_html__( 'Button Clicks', 'devdiggers-hide-price-for-woocommerce' ),
							'value'       => $data['clicks']['value'],
							'change'      => $data['clicks']['change'],
							'is_positive' => $data['clicks']['change'] >= 0,
							'previous'    => number_format_i18n( $data['clicks']['previous'] ),
							'note'        => null !== $data['clicks']['change'] && 0.0 === round( (float) $data['clicks']['change'], 1 ) ? esc_html__( 'No change vs previous period', 'devdiggers-hide-price-for-woocommerce' ) : '',
							'icon'        => $this->icon( '<path d="M9 9l5 12 1.8-5.2L21 14 9 9z"/><path d="M7.2 2.2 8 5.1M5.1 8l-2.9-.8M14 4.1 12 6M6 12l-1.9 2"/>' ),
						],
					],
					'charts'        => [
						[
							'id'         => 'ddwchpg-clicks',
							'title'      => esc_html__( 'Button Clicks', 'devdiggers-hide-price-for-woocommerce' ),
							'date_label' => $data['date_range']['label'],
							'type'       => 'bar',
							'data'       => $data['timeline'],
							'x_key'      => 'date',
							'series'     => [
								[
									'key'   => 'clicks',
									'label' => esc_html__( 'Button Clicks', 'devdiggers-hide-price-for-woocommerce' ),
									'color' => '#0256ff',
								],
							],
							'empty'      => [
								'title' => esc_html__( 'No clicks in this period', 'devdiggers-hide-price-for-woocommerce' ),
								'desc'  => esc_html__( 'Each time a visitor clicks the button that replaces add to cart, it shows up here.', 'devdiggers-hide-price-for-woocommerce' ),
							],
						],
						[
							'id'        => 'ddwchpg-reasons',
							'title'     => esc_html__( 'Why Prices Are Hidden', 'devdiggers-hide-price-for-woocommerce' ),
							'type'      => 'doughnut',
							'data'      => $reasons,
							'label_key' => 'label',
							'value_key' => 'value',
							'empty'     => [
								'title' => esc_html__( 'No protected products', 'devdiggers-hide-price-for-woocommerce' ),
								'desc'  => esc_html__( 'Protected products are grouped here by the setting that hides them.', 'devdiggers-hide-price-for-woocommerce' ),
							],
						],
					],
					'widgets'       => [
						$pending ? [
							'title'  => esc_html__( 'Finish Setting Up', 'devdiggers-hide-price-for-woocommerce' ),
							'width'  => 'half',
							'render' => [ $this, 'ddwchpg_render_checklist' ],
						] : [
							'title'  => esc_html__( 'Most Clicked Products', 'devdiggers-hide-price-for-woocommerce' ),
							'width'  => 'half',
							'render' => [ $this, 'ddwchpg_render_top_products' ],
						],
						[
							'width'  => 'half',
							'render' => [ $this, 'ddwchpg_render_pro_card' ],
						],
					],
				]
			);
		}

		/**
		 * Upgrade card under the figures.
		 *
		 * @return void
		 */
		public function ddwchpg_render_pro_card() {
			ddfw_upgrade_to_pro_section(
				[
					'image_url'     => DDWCHPG_Admin_Dashboard::ddwchpg_get_pro_image( 'analytics' ),
					'heading'       => esc_html__( 'See which hidden prices turn into customers', 'devdiggers-hide-price-for-woocommerce' ),
					'description'   => esc_html__( 'Pro follows each click through to the login, the new account or the quote request it led to.', 'devdiggers-hide-price-for-woocommerce' ),
					'list_features' => [
						esc_html__( 'Logins and signups that came from a hidden price, day by day', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Click to login rate, compared with the previous period', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Quote requests by status, and the latest ones at a glance', 'devdiggers-hide-price-for-woocommerce' ),
						esc_html__( 'Protected products grouped by the rule that hides them', 'devdiggers-hide-price-for-woocommerce' ),
					],
					'upgrade_url'   => 'https://devdiggers.com/product/woocommerce-hide-price-for-guest/',
				]
			);
		}

		/**
		 * Setup checklist widget body.
		 *
		 * @return void
		 */
		public function ddwchpg_render_checklist() {
			$steps = $this->data['checklist'];
			$done  = count( array_filter( wp_list_pluck( $steps, 'done' ) ) );
			?>
			<div class="ddwchpg-checklist">
				<div class="ddwchpg-checklist-progress" role="progressbar" aria-valuemin="0" aria-valuemax="<?php echo esc_attr( count( $steps ) ); ?>" aria-valuenow="<?php echo esc_attr( $done ); ?>">
					<span style="width:<?php echo esc_attr( round( $done / max( 1, count( $steps ) ) * 100 ) ); ?>%"></span>
				</div>
				<p class="ddwchpg-checklist-count">
					<?php
					/* translators: 1: completed steps, 2: total steps. */
					printf( esc_html__( '%1$d of %2$d steps done', 'devdiggers-hide-price-for-woocommerce' ), absint( $done ), count( $steps ) );
					?>
				</p>
				<?php foreach ( $steps as $step ) : ?>
					<a class="ddwchpg-checklist-item<?php echo esc_attr( $step['done'] ? ' ddwchpg-checklist-item-done' : '' ); ?>" href="<?php echo esc_url( $step['url'] ); ?>">
						<span class="ddwchpg-checklist-mark" aria-hidden="true"><?php echo esc_html( $step['done'] ? '✓' : '' ); ?></span>
						<span class="ddwchpg-checklist-info">
							<strong><?php echo esc_html( $step['title'] ); ?></strong>
							<?php if ( ! $step['done'] ) : ?>
								<span><?php echo esc_html( $step['desc'] ); ?></span>
							<?php endif; ?>
						</span>
					</a>
				<?php endforeach; ?>
			</div>
			<?php
		}

		/**
		 * Most clicked products widget.
		 *
		 * @return void
		 */
		public function ddwchpg_render_top_products() {
			$items = [];

			foreach ( $this->data['top_products'] as $product_id => $clicks ) {
				$product = wc_get_product( $product_id );

				if ( ! $product ) {
					continue;
				}

				$items[] = [
					'url'         => get_edit_post_link( $product->get_id(), 'raw' ),
					'title'       => $product->get_name(),
					'image'       => $product->get_image( [ 72, 72 ] ),
					/* translators: %s: number of clicks. */
					'value'       => esc_html( sprintf( _n( '%s click', '%s clicks', $clicks, 'devdiggers-hide-price-for-woocommerce' ), number_format_i18n( $clicks ) ) ),
					'value_class' => 'positive',
				];
			}

			DDFW_Dashboard::render_list( $items, __( 'No clicks yet', 'devdiggers-hide-price-for-woocommerce' ) );
		}
	}
}
