<?php
/**
 * This file handles all front end action callbacks.
 *
 * @version 1.0.0
 * @package DevDiggers Hide Price for WooCommerce
 */

namespace DDWCHidePriceForGuest\Includes\Front;

use DDWCHidePriceForGuest\Helper\DDWCHPG_Product_Helper;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_Front_Functions' ) ) {
	/**
	 * Front Functions Handler
	 */
	class DDWCHPG_Front_Functions {
		/**
		 * Product Helper variable
		 *
		 * @var DDWCHPG_Product_Helper
		 */
		protected $product_helper;

		/**
		 * Configuration Variable
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Whether a button on this page opens the login popup.
		 *
		 * @var bool
		 */
		protected $login_modal = false;

		/**
		 * Price HTML of parents with hidden children, by product ID.
		 *
		 * @var array
		 */
		protected $partial_prices = [];

		/**
		 * Construct
		 *
		 * @param array $ddwchpg_configuration Configuration array.
		 */
		public function __construct( $ddwchpg_configuration ) {
			$this->ddwchpg_configuration = $ddwchpg_configuration;
			$this->product_helper        = new DDWCHPG_Product_Helper( $ddwchpg_configuration );
		}

		/**
		 * Whether the price of a product is hidden for this visitor.
		 *
		 * @param mixed $product Product.
		 * @return bool
		 */
		protected function is_hidden( $product ) {
			return $this->product_helper->ddwchpg_check_product_to_hide_price( $product );
		}

		/**
		 * Permalink of the product page (parent for variations).
		 *
		 * @param \WC_Product $product Product.
		 * @return string
		 */
		protected function get_product_url( $product ) {
			return get_permalink( $product->is_type( 'variation' ) ? $product->get_parent_id() : $product->get_id() );
		}

		/**
		 * My Account URL that brings the visitor back to the product after login.
		 *
		 * @param \WC_Product $product Product.
		 * @return string
		 */
		protected function get_login_url( $product ) {
			return add_query_arg( 'redirect_url', rawurlencode( $this->get_product_url( $product ) ), wc_get_page_permalink( 'myaccount' ) );
		}

		/**
		 * Replacement price markup.
		 *
		 * @param \WC_Product $product Product.
		 * @return string
		 */
		public function ddwchpg_get_price_message( $product ) {
			$text    = (string) $this->ddwchpg_configuration['price_title'];
			$message = strtr(
				'' !== $text ? $text : esc_html__( 'Login to view price', 'devdiggers-hide-price-for-woocommerce' ),
				[
					'{login_url}'    => esc_url( $this->get_login_url( $product ) ),
					'{register_url}' => esc_url( $this->get_login_url( $product ) ),
					'{product_name}' => esc_html( $product->get_name() ),
				]
			);

			return '<span class="ddwchpg-price-message">' . wp_kses_post( $message ) . '</span>';
		}

		/**
		 * Replacement button markup for the configured action, or '' for none.
		 *
		 * @param \WC_Product $product Product.
		 * @return string
		 */
		public function ddwchpg_get_action_button( $product ) {
			$action     = $this->ddwchpg_configuration['button_action'];
			$title      = (string) $this->ddwchpg_configuration['button_title'];
			$product_id = $product->is_type( 'variation' ) ? $product->get_parent_id() : $product->get_id();
			$attributes = [
				'class'           => trim( 'button ddwchpg-button ' . implode( ' ', array_map( 'sanitize_html_class', explode( ' ', $this->ddwchpg_configuration['button_class'] ) ) ) ),
				'data-product-id' => $product_id,
			];

			// Already logged in (role targeting): a login button makes no sense, the custom URL
			// (for example a trade application page) does when one is set.
			if ( 'login' === $action && is_user_logged_in() ) {
				$action = 'custom_url';
				$title  = esc_html__( 'Learn more', 'devdiggers-hide-price-for-woocommerce' );
			}

			if ( 'login' === $action ) {
				$attributes['href'] = $this->get_login_url( $product );

				if ( 'yes' === $this->ddwchpg_configuration['login_popup'] ) {
					$attributes['data-ddwchpg-modal'] = 'login';
					$attributes['data-redirect']      = $this->get_product_url( $product );
					$this->login_modal                = true;
				}
			} elseif ( 'custom_url' === $action && '' !== $this->ddwchpg_configuration['custom_url'] ) {
				$attributes['href'] = $this->ddwchpg_configuration['custom_url'];
			} else {
				return '';
			}

			$html = '';
			foreach ( $attributes as $name => $value ) {
				$html .= ' ' . $name . '="' . ( 'href' === $name ? esc_url( $value ) : esc_attr( $value ) ) . '"';
			}

			/**
			 * Filter the replacement button markup.
			 *
			 * @since 1.0.0
			 */
			return wp_kses_post( apply_filters( 'ddwchpg_action_button_html', '<a' . $html . '>' . esc_html( '' !== $title ? $title : esc_html__( 'Login to purchase', 'devdiggers-hide-price-for-woocommerce' ) ) . '</a>', $product, $action ) );
		}

		/**
		 * Replace the price HTML.
		 *
		 * @param string      $price   Price HTML.
		 * @param \WC_Product $product Product.
		 * @return string
		 */
		public function ddwchpg_remove_price_from_the_site( $price, $product ) {
			if ( $this->is_hidden( $product ) ) {
				return $this->ddwchpg_get_price_message( $product );
			}

			$partial = $this->ddwchpg_get_partial_price_html( $product );

			return null === $partial ? $price : $partial;
		}

		/**
		 * A variable or grouped product whose own price shows can still shows a price range built from its
		 * children, which would name the price of a child that is hidden. Rebuild the range from the
		 * children the visitor may see, or show the message when every child is hidden.
		 *
		 * @param \WC_Product $product Product.
		 * @return string|null Null when no child is hidden and the normal price can show.
		 */
		public function ddwchpg_get_partial_price_html( $product ) {
			if ( ! $product instanceof \WC_Product || ! $product->is_type( [ 'variable', 'grouped' ] ) ) {
				return null;
			}

			$id = $product->get_id();

			if ( array_key_exists( $id, $this->partial_prices ) ) {
				return $this->partial_prices[ $id ];
			}

			$children = $product->is_type( 'variable' ) ? $product->get_visible_children() : $product->get_children();
			$prices   = [];
			$hidden   = false;

			foreach ( $children as $child_id ) {
				$child = wc_get_product( $child_id );

				if ( ! $child ) {
					continue;
				}

				if ( $this->is_hidden( $child ) ) {
					$hidden = true;
					continue;
				}

				if ( '' !== $child->get_price() ) {
					$prices[] = (float) wc_get_price_to_display( $child );
				}
			}

			if ( ! $hidden ) {
				$html = null;
			} elseif ( ! $prices ) {
				$html = $this->ddwchpg_get_price_message( $product );
			} else {
				$min  = min( $prices );
				$max  = max( $prices );
				$html = ( $min === $max ? wc_price( $min ) : wc_format_price_range( $min, $max ) ) . $product->get_price_suffix();
			}

			$this->partial_prices[ $id ] = $html;

			return $html;
		}

		/**
		 * Replace the loop add to cart button.
		 *
		 * @param string      $button  Button HTML.
		 * @param \WC_Product $product Product.
		 * @return string
		 */
		public function ddwchpg_remove_add_to_cart_button( $button, $product ) {
			return $this->is_hidden( $product ) ? $this->ddwchpg_get_action_button( $product ) : $button;
		}

		/**
		 * Swap the single product add to cart form for the action button.
		 *
		 * Variable products keep their form: each variation is handled in
		 * ddwchpg_filter_available_variation() since the decision can differ per variation.
		 *
		 * @return void
		 */
		public function ddwchpg_remove_single_add_to_cart_button() {
			global $product;

			if ( $product instanceof \WC_Product && ! $product->is_type( 'variable' ) && $this->is_hidden( $product ) ) {
				remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30 );
				add_action( 'woocommerce_single_product_summary', [ $this, 'ddwchpg_custom_single_add_to_cart_button' ], 30 );
			}
		}

		/**
		 * Print the single product action button.
		 *
		 * @return void
		 */
		public function ddwchpg_custom_single_add_to_cart_button() {
			global $product;

			echo '<div class="ddwchpg-single-action">' . wp_kses_post( $this->ddwchpg_get_action_button( $product ) ) . '</div>';
		}

		/**
		 * Swap the block theme add to cart form for the action button.
		 *
		 * Variable products keep their form, as in ddwchpg_remove_single_add_to_cart_button().
		 *
		 * @param string         $content Block HTML.
		 * @param array          $block   Parsed block.
		 * @param \WP_Block|null $instance Block instance.
		 * @return string
		 */
		public function ddwchpg_filter_add_to_cart_block( $content, $block, $instance = null ) {
			$product_id = $instance instanceof \WP_Block && ! empty( $instance->context['postId'] ) ? $instance->context['postId'] : get_the_ID();
			$product    = wc_get_product( $product_id );

			if ( ! $product || $product->is_type( 'variable' ) || ! $this->is_hidden( $product ) ) {
				return $content;
			}

			return '<div class="ddwchpg-single-action">' . $this->ddwchpg_get_action_button( $product ) . '</div>';
		}

		/**
		 * Hide price and purchase for protected variations in the variation form.
		 *
		 * @param array       $data      Variation data.
		 * @param \WC_Product $parent_product Parent product.
		 * @param \WC_Product $variation Variation.
		 * @return array
		 */
		public function ddwchpg_filter_available_variation( $data, $parent_product, $variation ) {
			if ( $this->is_hidden( $variation ) ) {
				if ( 'cart' !== $this->ddwchpg_configuration['hide_mode'] ) {
					$data['price_html'] = $this->ddwchpg_get_price_message( $variation );
				}

				$data['availability_html'] = '<div class="ddwchpg-single-action">' . $this->ddwchpg_get_action_button( $variation ) . '</div>';
				$data['is_purchasable']    = false;
				$data['ddwchpg_hidden']    = true;
			}

			return $data;
		}

		/**
		 * Server-side purchase block: covers ?add-to-cart= URLs, the Store API cart and any
		 * theme that ignores the hidden button.
		 *
		 * @param bool        $purchasable Purchasable.
		 * @param \WC_Product $product     Product.
		 * @return bool
		 */
		public function ddwchpg_make_product_unpurchasable( $purchasable, $product ) {
			return $purchasable && ! $this->is_hidden( $product );
		}

		/**
		 * Remove the offer (price) from schema.org product markup.
		 *
		 * @param array       $markup  Markup.
		 * @param \WC_Product $product Product.
		 * @return array
		 */
		public function ddwchpg_filter_structured_data( $markup, $product ) {
			if ( $this->is_hidden( $product ) || null !== $this->ddwchpg_get_partial_price_html( $product ) ) {
				unset( $markup['offers'] );
			}

			return $markup;
		}

		/**
		 * Strip prices from Store API product responses (Cart/Checkout and product blocks).
		 *
		 * @param \WP_REST_Response $response Response.
		 * @param \WP_REST_Server   $server   Server.
		 * @param \WP_REST_Request  $request  Request.
		 * @return \WP_REST_Response
		 */
		public function ddwchpg_filter_store_api_response( $response, $server, $request ) {
			if ( ! $response instanceof \WP_REST_Response || ! preg_match( '#^/wc/store(/v\d+)?/products#', $request->get_route() ) ) {
				return $response;
			}

			// The price filter block reads the min/max price of the whole catalog from here. Any
			// protected product could set either end, so the range is withheld from this audience.
			// ponytail: blanket withhold, compute the range from visible products if a store needs the filter.
			if ( '/collection-data' === substr( $request->get_route(), -16 ) ) {
				$data = $response->get_data();

				if ( is_array( $data ) && ! empty( $data['price_range'] ) ) {
					$data['price_range'] = null;
					$response->set_data( $data );
				}

				return $response;
			}

			// Store API nests stdClass objects (prices): normalize to arrays before editing.
			$data    = json_decode( wp_json_encode( $response->get_data() ), true );
			$single  = isset( $data['id'] );
			$items   = $single ? [ $data ] : (array) $data;
			$changed = false;

			foreach ( $items as $index => $item ) {
				$product = ! empty( $item['id'] ) ? wc_get_product( $item['id'] ) : false;

				if ( ! $product ) {
					continue;
				}

				$hidden  = $this->is_hidden( $product );
				$partial = $hidden ? null : $this->ddwchpg_get_partial_price_html( $product );

				// A parent with hidden children: its price range would name them.
				if ( ! $hidden && null === $partial ) {
					continue;
				}

				foreach ( [ 'price', 'regular_price', 'sale_price' ] as $key ) {
					if ( isset( $item['prices'][ $key ] ) ) {
						$items[ $index ]['prices'][ $key ] = '';
					}
				}
				$items[ $index ]['prices']['price_range'] = null;
				$items[ $index ]['price_html']            = $hidden ? $this->ddwchpg_get_price_message( $product ) : $partial;
				$changed                                  = true;

				if ( $hidden ) {
					$items[ $index ]['is_purchasable'] = false;
					$items[ $index ]['on_sale']        = false;
				}
			}

			// Only a response that was edited goes back through the array round trip, which would
			// turn empty objects such as "extensions": {} into [].
			if ( $changed ) {
				$response->set_data( $single ? $items[0] : $items );
			}

			return $response;
		}

		/**
		 * Send the visitor back to the product after logging in, only to same-site URLs.
		 *
		 * @param string $redirect Redirect URL.
		 * @return string
		 */
		public function ddwchpg_change_my_account_redirect_url( $redirect ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- The login form itself is nonce-checked by WooCommerce.
			if ( ! empty( $_REQUEST['redirect_url'] ) ) {
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended
				return wp_validate_redirect( esc_url_raw( wp_unslash( $_REQUEST['redirect_url'] ) ), $redirect );
			}

			return $redirect;
		}

		/**
		 * Print the login popup when a button on this page uses it.
		 *
		 * @return void
		 */
		public function ddwchpg_render_modals() {
			if ( $this->login_modal ) {
				include DDWCHPG_PLUGIN_FILE . 'templates/front/modals.php';
			}
		}

		/**
		 * Front scripts and style enqueue function
		 *
		 * @return void
		 */
		public function ddwchpg_enqueue_scripts_front() {
			wp_enqueue_style( 'ddwchpg-front-style', DDWCHPG_PLUGIN_URL . 'assets/css/front.css', [], filemtime( DDWCHPG_PLUGIN_FILE . 'assets/css/front.css' ) );

			$css_vars = '';
			if ( ! empty( $this->ddwchpg_configuration['price_text_color'] ) ) {
				$css_vars .= '--ddwchpg-text-color:' . sanitize_hex_color( $this->ddwchpg_configuration['price_text_color'] ) . ';';
			}
			if ( ! empty( $this->ddwchpg_configuration['price_bg_color'] ) ) {
				$css_vars .= '--ddwchpg-bg-color:' . sanitize_hex_color( $this->ddwchpg_configuration['price_bg_color'] ) . ';--ddwchpg-padding:2px 8px;';
			}
			if ( $css_vars ) {
				wp_add_inline_style( 'ddwchpg-front-style', ':root{' . $css_vars . '}' );
			}

			wp_enqueue_script( 'ddwchpg-front-script', DDWCHPG_PLUGIN_URL . 'assets/js/front.js', [ 'jquery' ], filemtime( DDWCHPG_PLUGIN_FILE . 'assets/js/front.js' ), true );

			wp_localize_script(
				'ddwchpg-front-script',
				'ddwchpgFrontObject',
				[
					'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
					'nonce'    => wp_create_nonce( 'ddwchpg_front_nonce' ),
					'tracking' => 'yes' === $this->ddwchpg_configuration['enable_tracking'],
				]
			);
		}
	}
}
