# DevDiggers Hide Price for WooCommerce

**Plugin URI:** https://devdiggers.com/product/woocommerce-hide-price-for-guest/
**Pro Demo:** https://demo.devdiggers.com/woocommerce-hide-price-for-guest/
**Documentation:** https://docs.devdiggers.com/woocommerce-hide-price-for-guest/
**Text domain:** `devdiggers-hide-price-for-woocommerce` · **Prefix:** `ddwchpg`

| Requirement | Version |
| --- | --- |
| WordPress | 6.5+ (tested up to 7.1) |
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

## Data

| Storage | Purpose |
| --- | --- |
| `_ddwchpg_*` options | Settings. Keys are shared with Pro, so upgrading keeps them; Pro converts `hide_scope`, `allowed_products` and `allowed_categories` into its first rule. |
| `ddwchpg_click_stats` (not autoloaded) | Daily click totals (400 days) and the 200 most clicked products. No personal data. |
| `ddwchpg_coverage` transient | Cached coverage scan, 12 hours, flushed on settings and product save. |

No custom tables, cron jobs, REST routes or remote requests. One AJAX action: `ddwchpg_track_click` (nonce checked, public).

Every setting is registered with an explicit `sanitize_callback` (`DDWCHPG_Admin_Functions::ddwchpg_get_setting_groups()`), and the setup wizard saves through the same list. Saving needs the menu capability (`manage_woocommerce` when WooCommerce is active), set with `option_page_capability_{group}`.

## Hooks

- `ddwchpg_hide_reason` (filter): why a product's price is hidden (`all`, `selected`, `override`) or `''` to show it.
- `ddwchpg_is_viewer_targeted` (filter): whether prices can be hidden from the current visitor.
- `ddwchpg_action_button_html` (filter): the replacement button markup.
- `ddwchpg_loaded` (action): fires when the plugin instance loads.

## Free and Pro together

When the Pro plugin (`DDWCHPG_Init`) is active, the free plugin does not load. Both share the `ddwchpg` prefix and option names.

## Development

```bash
npm install
npm run build                   # compile src/ into assets/, replace the framework text domain, build the .pot
php bin/test-free-boundary.php  # assert no Pro code ships in the free plugin
npm run build:release           # zip for WordPress.org (src/ and the build config ship in it)
```

`bin/test-free-boundary.php` also guards the WordPress.org review fixes: no locked Pro fields, every upgrade card has its blurred Pro screenshot from `assets/images/pro/`, no `extract()` in the bundled framework, inline sanitize callbacks.

## Support

- Support forum: https://wordpress.org/support/plugin/devdiggers-hide-price-for-woocommerce/
- Contact: https://devdiggers.com/contact/

## Changelog

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
