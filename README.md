# Hide Price for WooCommerce - Login to See Price, Hide Add to Cart & Catalog Mode

**Plugin URI:** https://devdiggers.com/product/woocommerce-hide-price-for-guest/
**Live Demo:** https://demo.devdiggers.com/hide-price-for-woocommerce/
**Pro Demo:** https://demo.devdiggers.com/woocommerce-hide-price-for-guest/
**Documentation:** https://docs.devdiggers.com/woocommerce-hide-price-for-guest/
**Text domain:** `devdiggers-hide-price-for-woocommerce` · **Prefix:** `ddwchpg`

| Requirement | Version |
| --- | --- |
| WordPress | 6.9+ (tested up to 7.1) |
| WooCommerce | 9.0+ (tested up to 11.2) |
| PHP | 7.4+ |

Hides WooCommerce prices and the Add to Cart button from guests or any user role, on the whole catalog or on selected products and categories. Visitors see your own message and a replacement button (login popup, custom URL or none) instead. The price is also removed from schema markup and Store API responses, and the purchase is blocked on the server.

This is the free edition of [Hide Price Pro](https://devdiggers.com/product/woocommerce-hide-price-for-guest/). Pro adds the rules engine, request a quote, country rules and conversion analytics.

## Features

- Audience: guests (pseudo role `ddwchpg_guest`) plus any registered role.
- What to hide: price and Add to Cart, or Add to Cart only.
- Scope: all products, or selected products, variations and categories. Exclusions for products and categories.
- Per-product override (`_ddwchpg_visibility` post meta: `hide`, `show`).
- Price message with HTML and `{login_url}`, `{register_url}`, `{product_name}`; text and badge colors.
- Replacement button: login popup with redirect back to the product, custom URL, or none.
- Protection: `woocommerce_is_purchasable`, schema (`woocommerce_structured_data_product`) and Store API (`rest_post_dispatch` on `/wc/store/*/products`, plus the `price_range` of `products/collection-data`).
- Block themes: `render_block_woocommerce/add-to-cart-form` and `add-to-cart-with-options` are swapped for the replacement button.
- Logged-in roles never get a login button; with the login action they get a "Learn more" link to the custom URL when one is set.
- Variable and grouped products: the parent price range is rebuilt from the children the visitor may see.
- Dashboard: protected product coverage, click counter, setup checklist. Setup wizard.

### AI assistants (MCP)

Ask Claude, ChatGPT, Cursor, VS Code or any MCP client in plain words: "Which products hide their price from guests?", "Why can a customer see the price of this product?", "Is the login button getting clicks?"

- Tools: an overview (setup, protected products and reasons, button clicks against the previous period), the products with a hidden price, and a check of one product for any role (why it is hidden or shown and what visitors see instead)
- A Hidden price audit prompt
- Optional: let the assistant set a product's "Price visibility" override (always hide, always show or follow the settings), off until you allow changes and logged under WooCommerce > Status > Logs
- Store managers only; customers and visitors are refused
- Managed in DevDiggers Plugins > AI & MCP: an on / off switch per plugin and per write tool (write tools start off), a Try panel and an activity log
- Needs WordPress 6.9+ (Abilities API) and the MCP Adapter, which WooCommerce 10.3+ bundles. With Pro active, Pro's own tools take over under the same Hide Price entry

## Data

| Storage | Purpose |
| --- | --- |
| `_ddwchpg_*` options | Settings. Keys are shared with Pro, so upgrading keeps them; Pro converts `hide_scope`, `allowed_products` and `allowed_categories` into its first rule. |
| `ddwchpg_click_stats` (not autoloaded) | Daily click totals (400 days) and the 200 most clicked products. No personal data. |
| `ddwchpg_coverage` transient | Cached coverage scan, 12 hours, flushed on settings and product save. |

No custom tables, cron jobs, REST routes of its own or remote requests (the AI tools are WordPress Abilities, served by the Abilities API). One AJAX action: `ddwchpg_track_click` (nonce checked, public).

Every setting is registered with an explicit `sanitize_callback` (`DDWCHPG_Admin_Functions::ddwchpg_get_setting_groups()`), and the setup wizard saves through the same list. Saving needs the menu capability (`manage_woocommerce` when WooCommerce is active), set with `option_page_capability_{group}`.

## Hooks

- `ddwchpg_hide_reason` (filter): why a product's price is hidden (`all`, `selected`, `override`) or `''` to show it.
- `ddwchpg_is_viewer_targeted` (filter): whether prices can be hidden from the current visitor.
- `ddwchpg_action_button_html` (filter): the replacement button markup.
- `ddwchpg_loaded` (action): fires when the plugin instance loads.
- `ddwchpg_mcp_abilities` (filter): add, change or remove the AI assistant (MCP) tools, defined in `includes/integrations/mcp-integration.php` under the `hide-price/` namespace.

## Free and Pro together

When the Pro plugin (`DDWCHPG_Init`) is active, the free plugin does not load. Both share the `ddwchpg` prefix and option names.

## Development

```bash
npm install
npm run build                   # compile src/ into assets/, replace the framework text domain, build the .pot
php bin/test-free-boundary.php  # assert no Pro code ships in the free plugin
npm run build:release           # zip for WordPress.org (dev files such as src/ and the build config are left out by .distignore)
```

`bin/test-free-boundary.php` also guards the WordPress.org review fixes: no locked Pro fields, every upgrade card has its blurred Pro screenshot from `assets/images/pro/`, no `extract()` in the bundled framework, inline sanitize callbacks.

## Support

- Support forum: https://wordpress.org/support/plugin/devdiggers-hide-price-for-woocommerce/
- Contact: https://devdiggers.com/contact/

## Changelog

### 1.1.0
- Added: AI assistants (MCP). Ask Claude, ChatGPT, Cursor, VS Code or any MCP client which products hide their price, why a product's price is hidden or shown for a role, and how often the replacement button is clicked, with a Hidden price audit prompt.
- Added: An optional AI tool to set a product's Price visibility override (always hide, always show or follow the settings). It stays off until you turn on Allow changes.
- Added: DevDiggers Plugins > AI & MCP page. Connect Claude, ChatGPT, Claude Code, Codex, Cursor, VS Code or any MCP client by signing in and clicking Allow in WordPress, with nothing to copy. Turn each plugin and each write tool on or off, try tools in the Try panel and check the activity log.
- Improved: Updated the DevDiggers framework to 1.3.0. On edit screens the title bar with Save stays visible while you scroll on desktop.
- Improved: The plugin zip no longer includes the development source and build files. The full source stays in the public GitHub repository.
- Fixed: Charts and pickers no longer break when a theme or plugin replaces the shared select2 script.

### 1.0.0
- Initial free release.
- Hide prices and the Add to Cart button from guests, any user role, or both.
- Hide the price and Add to Cart together, or only the Add to Cart button and keep prices public.
- Protect all products, or only selected products, variations and categories, with product and category exclusions.
- Price visibility setting on every product: always hide, always show, or follow the plugin settings.
- Your own message in place of the price, with HTML, {login_url}, {register_url} and {product_name} placeholders and badge colours.
- Replacement button: a login popup that returns the visitor to the same product, a link to your own page, or no button.
- Leak proof hiding: protected products cannot be bought through direct links or the Cart block, and prices are removed from schema markup, the Store API and the Filter by Price block.
- Works with classic and block themes, variable and grouped products, and quick view plugins.
- Dashboard with protected products, button clicks and a setup checklist, plus a four step setup wizard.
- Shop Managers can open and save the settings.
- Translation ready, with WPML support for the price text, button text and custom URL.
