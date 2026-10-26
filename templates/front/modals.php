<?php
/**
 * Login popup opened by the "Login to see the price" button.
 *
 * @package DevDiggers Hide Price for WooCommerce
 * @version 1.0.0
 */

defined( 'ABSPATH' ) || exit();
?>
<div class="ddwchpg-modal" id="ddwchpg-modal-login" role="dialog" aria-modal="true" aria-labelledby="ddwchpg-login-title" hidden>
	<div class="ddwchpg-modal-overlay" data-ddwchpg-close></div>
	<div class="ddwchpg-modal-content">
		<button type="button" class="ddwchpg-modal-close" data-ddwchpg-close aria-label="<?php esc_attr_e( 'Close', 'devdiggers-hide-price-for-woocommerce' ); ?>">&times;</button>
		<h3 id="ddwchpg-login-title"><?php esc_html_e( 'Login to see prices', 'devdiggers-hide-price-for-woocommerce' ); ?></h3>
		<?php woocommerce_login_form( [ 'redirect' => '' ] ); ?>
		<?php if ( 'yes' === get_option( 'woocommerce_enable_myaccount_registration' ) ) : ?>
			<p class="ddwchpg-modal-footer">
				<?php esc_html_e( 'New here?', 'devdiggers-hide-price-for-woocommerce' ); ?>
				<a href="<?php echo esc_url( wc_get_page_permalink( 'myaccount' ) ); ?>" class="ddwchpg-register-link"><?php esc_html_e( 'Create an account', 'devdiggers-hide-price-for-woocommerce' ); ?></a>
			</p>
		<?php endif; ?>
	</div>
</div>
