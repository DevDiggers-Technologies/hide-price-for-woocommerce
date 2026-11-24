<?php
/**
 * MCP Integration
 *
 * Puts Hide Price in front of AI assistants (Claude, Cursor, VS Code and any MCP client). Every feature is
 * registered as a WordPress Ability (WordPress 6.9+) and announced to the DevDiggers AI & MCP hub
 * (DevDiggers Plugins > AI & MCP), which lists the tools on the shared DevDiggers MCP server, turns them on
 * or off, logs calls and offers a playground.
 *
 * Every answer comes from the plugin's own visibility logic (DDWCHPG_Product_Helper), so it matches the
 * storefront. The Pro edition replaces this plugin entirely when it is active and ships its own copy of
 * these tools under the same "hide-price" category, so the hub always shows one Hide Price entry.
 *
 * Text here goes to AI clients as JSON, so it is translated but not escaped.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.1.0
 */

namespace DDWCHidePriceForGuest\Includes\Integrations;

use DDWCHidePriceForGuest\Helper\DDWCHPG_Product_Helper;
use DDWCHidePriceForGuest\Helper\DDWCHPG_Stats_Helper;
use DDWCHidePriceForGuest\Helper\Dashboard\DDWCHPG_Dashboard_Helper;
use DDWCHidePriceForGuest\Includes\DDWCHPG_Admin_Dashboard;

defined( 'ABSPATH' ) || exit();

if ( ! class_exists( 'DDWCHPG_MCP_Integration' ) ) {
	/**
	 * MCP Integration class
	 */
	class DDWCHPG_MCP_Integration {
		/**
		 * Ability category and name prefix.
		 */
		const CATEGORY = 'hide-price';

		/**
		 * Most products one hidden-products scan reads, as the dashboard's coverage scan.
		 */
		const SCAN_LIMIT = 3000;

		/**
		 * Configuration.
		 *
		 * @var array
		 */
		protected $ddwchpg_configuration;

		/**
		 * Construct.
		 *
		 * @param array $ddwchpg_configuration Configuration.
		 */
		public function __construct( $ddwchpg_configuration ) {
			$this->ddwchpg_configuration = $ddwchpg_configuration;

			// The Abilities API arrived in WordPress 6.9.
			if ( ! function_exists( 'wp_register_ability' ) ) {
				return;
			}

			add_action( 'wp_abilities_api_categories_init', [ $this, 'ddwchpg_register_category' ] );
			add_action( 'wp_abilities_api_init', [ $this, 'ddwchpg_register_abilities' ] );
			add_filter( 'ddfw_mcp_plugins', [ $this, 'ddwchpg_add_to_hub' ] );
		}

		/**
		 * Announce Hide Price to the DevDiggers AI & MCP hub.
		 *
		 * @param array $plugins Hub plugins.
		 * @return array
		 */
		public function ddwchpg_add_to_hub( $plugins ) {
			$plugins[ self::CATEGORY ] = [
				'name'        => __( 'Hide Price', 'devdiggers-hide-price-for-woocommerce' ),
				'description' => __( 'Ask which products hide their price and from whom, why a product\'s price is hidden or shown, how many clicks the login button gets, and how price hiding is set up.', 'devdiggers-hide-price-for-woocommerce' ),
				'category'    => self::CATEGORY,
				'icon'        => DDWCHPG_Admin_Dashboard::ddwchpg_get_logo(),
				'url'         => admin_url( 'admin.php?page=ddwchpg-dashboard' ),
			];

			return $plugins;
		}

		/**
		 * Category for every Hide Price ability.
		 *
		 * @return void
		 */
		public function ddwchpg_register_category() {
			if ( wp_has_ability_category( self::CATEGORY ) ) {
				return;
			}

			wp_register_ability_category(
				self::CATEGORY,
				[
					'label'       => __( 'Hide Price', 'devdiggers-hide-price-for-woocommerce' ),
					'description' => __( 'Hidden prices: who they are hidden from, on which products, and what visitors see instead.', 'devdiggers-hide-price-for-woocommerce' ),
				]
			);
		}

		/**
		 * Register every ability.
		 *
		 * @return void
		 */
		public function ddwchpg_register_abilities() {
			foreach ( $this->ddwchpg_get_abilities() as $name => $args ) {
				$name = self::CATEGORY . '/' . $name;

				if ( wp_has_ability( $name ) ) {
					continue;
				}

				$readonly = ! empty( $args['readonly'] );

				wp_register_ability(
					$name,
					[
						'label'               => $args['label'],
						'description'         => $args['description'],
						'category'            => self::CATEGORY,
						'input_schema'        => $args['input'],
						'output_schema'       => $args['output'],
						'execute_callback'    => $args['callback'],
						'permission_callback' => isset( $args['permission'] ) ? $args['permission'] : [ $this, 'ddwchpg_can_read' ],
						'meta'                => [
							'show_in_rest' => true,
							'mcp'          => [
								'public' => true,
								'type'   => isset( $args['type'] ) ? $args['type'] : 'tool',
							],
							'annotations'  => [
								'readonly'        => $readonly,
								'destructive'     => ! $readonly,
								'idempotent'      => $readonly,
								'title'           => $args['label'],
								'readOnlyHint'    => $readonly,
								'destructiveHint' => ! $readonly,
								'idempotentHint'  => $readonly,
								'openWorldHint'   => false,
							],
						],
					]
				);
			}
		}

		/**
		 * Who may read: whoever may open the Hide Price screens.
		 *
		 * @return bool
		 */
		public function ddwchpg_can_read() {
			return is_user_logged_in() && current_user_can( ddfw_get_menu_capability() ); // phpcs:ignore WordPress.WP.Capabilities.Undetermined -- The framework's filtered menu capability.
		}

		/**
		 * Who may change a product's visibility: the same people (the tool also checks edit_product).
		 *
		 * @return bool
		 */
		public function ddwchpg_can_write() {
			return $this->ddwchpg_can_read();
		}

		/**
		 * Ability definitions.
		 *
		 * @return array
		 */
		protected function ddwchpg_get_abilities() {
			$date     = [
				'type'    => 'string',
				'pattern' => '^\d{4}-\d{2}-\d{2}$',
			];
			$product  = [
				'product_id' => [
					'type'        => 'integer',
					'minimum'     => 1,
					'description' => __( 'Product or variation ID.', 'devdiggers-hide-price-for-woocommerce' ),
				],
				'sku'        => [ 'type' => 'string' ],
			];
			$list_out = $this->ddwchpg_object_schema(
				[
					'products'    => 'array',
					'total'       => 'integer',
					'total_pages' => 'integer',
					'page'        => 'integer',
				]
			);

			$abilities = [
				'overview'             => [
					'label'       => __( 'Hide price overview', 'devdiggers-hide-price-for-woocommerce' ),
					'description' => __( 'How price hiding is set up and doing: whether it is on, who prices are hidden from (roles, "ddwchpg_guest" is logged out visitors), whether only the price or only Add to Cart is hidden, which products and categories are covered or excluded, what visitors see instead, how many published products are protected, and clicks on the replacement button for a date range against the previous period, with the most clicked products. Start here.', 'devdiggers-hide-price-for-woocommerce' ),
					'readonly'    => true,
					'input'       => $this->ddwchpg_input_schema(
						[
							'after'  => $date + [ 'description' => __( 'First day, Y-m-d in the store timezone. Defaults to 29 days before "before".', 'devdiggers-hide-price-for-woocommerce' ) ],
							'before' => $date + [ 'description' => __( 'Last day, Y-m-d. Defaults to today.', 'devdiggers-hide-price-for-woocommerce' ) ],
						]
					),
					'output'      => $this->ddwchpg_object_schema(
						[
							'settings' => 'object',
							'coverage' => 'object',
							'clicks'   => 'object',
						]
					),
					'callback'    => [ $this, 'ddwchpg_overview' ],
				],
				'list-hidden-products' => [
					'label'       => __( 'Products with a hidden price', 'devdiggers-hide-price-for-woocommerce' ),
					'description' => __( 'Published products whose price is hidden from the targeted visitors, with the reason: "all" (whole catalog), "selected" (a chosen product or category) or "override" (the product\'s own "Always hide" setting). A variable product is listed when any variation is hidden. Products set to "Always show" are listed with reason "shown_override" when you ask for them.', 'devdiggers-hide-price-for-woocommerce' ),
					'readonly'    => true,
					'input'       => $this->ddwchpg_input_schema(
						[
							'reason'   => [
								'type'    => 'string',
								'enum'    => [ 'any', 'all', 'selected', 'override', 'shown_override' ],
								'default' => 'any',
							],
							'page'     => [
								'type'    => 'integer',
								'minimum' => 1,
								'default' => 1,
							],
							'per_page' => [
								'type'    => 'integer',
								'minimum' => 1,
								'maximum' => 100,
								'default' => 20,
							],
						]
					),
					'output'      => $list_out,
					'callback'    => [ $this, 'ddwchpg_list_hidden_products' ],
				],
				'check-product'        => [
					'label'       => __( 'Check a product\'s price visibility', 'devdiggers-hide-price-for-woocommerce' ),
					'description' => __( 'Whether one product\'s price is hidden, why (whole catalog, a selected product or category, the product\'s own override, or an exclusion that keeps it visible), from which roles, whether a given role sees it, and what is shown instead (message, button and where it goes, whether buying is blocked). Find the product by ID or SKU.', 'devdiggers-hide-price-for-woocommerce' ),
					'readonly'    => true,
					'input'       => $this->ddwchpg_input_schema(
						$product + [
							'role' => [
								'type'        => 'string',
								'default'     => 'guest',
								'description' => __( 'Role key to check, such as customer or wholesale_customer, or "guest" for logged out visitors.', 'devdiggers-hide-price-for-woocommerce' ),
							],
						]
					),
					'output'      => $this->ddwchpg_object_schema(
						[
							'product'          => 'object',
							'hidden'           => 'boolean',
							'reason'           => 'string',
							'hidden_for_roles' => 'array',
							'role'             => 'object',
							'replacement'      => [ 'object', 'null' ],
						]
					),
					'callback'    => [ $this, 'ddwchpg_check_product' ],
				],
				'visibility-audit'     => [
					'type'        => 'prompt',
					'label'       => __( 'Hidden price audit', 'devdiggers-hide-price-for-woocommerce' ),
					'description' => __( 'Check that prices are hidden from the right visitors on the right products, spot gaps and leaks, and see whether the replacement button gets clicks.', 'devdiggers-hide-price-for-woocommerce' ),
					'readonly'    => true,
					'input'       => $this->ddwchpg_input_schema( [] ),
					'output'      => $this->ddwchpg_object_schema( [ 'messages' => 'array' ] ),
					'callback'    => [ $this, 'ddwchpg_prompt_visibility_audit' ],
				],
			];

			// The hub keeps write tools off until the owner turns them on; without the hub there is no switch, so no write tool.
			if ( class_exists( 'DDFW_MCP' ) ) {
				$abilities['set-product-visibility'] = [
					'label'       => __( 'Set a product\'s price visibility', 'devdiggers-hide-price-for-woocommerce' ),
					'description' => __( 'Set the "Price visibility" override on one product, as on its edit screen: "hide" always hides the price from the targeted visitors, "show" always shows it, "default" follows the plugin settings again. For a variation, the parent product is changed. Returns the previous value so the change can be undone.', 'devdiggers-hide-price-for-woocommerce' ),
					'readonly'    => false,
					'input'       => $this->ddwchpg_input_schema(
						$product + [
							'visibility' => [
								'type' => 'string',
								'enum' => [ 'default', 'hide', 'show' ],
							],
						],
						[ 'visibility' ]
					),
					'output'      => $this->ddwchpg_object_schema(
						[
							'product'    => 'object',
							'previous'   => 'string',
							'visibility' => 'string',
						]
					),
					'callback'    => [ $this, 'ddwchpg_set_product_visibility' ],
					'permission'  => [ $this, 'ddwchpg_can_write' ],
				];
			}

			/**
			 * Hide Price abilities for AI assistants (MCP). Add, change or remove one; names get the "hide-price/" prefix.
			 *
			 * @param array $abilities Ability definitions keyed by name.
			 */
			return apply_filters( 'ddwchpg_mcp_abilities', $abilities );
		}

		/**
		 * Input schema of an object; an empty call is allowed.
		 *
		 * @param array $properties Properties.
		 * @param array $required   Required properties.
		 * @return array
		 */
		protected function ddwchpg_input_schema( $properties, $required = [] ) {
			$schema = [
				'type'                 => 'object',
				'additionalProperties' => false,
				// An object in JSON ( {} ), so MCP clients read it as "no arguments needed".
				'default'              => (object) [],
			];

			if ( $properties ) {
				$schema['properties'] = $properties;
			}

			if ( $required ) {
				$schema['required'] = $required;
				unset( $schema['default'] );
			}

			return $schema;
		}

		/**
		 * Output schema: an object with the given top-level property types.
		 *
		 * @param array $types Property => JSON type (or list of types).
		 * @return array
		 */
		protected function ddwchpg_object_schema( $types ) {
			$properties = [];

			foreach ( $types as $key => $type ) {
				$properties[ $key ] = [ 'type' => $type ];
			}

			return [
				'type'       => 'object',
				'properties' => $properties,
			];
		}

		/*
		 * ---------------------------------------------------------------------------------------------
		 * Shared helpers.
		 * ---------------------------------------------------------------------------------------------
		 */

		/**
		 * A real Y-m-d day from the input, or the fallback.
		 *
		 * @param array  $input    Input.
		 * @param string $key      Key.
		 * @param string $fallback Fallback.
		 * @return string
		 */
		protected function ddwchpg_date( $input, $key, $fallback = '' ) {
			return ! empty( $input[ $key ] ) && preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $input[ $key ], $m ) && checkdate( (int) $m[2], (int) $m[3], (int) $m[1] ) ? $input[ $key ] : $fallback;
		}

		/**
		 * Role key => name, with logged out visitors as "guest".
		 *
		 * @return array
		 */
		protected function ddwchpg_role_names() {
			return array_merge( [ 'guest' => __( 'Guest (logged out)', 'devdiggers-hide-price-for-woocommerce' ) ], wp_roles()->get_names() );
		}

		/**
		 * Plugin role keys ("ddwchpg_guest" for logged out) as the AI reads them ("guest").
		 *
		 * @param array $roles Role keys.
		 * @return array
		 */
		protected function ddwchpg_public_roles( $roles ) {
			return array_values(
				array_map(
					function ( $role ) {
						return DDWCHPG_Product_Helper::GUEST_ROLE === $role ? 'guest' : $role;
					},
					(array) $roles
				)
			);
		}

		/**
		 * Find the product from product_id or sku.
		 *
		 * @param array $input Input.
		 * @return \WC_Product|\WP_Error
		 */
		protected function ddwchpg_find_product( $input ) {
			$product_id = ! empty( $input['product_id'] ) ? absint( $input['product_id'] ) : 0;

			if ( ! $product_id && ! empty( $input['sku'] ) ) {
				$product_id = wc_get_product_id_by_sku( sanitize_text_field( $input['sku'] ) );
			}

			$product = $product_id ? wc_get_product( $product_id ) : false;

			if ( ! $product ) {
				return new \WP_Error( 'ddwchpg_product_not_found', __( 'Product not found. Give a product_id or sku; hide-price-list-hidden-products lists products with a hidden price.', 'devdiggers-hide-price-for-woocommerce' ), [ 'status' => 404 ] );
			}

			return $product;
		}

		/**
		 * A short product row.
		 *
		 * @param \WC_Product $product Product.
		 * @return array
		 */
		protected function ddwchpg_product_row( $product ) {
			$parent_id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
			$override  = get_post_meta( $parent_id, '_ddwchpg_visibility', true );

			return [
				'id'         => $product->get_id(),
				'name'       => wp_strip_all_tags( $product->get_formatted_name() ),
				'type'       => $product->get_type(),
				'parent_id'  => $product->get_parent_id(),
				'visibility' => in_array( $override, [ 'hide', 'show' ], true ) ? $override : 'default',
				'edit_url'   => get_edit_post_link( $parent_id, 'raw' ),
			];
		}

		/**
		 * Names of IDs (capped).
		 *
		 * @param int[]  $ids  IDs.
		 * @param string $kind product|category.
		 * @return array
		 */
		protected function ddwchpg_named( $ids, $kind ) {
			$rows = [];

			// Settings saved empty come back as '', which is no ID.
			foreach ( array_slice( array_filter( array_map( 'absint', (array) $ids ) ), 0, 25 ) as $item_id ) {
				if ( 'category' === $kind ) {
					$term = get_term( $item_id, 'product_cat' );
					$name = $term && ! is_wp_error( $term ) ? $term->name : '';
				} else {
					$item = wc_get_product( $item_id );
					$name = $item ? wp_strip_all_tags( $item->get_formatted_name() ) : '';
				}

				$rows[] = [
					'id'   => $item_id,
					'name' => $name,
				];
			}

			return $rows;
		}

		/**
		 * Why a product's price is hidden for everyone targeted, '' when it shows. A variable product
		 * counts as hidden when any variation is, as on the dashboard.
		 *
		 * @param DDWCHPG_Product_Helper $helper  Helper.
		 * @param \WC_Product            $product Product.
		 * @return string
		 */
		protected function ddwchpg_reason( $helper, $product ) {
			$reason = $helper->ddwchpg_get_hide_reason( $product, false );

			if ( '' === $reason && $product->is_type( 'variable' ) ) {
				foreach ( $product->get_children() as $child_id ) {
					$child  = wc_get_product( $child_id );
					$reason = $child ? $helper->ddwchpg_get_hide_reason( $child, false ) : '';

					if ( '' !== $reason ) {
						break;
					}
				}
			}

			return $reason;
		}

		/*
		 * ---------------------------------------------------------------------------------------------
		 * Read tools.
		 * ---------------------------------------------------------------------------------------------
		 */

		/**
		 * Overview: settings, coverage and button clicks.
		 *
		 * @param array $input Input.
		 * @return array|\WP_Error
		 */
		public function ddwchpg_overview( $input = [] ) {
			$input  = (array) $input;
			$config = $this->ddwchpg_configuration;
			$before = $this->ddwchpg_date( $input, 'before', current_time( 'Y-m-d' ) );
			$after  = $this->ddwchpg_date( $input, 'after', gmdate( 'Y-m-d', strtotime( $before . ' -29 days' ) ) );

			if ( $after > $before ) {
				return new \WP_Error( 'ddwchpg_invalid_dates', __( '"after" must be on or before "before".', 'devdiggers-hide-price-for-woocommerce' ), [ 'status' => 400 ] );
			}

			// Same period maths as the dashboard.
			$days      = max( 1, (int) round( ( strtotime( $before ) - strtotime( $after ) ) / DAY_IN_SECONDS ) + 1 );
			$prev_to   = gmdate( 'Y-m-d', strtotime( $after . ' -1 day' ) );
			$prev_from = gmdate( 'Y-m-d', strtotime( $prev_to . ' -' . ( $days - 1 ) . ' days' ) );
			$current   = array_sum( DDWCHPG_Stats_Helper::get_range( $after, $before ) );
			$previous  = array_sum( DDWCHPG_Stats_Helper::get_range( $prev_from, $prev_to ) );
			$top       = [];

			foreach ( array_slice( DDWCHPG_Stats_Helper::get()['products'], 0, 10, true ) as $product_id => $clicks ) {
				$item  = wc_get_product( $product_id );
				$top[] = [
					'id'     => (int) $product_id,
					'name'   => $item ? wp_strip_all_tags( $item->get_formatted_name() ) : '',
					'clicks' => (int) $clicks,
				];
			}

			$coverage = ( new DDWCHPG_Dashboard_Helper( $config ) )->ddwchpg_get_coverage();
			$labels   = DDWCHPG_Dashboard_Helper::ddwchpg_get_reason_labels();
			$reasons  = [];

			foreach ( $coverage['reasons'] as $reason => $count ) {
				$reasons[] = [
					'reason' => $reason,
					'label'  => isset( $labels[ $reason ] ) ? html_entity_decode( $labels[ $reason ], ENT_QUOTES ) : $reason,
					'count'  => (int) $count,
				];
			}

			return [
				// An allow-list of what the General and Display tabs hold.
				'settings'      => [
					'enabled'              => ! empty( $config['enabled'] ),
					'hidden_from_roles'    => $this->ddwchpg_public_roles( $config['target_roles'] ),
					'hide_mode'            => $config['hide_mode'],
					'scope'                => $config['hide_scope'],
					'selected_products'    => 'selected' === $config['hide_scope'] ? $this->ddwchpg_named( $config['allowed_products'], 'product' ) : [],
					'selected_categories'  => 'selected' === $config['hide_scope'] ? $this->ddwchpg_named( $config['allowed_categories'], 'category' ) : [],
					'excluded_products'    => $this->ddwchpg_named( $config['excluded_products'], 'product' ),
					'excluded_categories'  => $this->ddwchpg_named( $config['excluded_categories'], 'category' ),
					'block_purchase'       => 'yes' === $config['block_purchase'],
					'hide_structured_data' => 'yes' === $config['hide_structured_data'],
					'hide_store_api'       => 'yes' === $config['hide_store_api'],
					'price_text'           => $config['price_title'],
					'button_text'          => $config['button_title'],
					'button_action'        => $config['button_action'],
					'custom_url'           => 'custom_url' === $config['button_action'] ? $config['custom_url'] : '',
					'login_popup'          => 'yes' === $config['login_popup'],
					'click_tracking'       => 'yes' === $config['enable_tracking'],
				],
				'coverage'      => [
					'published_products' => (int) $coverage['total'],
					'protected'          => (int) $coverage['protected'],
					'by_reason'          => $reasons,
					'truncated'          => (bool) $coverage['truncated'],
				],
				'clicks'        => [
					'after'          => $after,
					'before'         => $before,
					'clicks'         => (int) $current,
					'previous'       => (int) $previous,
					'change_percent' => $previous ? round( ( $current - $previous ) / $previous * 100, 1 ) : null,
					'top_products'   => $top,
				],
				'roles'         => array_keys( $this->ddwchpg_role_names() ),
				'dashboard_url' => admin_url( 'admin.php?page=ddwchpg-dashboard' ),
			];
		}

		/**
		 * Published products with a hidden price.
		 *
		 * @param array $input Input.
		 * @return array
		 */
		public function ddwchpg_list_hidden_products( $input = [] ) {
			$input    = (array) $input;
			$filter   = isset( $input['reason'] ) ? sanitize_key( $input['reason'] ) : 'any';
			$page     = max( 1, isset( $input['page'] ) ? absint( $input['page'] ) : 1 );
			$per_page = min( 100, max( 1, isset( $input['per_page'] ) ? absint( $input['per_page'] ) : 20 ) );
			$helper   = new DDWCHPG_Product_Helper( $this->ddwchpg_configuration );
			$matched  = [];

			// ponytail: scans up to SCAN_LIMIT products per call like the dashboard coverage; a meta index would be needed past that.
			$ids = wc_get_products(
				[
					'status'  => 'publish',
					'limit'   => self::SCAN_LIMIT,
					'return'  => 'ids',
					'orderby' => 'ID',
					'order'   => 'DESC',
				]
			);

			foreach ( $ids as $id ) {
				$item = wc_get_product( $id );

				if ( ! $item ) {
					continue;
				}

				$reason = $this->ddwchpg_reason( $helper, $item );

				if ( '' === $reason && 'show' === get_post_meta( $id, '_ddwchpg_visibility', true ) ) {
					$reason = 'shown_override';
				}

				if ( '' === $reason || ( 'any' === $filter && 'shown_override' === $reason ) || ( 'any' !== $filter && $filter !== $reason ) ) {
					continue;
				}

				$matched[] = [ $item, $reason ];
			}

			DDWCHPG_Product_Helper::ddwchpg_flush_cache();

			$total    = count( $matched );
			$products = [];

			foreach ( array_slice( $matched, ( $page - 1 ) * $per_page, $per_page ) as $row ) {
				$products[] = $this->ddwchpg_product_row( $row[0] ) + [ 'reason' => $row[1] ];
			}

			return [
				'products'    => $products,
				'enabled'     => ! empty( $this->ddwchpg_configuration['enabled'] ),
				'scanned'     => count( $ids ),
				'truncated'   => count( $ids ) >= self::SCAN_LIMIT,
				'total'       => $total,
				'total_pages' => (int) ceil( $total / $per_page ),
				'page'        => $page,
			];
		}

		/**
		 * Visibility of one product, and for one role.
		 *
		 * @param array $input Input.
		 * @return array|\WP_Error
		 */
		public function ddwchpg_check_product( $input = [] ) {
			$input   = (array) $input;
			$product = $this->ddwchpg_find_product( $input );
			$role    = ! empty( $input['role'] ) ? sanitize_key( $input['role'] ) : 'guest';

			if ( is_wp_error( $product ) ) {
				return $product;
			}

			if ( ! isset( $this->ddwchpg_role_names()[ $role ] ) ) {
				return new \WP_Error(
					'ddwchpg_unknown_role',
					/* translators: %s: role keys. */
					sprintf( __( 'Unknown role. Use one of: %s', 'devdiggers-hide-price-for-woocommerce' ), implode( ', ', array_keys( $this->ddwchpg_role_names() ) ) ),
					[ 'status' => 400 ]
				);
			}

			$config = $this->ddwchpg_configuration;
			$helper = new class( $config ) extends DDWCHPG_Product_Helper {
				/**
				 * The decision as a visitor holding only this role sees it.
				 *
				 * @param \WC_Product $product Product.
				 * @param string      $role    Role key (the plugin's guest key for logged out).
				 * @return string
				 */
				public function reason_for( $product, $role ) {
					self::ddwchpg_flush_cache();
					self::$viewer_roles = [ $role ];

					$reason = $this->ddwchpg_get_hide_reason( $product );

					self::ddwchpg_flush_cache();

					return $reason;
				}
			};

			$reason  = $this->ddwchpg_reason( $helper, $product );
			$for     = $helper->reason_for( $product, 'guest' === $role ? DDWCHPG_Product_Helper::GUEST_ROLE : $role );
			$parent  = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
			$cat_ids = array_map( 'absint', wc_get_product_term_ids( $parent, 'product_cat' ) );
			$why     = $reason;

			if ( '' === $why ) {
				if ( empty( $config['enabled'] ) ) {
					$why = 'plugin_off';
				} elseif ( 'show' === get_post_meta( $parent, '_ddwchpg_visibility', true ) ) {
					$why = 'shown_override';
				} elseif ( array_intersect( [ $product->get_id(), $parent ], array_map( 'absint', (array) $config['excluded_products'] ) ) ) {
					$why = 'excluded_product';
				} elseif ( array_intersect( $cat_ids, array_map( 'absint', (array) $config['excluded_categories'] ) ) ) {
					$why = 'excluded_category';
				} else {
					$why = 'not_selected';
				}
			}

			$hidden = '' !== $reason;

			return [
				'product'          => $this->ddwchpg_product_row( $product ),
				'hidden'           => $hidden,
				'reason'           => $why,
				'hidden_for_roles' => $hidden ? $this->ddwchpg_public_roles( $config['target_roles'] ) : [],
				'role'             => [
					'role'   => $role,
					'hidden' => '' !== $for,
				],
				'replacement'      => $hidden ? [
					'hides'          => 'price' === $config['hide_mode'] ? 'price_and_add_to_cart' : 'add_to_cart_only',
					'price_text'     => $config['price_title'],
					'button_text'    => $config['button_title'],
					'button_action'  => $config['button_action'],
					'custom_url'     => 'custom_url' === $config['button_action'] ? $config['custom_url'] : '',
					'block_purchase' => 'yes' === $config['block_purchase'],
				] : null,
			];
		}

		/*
		 * ---------------------------------------------------------------------------------------------
		 * Write tool.
		 * ---------------------------------------------------------------------------------------------
		 */

		/**
		 * Set a product's visibility override.
		 *
		 * @param array $input Input.
		 * @return array|\WP_Error
		 */
		public function ddwchpg_set_product_visibility( $input = [] ) {
			$input      = (array) $input;
			$product    = $this->ddwchpg_find_product( $input );
			$visibility = isset( $input['visibility'] ) ? sanitize_key( $input['visibility'] ) : '';

			if ( is_wp_error( $product ) ) {
				return $product;
			}

			if ( ! in_array( $visibility, [ 'default', 'hide', 'show' ], true ) ) {
				return new \WP_Error( 'ddwchpg_invalid_visibility', __( 'Visibility must be "default", "hide" or "show".', 'devdiggers-hide-price-for-woocommerce' ), [ 'status' => 400 ] );
			}

			// The override lives on the parent, as on the product edit screen.
			$target = $product->get_parent_id() ? wc_get_product( $product->get_parent_id() ) : $product;

			if ( ! $target || ! current_user_can( 'edit_product', $target->get_id() ) ) {
				return new \WP_Error( 'ddwchpg_forbidden', __( 'You may not edit this product.', 'devdiggers-hide-price-for-woocommerce' ), [ 'status' => 403 ] );
			}

			$previous = $target->get_meta( '_ddwchpg_visibility' );
			$previous = in_array( $previous, [ 'hide', 'show' ], true ) ? $previous : 'default';

			// Same storage as the edit screen's save.
			if ( 'default' === $visibility ) {
				$target->delete_meta_data( '_ddwchpg_visibility' );
			} else {
				$target->update_meta_data( '_ddwchpg_visibility', $visibility );
			}

			$target->save();

			DDWCHPG_Product_Helper::ddwchpg_flush_cache();
			DDWCHPG_Dashboard_Helper::ddwchpg_flush_coverage();

			wc_get_logger()->info(
				sprintf( 'Price visibility of product #%1$d changed from %2$s to %3$s through MCP by user #%4$d.', $target->get_id(), $previous, $visibility, get_current_user_id() ),
				[ 'source' => 'ddwchpg-mcp' ]
			);

			return [
				'product'    => $this->ddwchpg_product_row( $target ),
				'previous'   => $previous,
				'visibility' => $visibility,
			];
		}

		/*
		 * ---------------------------------------------------------------------------------------------
		 * Prompt.
		 * ---------------------------------------------------------------------------------------------
		 */

		/**
		 * Visibility audit prompt.
		 *
		 * @return array
		 */
		public function ddwchpg_prompt_visibility_audit() {
			return [
				'description' => __( 'Hidden price audit', 'devdiggers-hide-price-for-woocommerce' ),
				'messages'    => [
					[
						'role'    => 'user',
						'content' => [
							'type' => 'text',
							'text' => __(
								'Audit how my store hides prices.

Use the Hide Price tools:
1. hide-price-overview for the setup, how many products are protected and the button clicks of the last 30 days.
2. hide-price-list-hidden-products (every page) to see which products are hidden and why, and again with reason shown_override for products forced to show.
3. hide-price-check-product for two or three of the most clicked products, as a guest and as customer.

Then report:
- Whether price hiding is on, who prices are hidden from, and whether only Add to Cart or the price too is hidden.
- How many published products are protected out of how many, and the reasons.
- Gaps: products or categories you would expect to be hidden that are not (exclusions, "Always show" overrides), and leaks (buying not blocked, prices left in search results or the Store API).
- Whether the replacement button is clicked, and the most clicked products.
- Up to three changes, most important first.
Stick to what the tools return and do not change anything.',
								'devdiggers-hide-price-for-woocommerce'
							),
						],
					],
				],
			];
		}
	}
}
