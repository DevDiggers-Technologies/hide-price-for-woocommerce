<?php
/**
 * Self-check for the Free/Pro boundary.
 *
 * Every Pro feature is meant to be physically absent from this plugin, not switched off.
 * The easy ways to break that are a rebuild from a stale source tree or a file copied
 * across from the Pro plugin. This asserts that neither has happened.
 *
 *   php bin/test-free-boundary.php
 *
 * @package DevDiggers Hide Price for WooCommerce
 */

$root   = dirname( __DIR__ ) . '/';
$errors = [];

/**
 * Read a file, or return '' when it is absent.
 *
 * @param string $path Absolute path.
 * @return string
 */
function ddwchpg_read( $path ) {
	return file_exists( $path ) ? (string) file_get_contents( $path ) : '';
}

/**
 * Every PHP file that belongs to this plugin, excluding the bundled framework and tooling.
 *
 * @param string $root Plugin root.
 * @return string[]
 */
function ddwchpg_plugin_php( $root ) {
	$files    = [];
	$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ) );

	foreach ( $iterator as $file ) {
		$path = $file->getPathname();

		if ( 'php' !== strtolower( $file->getExtension() ) ) {
			continue;
		}

		foreach ( [ '/node_modules/', '/devdiggers-framework/', '/bin/', '/build/' ] as $skip ) {
			if ( false !== strpos( $path, $skip ) ) {
				continue 2;
			}
		}

		$files[ str_replace( $root, '', $path ) ] = ddwchpg_read( $path );
	}

	return $files;
}

$php = ddwchpg_plugin_php( $root );

// 1. Pro-only files are gone, not merely unhooked.
foreach ( [
	'includes/install.php',
	'includes/emails/email-quote-base.php',
	'includes/emails/email-quote-admin.php',
	'includes/emails/email-quote-customer.php',
	'includes/common/tracking-functions.php',
	'includes/common/tracking-hooks.php',
	'helper/rule-helper.php',
	'helper/quote-helper.php',
	'helper/event-helper.php',
	'templates/admin/rules/rules-list-template.php',
	'templates/admin/rules/manage-rule-template.php',
	'templates/admin/quotes/quotes-list-template.php',
	'templates/admin/configuration/configuration-license.php',
	'templates/emails/quote-request.php',
	'tests/rules-check.php',
] as $file ) {
	if ( file_exists( $root . $file ) ) {
		$errors[] = "Pro file {$file} is shipped.";
	}
}

// 2. No licensing, updater or remote notifications. WordPress.org rejects a free plugin
// that phones home for a key, reachable or not.
foreach ( $php as $relative => $contents ) {
	foreach ( [ 'ddfw_is_license_activated', 'ddfw_register_plugin_for_updates', '_ddwchpg_purchase_code', 'DevDiggers_Notifications', 'DDFW_Plugin_Updater', 'wp_remote_' ] as $needle ) {
		if ( false !== strpos( $contents, $needle ) ) {
			$errors[] = "Licensing or remote call '{$needle}' is present in {$relative}.";
		}
	}
}

foreach ( [ 'includes/class-ddfw-plugin-updater.php', 'includes/class-devdiggers-notifications.php', 'includes/class-ddfw-plugin-dependency.php', 'templates/layout/license.php', 'assets/js/notifications.js' ] as $file ) {
	if ( file_exists( $root . 'devdiggers-framework/' . $file ) ) {
		$errors[] = "Bundled framework ships {$file}.";
	}
}

// 3. No Pro registrations: tables, cron, REST, quote emails, login attribution, quote AJAX.
foreach ( $php as $relative => $contents ) {
	foreach ( [ 'dbDelta', 'register_rest_route', 'wp_schedule_event', 'wp_schedule_single_event', 'wp_unschedule_hook', 'woocommerce_email_classes', "'wp_login'", 'woocommerce_created_customer', 'ddwchpg_submit_quote', 'setcookie', '$_COOKIE', '$wpdb' ] as $needle ) {
		if ( false !== strpos( $contents, $needle ) ) {
			$errors[] = "Pro registration '{$needle}' is present in {$relative}.";
		}
	}
}

// 4. No Pro business logic left behind in shared files: rules engine, quotes, countries, events.
foreach ( $php as $relative => $contents ) {
	foreach ( [ 'DDWCHPG_Rule_Helper', 'DDWCHPG_Quote_Helper', 'DDWCHPG_Event_Helper', 'DDWCHPG_Tracking', '_ddwchpg_rules', 'ddwchpg_quotes', 'ddwchpg_events', 'country_mode', 'geolocate_ip', 'quote_notify_email', 'quote_success_message', "'quote'", 'start_date', 'ddwchpg_maybe_migrate_legacy_rules' ] as $needle ) {
		if ( false !== strpos( $contents, $needle ) ) {
			$errors[] = "Pro logic '{$needle}' is present in {$relative}.";
		}
	}
}

// 5. Only Free settings are registered and the wizard saves through the same allowlist,
// so a crafted options.php or wizard POST has nothing Pro to write.
$admin_functions = ddwchpg_read( $root . 'includes/admin/admin-functions.php' );

foreach ( [ "'countries'", "'quote_button_title'", "'quote_customer_copy'", 'ddwchpg-license-fields' ] as $needle ) {
	if ( false !== strpos( $admin_functions, $needle ) ) {
		$errors[] = "Pro setting {$needle} is registered in includes/admin/admin-functions.php.";
	}
}

if ( false === strpos( ddwchpg_read( $root . 'includes/admin/setup-wizard.php' ), 'ddwchpg_get_setting_groups' ) ) {
	$errors[] = 'The setup wizard no longer saves through the settings allowlist.';
}

// 6. The built bundles carry no Pro flow, and still do the Free job.
$front_bundle = ddwchpg_read( $root . 'assets/js/front.js' );

if ( '' === $front_bundle || '' === ddwchpg_read( $root . 'assets/css/admin.css' ) ) {
	$errors[] = 'Built assets are missing. Run `npm run build`.';
}

foreach ( [ 'ddwchpg_submit_quote', 'quote', 'ddwchpg_ref', 'document.cookie', 'localStorage', 'console.log', 'ddwchpg-condition' ] as $needle ) {
	foreach ( [ 'assets/js/front.js' => $front_bundle, 'assets/js/admin.js' => ddwchpg_read( $root . 'assets/js/admin.js' ) ] as $bundle => $contents ) {
		if ( false !== strpos( $contents, $needle ) ) {
			$errors[] = "Pro identifier '{$needle}' is present in {$bundle}.";
		}
	}
}

foreach ( [ 'ddwchpg_track_click', 'found_variation', 'ddwchpg-modal-login' ] as $needle ) {
	if ( '' !== $front_bundle && false === strpos( $front_bundle, $needle ) ) {
		$errors[] = "Free behaviour '{$needle}' is missing from assets/js/front.js.";
	}
}

// 7. Every built asset maps to a webpack entry.
$webpack = ddwchpg_read( $root . 'webpack.config.js' );

foreach ( [ 'assets/js', 'assets/css' ] as $dir ) {
	foreach ( (array) glob( $root . $dir . '/*' ) as $path ) {
		$name = basename( $path );

		if ( 'index.php' !== $name && false === strpos( $webpack, '"' . pathinfo( $name, PATHINFO_FILENAME ) . '"' ) ) {
			$errors[] = "{$dir}/{$name} has no webpack entry.";
		}
	}
}

// 8. The Free bootstrap yields to Pro and loads the framework on its own pages.
$bootstrap = ddwchpg_read( $root . 'functions.php' );

foreach ( [ "class_exists( 'DDWCHPG_Init' )", "'ddwchpg' !== \$prefix", 'DDWCHPG_Free_Init' ] as $needle ) {
	if ( false === strpos( $bootstrap, $needle ) ) {
		$errors[] = "Bootstrap guard '{$needle}' is missing from functions.php.";
	}
}

// 9. No constants or upgrade routine a first release has no use for. Asset versions come
// from filemtime(), and the Pro link is written where it is used.
foreach ( $php as $relative => $contents ) {
	foreach ( [ 'DDWCHPG_VERSION', 'PRO_URL', 'ddwchpg_maybe_upgrade', 'ddwchpg_version' ] as $needle ) {
		if ( false !== strpos( $contents, $needle ) ) {
			$errors[] = "Unneeded '{$needle}' is present in {$relative}.";
		}
	}
}

// 10. Option keys are shared with Pro, so upgrading keeps every setting. Pro converts the
// scope keys below into its first rule; renaming any of them silently loses the setup.
$file_handler = ddwchpg_read( $root . 'includes/file-handler.php' );

foreach ( [ "'hide_scope'", "'allowed_products'", "'allowed_categories'", "'target_roles'", "'excluded_products'", "'_ddwchpg_enable_hide_price'" ] as $needle ) {
	if ( false === strpos( $file_handler, $needle ) ) {
		$errors[] = "Pro-compatible option key {$needle} is missing from includes/file-handler.php.";
	}
}

// 11. WordPress.org review findings on earlier DevDiggers plugins stay fixed.
foreach ( $php as $relative => $contents ) {
	// A disabled Pro field is read as trialware; Pro features show as upgrade cards only.
	if ( false !== strpos( $contents, 'ddfw_locked_field' ) ) {
		$errors[] = "Locked Pro field (ddfw_locked_field) is present in {$relative}.";
	}

	// Every upgrade card carries its blurred Pro screenshot.
	if ( substr_count( $contents, 'upgrade_to_pro_section(' ) !== substr_count( $contents, "'image_url'" ) ) {
		$errors[] = "An upgrade card without image_url is present in {$relative}.";
	}
}

if ( false !== strpos( ddwchpg_read( $root . 'devdiggers-framework/templates/layout/upgrade-to-pro.php' ), 'extract( $args )' ) ) {
	$errors[] = 'The bundled framework upgrade template uses extract().';
}

if ( false === strpos( $admin_functions, 'option_page_capability_' ) || false === strpos( $admin_functions, "'sanitize_callback' => \$args['sanitize_callback']" ) ) {
	$errors[] = 'Settings must register an inline sanitize_callback and the menu save capability.';
}

foreach ( glob( $root . 'assets/images/pro/*.webp' ) as $image ) {
	if ( false === strpos( implode( '', $php ), "ddwchpg_get_pro_image( '" . basename( $image, '.webp' ) . "' )" ) ) {
		$errors[] = 'Unused upgrade image ' . basename( $image ) . '.';
	}
}

if ( $errors ) {
	echo "Free/Pro boundary check FAILED:\n";

	foreach ( $errors as $error ) {
		echo ' - ' . $error . "\n";
	}

	exit( 1 );
}

echo "Free/Pro boundary check passed.\n";
