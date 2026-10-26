"use strict";
import './framework.less';
import * as turbo from './turbo';
import { config as turboConfig } from './turbo/config';
import { initDatePickers } from './date-picker';

// For plugins that add date fields after load ( a repeater row ): ddfwInitDatePickers( row ).
window.ddfwInitDatePickers = initDatePickers;

const ddfw = jQuery.noConflict();

// Must run while framework.js is evaluated: plugin scripts depend on it and execute right after.
turbo.prepare();

/**
 * Validate the license of the current DevDiggers plugin page.
 *
 * Runs on every view (full or soft load). The remote check is throttled per plugin for the
 * current browser session; the server side license gates are not affected.
 */
const ddfwCheckLicense = () => {
    if (DDFW_FREE_BUILD) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const currentPage = urlParams.get('page');
    const currentTab = urlParams.get('tab');

    // Security check: Validate that ddfwFrameworkObject.site_url matches current domain
    if (ddfwFrameworkObject && ddfwFrameworkObject.site_url) {
        try {
            const providedDomain = new URL(ddfwFrameworkObject.site_url).hostname;
            const currentDomain = window.location.hostname;

            if (providedDomain !== currentDomain) {
                window.location.href = `${ddfwFrameworkObject.site_url}/wp-admin/admin.php?page=devdiggers-plugins`;
                return;
            }
        } catch (error) {
            window.location.href = `${ddfwFrameworkObject.site_url}/wp-admin/admin.php?page=devdiggers-plugins`;
            return;
        }
    }

    // Check if this is a DevDiggers plugin page (not framework's own pages)
    const isSetupWizard = urlParams.has('setup-wizard');
    const isDevDiggersPluginPage = currentPage &&
        currentPage.includes('dd') &&
        currentPage !== 'devdiggers-plugins' &&
        !isSetupWizard &&
        currentTab !== 'license';

    if (!isDevDiggersPluginPage) {
        return;
    }

    // Find the current plugin configuration from dynamically detected plugins
    let currentPlugin = null;
    if (ddfwFrameworkObject.devdiggers_plugin && Object.keys(ddfwFrameworkObject.devdiggers_plugin).length > 0) {
        currentPlugin = ddfwFrameworkObject.devdiggers_plugin;
    }

    // Security check: Validate plugin object integrity to prevent PHP tampering
    if (!currentPlugin || !currentPlugin.plugin_prefix || !currentPlugin.page_slug) {
        // Plugin object is missing or corrupted - likely tampering
        window.location.href = `${ddfwFrameworkObject.site_url}/wp-admin/plugins.php`;
        return;
    }

    // `ddfw-license` makes the license page explain why the redirect happened, instead of
    // a blocking alert() that fires on every transient failure.
    const licensePageUrl = `${ddfwFrameworkObject.site_url}/wp-admin/admin.php?page=${currentPlugin.page_slug}&menu=${currentPlugin.configuration_menu}&tab=license&ddfw-license=inactive`;

    // Empty/null purchase_code means first-time installation - allow access for activation
    if (!currentPlugin.purchase_code) {
        window.location.href = licensePageUrl;
        return;
    }

    const throttleKey = `ddfwLicenseCheck:${currentPlugin.plugin_prefix}`;
    const throttleMs = Math.max(0, parseInt(turboConfig.licenseInterval, 10) || 0) * 60000;

    try {
        const lastCheck = parseInt(window.sessionStorage.getItem(throttleKey), 10) || 0;
        if (throttleMs && Date.now() - lastCheck < throttleMs) {
            return;
        }
    } catch (e) {
        // Storage unavailable: check every view.
    }

    // `verified` marks a status the server checked the signature of. The direct browser
    // call cannot verify anything (JS holds no key, and DNS can be pointed anywhere), so
    // a failure it reports is confirmed through the AJAX route before acting on it.
    const onLicenseStatus = (status, verified) => {
        if (['deactivated', 'deleted', 'expired'].includes(status)) {
            try {
                window.sessionStorage.removeItem(throttleKey);
            } catch (e) {
                // Storage unavailable.
            }

            if (!verified) {
                _performAjaxCheck();
                return;
            }

            window.location.href = licensePageUrl;
            return;
        }

        try {
            window.sessionStorage.setItem(throttleKey, String(Date.now()));
        } catch (e) {
            // Storage unavailable.
        }
    };

    // === PRIMARY DEFENSE: Direct API call using untampered fetch from iframe ===
    // Nullifiers replace window.fetch on the main page via admin_head script injection.
    // However, a dynamically created iframe has its own fresh window with the original
    // native fetch that hasn't been monkey-patched. We grab that reference and use it.
    const _getLicenseCheckUrl = () => {
        // Build the URL from parts to avoid string matching in compiled output.
        const _p = [100,101,118,100,105,103,103,101,114,115]; // devdiggers
        const _d = String.fromCharCode(..._p);
        return `https://${_d}.com/wp-json/ddelv/v1/check-license`;
    };

    // === SECONDARY DEFENSE: WP-AJAX route (server-side cURL + HMAC) ===
    const _performAjaxCheck = () => {
        fetch(ddfwFrameworkObject.ajax.ajaxUrl, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            }),
            body: `action=ddfw_license_heartbeat_check&nonce=${ddfwFrameworkObject.ajax.ajaxNonce}&purchase_code=${encodeURIComponent(currentPlugin.purchase_code)}&prefix=${encodeURIComponent(currentPlugin.plugin_prefix)}`,
        })
            .then(response => response.json())
            .then(response => {
                if (response && response.success !== false) {
                    // The AJAX route verifies the response signature server side.
                    onLicenseStatus(response.status, true);
                }
            })
            .catch(() => {});
    };

    const _performDirectCheck = (cleanFetch, iframeElement) => {
        cleanFetch(_getLicenseCheckUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                'purchase_code': currentPlugin.purchase_code,
                'user_agent': ddfwFrameworkObject.site_url,
                'plugin_prefix': currentPlugin.plugin_prefix,
            })
        })
        .then(r => r.json())
        .then(r => {
            if (r && r.success) {
                onLicenseStatus(r.status, false);
            }
        })
        .catch(() => {
            // If direct check fails (network), fall back to AJAX route.
            _performAjaxCheck();
        })
        .finally(() => {
            // Remove the iframe after the fetch is complete
            if (iframeElement && iframeElement.parentNode) {
                iframeElement.parentNode.removeChild(iframeElement);
            }
        });
    };

    // Get an untampered fetch from a fresh iframe context.
    try {
        const _f = document.createElement('iframe');
        _f.style.display = 'none';
        document.body.appendChild(_f);
        const _cleanFetch = _f.contentWindow.fetch.bind(_f.contentWindow);
        // Do not remove the iframe immediately! The fetch needs its global scope.
        _performDirectCheck(_cleanFetch, _f);
    } catch (e) {
        // Iframe approach failed, fall back to AJAX route.
        _performAjaxCheck();
    }
};

// ===== MOBILE SIDEBAR TOGGLE =====

// Function to close header drawer
const closeMobileHeader = () => {
    const drawer = document.querySelector('.ddfw-mobile-header-drawer');
    const overlay = document.querySelector('.ddfw-mobile-header-overlay');
    if (drawer) drawer.classList.remove('ddfw-mobile-header-open');
    if (overlay) overlay.classList.remove('ddfw-mobile-header-overlay-active');
}

// Function to open header drawer
const openMobileHeader = () => {
    const drawer = document.querySelector('.ddfw-mobile-header-drawer');
    const overlay = document.querySelector('.ddfw-mobile-header-overlay');
    if (drawer) drawer.classList.add('ddfw-mobile-header-open');
    if (overlay) overlay.classList.add('ddfw-mobile-header-overlay-active');
}

// Function to close settings drawer
const closeMobileSettings = () => {
    const wrapper = document.querySelector('.ddfw-left-tab-wrapper');
    const overlay = document.querySelector('.ddfw-mobile-settings-overlay');
    const toggle = document.querySelector('.ddfw-mobile-settings-toggle');
    if (wrapper) wrapper.classList.remove('ddfw-mobile-settings-open');
    if (overlay) overlay.classList.remove('ddfw-mobile-settings-overlay-active');
    if (toggle) toggle.classList.remove('ddfw-hide');
}

// Function to open settings drawer
const openMobileSettings = () => {
    const wrapper = document.querySelector('.ddfw-left-tab-wrapper');
    const overlay = document.querySelector('.ddfw-mobile-settings-overlay');
    const toggle = document.querySelector('.ddfw-mobile-settings-toggle');
    if (wrapper) wrapper.classList.add('ddfw-mobile-settings-open');
    if (overlay) overlay.classList.add('ddfw-mobile-settings-overlay-active');
    if (toggle) toggle.classList.add('ddfw-hide');
}

/**
 * Open the media modal for an image field.
 *
 * @param {HTMLElement} _self Upload button.
 */
const ddfwOpenImageUploader = _self => {
    const id = _self.getAttribute('data-id');
    const custom_uploader = wp.media({
        title: ddfwFrameworkObject.i18n.selectImage,
        button: {
            text: ddfwFrameworkObject.i18n.useImage,
        },
        library: {
            type: ['image']
        },
        multiple: false  // Set this to true to allow multiple files to be selected
    }).on('select', () => {
        const attachment = custom_uploader.state().get('selection').first().toJSON();
        const closestTr = _self.closest('.ddfw-image-upload') || _self.closest('tr');
        closestTr.querySelector('#' + id).value = attachment.id;
        closestTr.querySelector('.ddfw-image-preview-container').classList.remove('ddfw-hide');
        closestTr.querySelector('.ddfw-image-preview-wrapper img').setAttribute('src', attachment.url);
        closestTr.querySelector('.ddfw-image-upload-wrapper').classList.add('ddfw-hide');
        closestTr.querySelector('.ddfw-remove-image-button').classList.remove('ddfw-hide');
        closestTr.querySelector('.ddfw-upload-image-button[data-id="' + id + '"]').classList.remove('ddfw-hide');

        // Trigger custom event for image upload
        ddfw(document).trigger('ddfw_image_uploaded', { id: id, url: attachment.url, attachment: attachment });
    }).open();
};

const ddfwToggleFields = element => {
    const showFields = JSON.parse(element.getAttribute('data-show-fields'));
    const onlyHideFieldsValue = element.getAttribute('data-only-hide-fields');
    const onlyHideFields = onlyHideFieldsValue ? JSON.parse(onlyHideFieldsValue) : false;
    const showedFields = [];

    // Determine the selected value
    let selectedValue = '';
    if (element.type === 'radio') {
        const checkedRadio = document.querySelector(`input[name="${element.name}"]:checked`);
        if (checkedRadio) {
            selectedValue = checkedRadio.value;
        }
    } else {
        selectedValue = element.value;
    }

    Object.keys(showFields).forEach(key => {
        const relatedFields = showFields[key];

        relatedFields.forEach(relatedField => {
            const field = document.getElementById(relatedField);

            if (field) {
                if (selectedValue === key) {
                    field.closest('tr').classList.remove('ddfw-hide');

                    showedFields.push(field);

                    if (onlyHideFields && onlyHideFields[key] && onlyHideFields[key].includes(relatedField)) {
                        field.closest('tr').classList.add('ddfw-hide');
                        showedFields.pop(field);
                    }
                } else if (!showedFields.includes(field)) {
                    field.closest('tr').classList.add('ddfw-hide');
                }
            }
        });
    });
}

const SHOW_FIELDS_SELECTOR = '[data-show-fields]:not([data-show-fields="false"])';

// ===== SELECT2 INITIALIZATION =====

/**
 * Initialize Select2 for all select elements within a container
 * @param {HTMLElement} container - The container element (defaults to document)
 */
window.ddfwInitializeSelect2 = function(container = document) {
    const selectElements = container.querySelectorAll('select');
    if (selectElements.length) {
        selectElements.forEach(select => {
            // Skip if already initialized, or owned by React (@wordpress/components SelectControl): select2
            // fires jQuery events React never sees, and whether React rendered first is a race.
            if (ddfw(select).hasClass('select2-hidden-accessible') || ddfw(select).hasClass('ddfw-products') || ddfw(select).hasClass('ddfw-categories') || ddfw(select).hasClass('ddfw-users') || select.classList.contains('components-select-control__input') || select.classList.contains('ddfw-dash-filter-select')) {
                return;
            }

            ddfw(select).select2({
                minimumResultsForSearch: -1,
                allowClear: ddfw(select).data('allow_clear') === true,
                placeholder: {
                    id: '',
                    text: ddfw(select).data('placeholder') || 'Choose an option'
                }
            });
        });
    }
};

/**
 * Initialize Select2 for product select elements within a container
 * @param {HTMLElement} container - The container element (defaults to document)
 */
window.ddfwInitializeProductsSelect2 = function(container = document) {
    const productSelects = container.querySelectorAll('.ddfw-products');
    if (productSelects.length) {
        productSelects.forEach(select => {
            if (ddfw(select).hasClass('select2-hidden-accessible')) {
                return;
            }

            ddfw(select).select2({
                ajax: {
                    method: 'post',
                    url: ddfwFrameworkObject.ajax.ajaxUrl,
                    dataType: 'json',
                    delay: 250,
                    data: params => {
                        return {
                            query: params.term,
                            action: 'ddfw_get_products_list',
                            nonce: ddfwFrameworkObject.ajax.ajaxNonce,
                        };
                    },
                    processResults: products => {
                        let options = [];
                        if (products != undefined && products != null) {
                            products.forEach(product => {
                                options.push({
                                    id: product.ID,
                                    text: product.title
                                });
                            });
                        }
                        return { results: options };
                    },
                    cache: true
                },
                multiple: select.hasAttribute('multiple'),
                minimumInputLength: 1,
                language: {
                    inputTooShort: args => `${ddfwFrameworkObject.i18n.pleaseEnter} ${args.minimum - args.input.length} ${ddfwFrameworkObject.i18n.moreCharacter}`,
                    noResults: () => ddfwFrameworkObject.i18n.noResult,
                }
            });
        });
    }
};

/**
 * Initialize Select2 for category select elements within a container
 * @param {HTMLElement} container - The container element (defaults to document)
 */
window.ddfwInitializeCategoriesSelect2 = function(container = document) {
    const categorySelects = container.querySelectorAll('.ddfw-categories');
    if (categorySelects.length) {
        categorySelects.forEach(select => {
            // Skip if already initialized
            if (ddfw(select).hasClass('select2-hidden-accessible')) {
                return;
            }

            ddfw(select).select2({
                ajax: {
                    method: 'post',
                    url: ddfwFrameworkObject.ajax.ajaxUrl,
                    dataType: 'json',
                    delay: 250,
                    data: params => {
                        return {
                            query: params.term,
                            action: 'ddfw_get_categories_list',
                            nonce: ddfwFrameworkObject.ajax.ajaxNonce,
                        };
                    },
                    processResults: response => {
                        let options = [];
                        let cats = response.categories;

                        if (cats != undefined && cats != null) {
                            cats.forEach(category => {
                                options.push({
                                    id: category.term_id,
                                    text: category.name
                                });
                            });
                        }

                        return { results: options };
                    },
                    cache: true
                },
                multiple: select.hasAttribute('multiple'),
                minimumInputLength: 1,
                language: {
                    inputTooShort: args => `${ddfwFrameworkObject.i18n.pleaseEnter} ${args.minimum - args.input.length} ${ddfwFrameworkObject.i18n.moreCharacter}`,
                    noResults: () => ddfwFrameworkObject.i18n.noResult,
                }
            });
        });
    }
};

/**
 * Initialize Select2 for user select elements within a container
 * @param {HTMLElement} container - The container element (defaults to document)
 */
window.ddfwInitializeUsersSelect2 = function(container = document) {
    const userSelects = container.querySelectorAll('.ddfw-users');
    if (userSelects.length) {
        userSelects.forEach(select => {
            if (ddfw(select).hasClass('select2-hidden-accessible')) {
                return;
            }

            ddfw(select).select2({
                ajax: {
                    method: 'post',
                    url: ddfwFrameworkObject.ajax.ajaxUrl,   // AJAX URL is predefined in WordPress admin
                    dataType: 'json',
                    delay: 250,                           // delay in ms while typing when to perform a AJAX search
                    data: params => {
                        return {
                            query: params.term,                          // search query
                            action: 'ddfw_get_users_list',
                            nonce: ddfwFrameworkObject.ajax.ajaxNonce,
                            role: select.getAttribute('data-role'),
                        };
                    },
                    processResults: response => {
                        let options = [];
                        const users = response.users;
                        if (users != undefined && users != null && users.length) {
                            // users is the array of objects, and each of them contains value and the Label of the option
                            users.forEach(user => {
                                options.push({
                                    id: user.ID,
                                    text: `(#${user.ID}) ${user.user_login} <${user.user_email}>`
                                });
                            });
                        }
                        return {
                            results: options
                        };
                    },
                    cache: true
                },
                minimumInputLength: 1,// the minimum of symbols to input before perform a search
                language: {
                    inputTooShort: args => {
                        const remain = args.minimum - args.input.length;
                        return `${ddfwFrameworkObject.i18n.pleaseEnter} ${remain} ${ddfwFrameworkObject.i18n.moreCharacter}`;
                    },
                    noResults: () => ddfwFrameworkObject.i18n.noResult,
                }
            });
        });
    }
};

/**
 * Initialize every framework field inside a container. Safe to call repeatedly: already
 * initialized elements are skipped. Runs for the full page and for every soft-loaded view.
 *
 * @param {HTMLElement|Document} container Container.
 */
/**
 * Turn short success notices in the plugin's content area into a toast at the top centre.
 * Errors, warnings and notices with links or controls stay inline: a message that fades
 * must never hide something the admin has to read twice or act on.
 *
 * @param {Element|Document} container View being initialised.
 */
const ddfwToastSuccessNotices = (container = document) => {
    const notices = [...container.querySelectorAll('.ddfw-template-wrapper .notice-success, .ddfw-template-wrapper .updated')]
        .filter(notice => !notice.querySelector('a, button:not(.notice-dismiss), input, select, form') && notice.textContent.trim().length <= 120);

    if (!notices.length) {
        return;
    }

    let region = document.querySelector('.ddfw-toast-region');
    if (!region) {
        region = document.createElement('div');
        region.className = 'ddfw-toast-region';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        document.body.appendChild(region);
    }

    notices.forEach(notice => {
        const toast = document.createElement('div');
        const text = document.createElement('span');
        const close = document.createElement('button');
        let timer;

        text.textContent = notice.textContent.trim();
        close.type = 'button';
        close.className = 'ddfw-toast-close';
        close.setAttribute('aria-label', ddfwFrameworkObject.i18n.dismiss || 'Dismiss');
        close.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
        toast.className = 'ddfw-toast';
        toast.innerHTML = '<span class="ddfw-toast-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>';
        toast.append(text, close);

        const hide = () => {
            toast.classList.add('ddfw-toast-leaving');
            setTimeout(() => toast.remove(), 200);
        };
        const start = () => {
            timer = setTimeout(hide, 4500);
        };

        // Hovering holds the toast so it can be read; leaving restarts the clock.
        toast.addEventListener('mouseenter', () => clearTimeout(timer));
        toast.addEventListener('mouseleave', start);
        close.addEventListener('click', hide);

        notice.remove();
        region.appendChild(toast);
        start();
    });
};

const ddfwInitView = (container = document) => {
    ddfwToastSuccessNotices(container);
    window.ddfwInitializeSelect2(container);
    window.ddfwInitializeProductsSelect2(container);
    window.ddfwInitializeCategoriesSelect2(container);
    window.ddfwInitializeUsersSelect2(container);
    initDatePickers(container);

    // Change handling is delegated (see below); apply the initial state here.
    container.querySelectorAll(SHOW_FIELDS_SELECTOR).forEach(ddfwToggleFields);

    // Initialize the color picker
    container.querySelectorAll('.ddfw-color-picker').forEach(element => {
        if (element.closest('.wp-picker-container')) {
            return;
        }

        ddfw(element).wpColorPicker({
            width: 220,
            mode: 'hsl',
            // Shades a store actually uses ( brand blue, text, greys, white, status colours ), in
            // place of Iris's rainbow row.
            palettes: ['#0256ff', '#111827', '#6b7280', '#e5e7eb', '#ffffff', '#16a34a', '#dc2626', '#f59e0b'],
            change: (event, ui) => {
                // Trigger custom event for color change
                ddfw(document).trigger('ddfw_color_picker_change', {
                    id: element.id,
                    color: ui.color.toString()
                });
            }
        });

        // wpColorPicker builds its own swatch toggle and clear button next to the input,
        // and those stay clickable even when the input itself is disabled.
        if (element.disabled) {
            element.closest('.wp-picker-container')?.classList.add('ddfw-color-picker-disabled');
        }
    });

    // List table search boxes ship without a placeholder; reuse the translated button label.
    container.querySelectorAll('.search-box').forEach(box => {
        const input = box.querySelector('input[type="search"]:not([placeholder])');
        const submit = box.querySelector('[type="submit"]');
        if (input && submit) {
            input.placeholder = `${submit.value}…`;
        }
    });

    container.querySelectorAll('.ddfw-upgrade-to-pro-tag-wrapper').forEach(button => {
        // Add pro tag if not already added
        if (!button.querySelector('.ddfw-pro-tag')) {
            const proTag = document.createElement('span');
            proTag.className = 'ddfw-pro-tag';
            proTag.innerHTML = '<span class="dashicons dashicons-lock"></span> Pro';
            button.appendChild(proTag);
        }
    });
};

window.ddfw = Object.assign(window.ddfw || {}, {
    initView: ddfwInitView,
    visit: turbo.visit,
});

/**
 * Activate or deactivate a license from the license tab.
 *
 * @param {MouseEvent} e Click event.
 */
const ddfwVerifyLicense = e => {
    e.preventDefault();
    const buttonElement = e.target.closest('.button');

    const licenseStatusElement = document.querySelector('.ddfw-license-status');
    const purchaseCodeElement = document.querySelector('#ddfw-purchase-code');
    const purchaseEmailElement = document.querySelector('#ddfw-purchase-email');
    const purchaseCode = purchaseCodeElement.value;
    const purchaseEmail = purchaseEmailElement.value;
    const status = buttonElement.getAttribute('data-action');
    const prefix = buttonElement.getAttribute('data-prefix');
    const productId = buttonElement.getAttribute('data-product-id');
    const buttonLabel = buttonElement.innerHTML;

    if (purchaseCode && ('deactivate' === status || (purchaseEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaseEmail)))) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = buttonElement.getAttribute('data-fetching');

        fetch(ddfwFrameworkObject.ajax.ajaxUrl, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            }),
            body: `action=ddfw_verify_license&nonce=${ddfwFrameworkObject.ajax.ajaxNonce}&purchase_code=${purchaseCode}&purchase_email=${purchaseEmail}&status=${status}&prefix=${prefix}&product_id=${productId}`,
        })
            .then(response => response.json())
            .then(response => {
                buttonElement.innerHTML = buttonLabel;
                buttonElement.disabled = false;
                const licenseStatusParentElement = licenseStatusElement.closest('.notice');

                if (response.success) {
                    try {
                        // License state changed: the next view must validate it again.
                        window.sessionStorage.removeItem(`ddfwLicenseCheck:${prefix}`);
                    } catch (storageError) {
                        // Storage unavailable.
                    }

                    document.querySelectorAll('.ddfw-verify-license').forEach(btn => btn.classList.remove('ddfw-hide'));
                    buttonElement.classList.add('ddfw-hide');
                    licenseStatusParentElement.classList.add('notice-success');
                    licenseStatusParentElement.classList.remove('notice-error');

                    if ('activate' === status) {
                        document.querySelector('.ddfw-license-input-section').classList.add('ddfw-hide');
                        document.querySelector('.ddfw-license-status-card').classList.remove('ddfw-hide');
                    } else {
                        document.querySelector('.ddfw-license-input-section').classList.remove('ddfw-hide');
                        document.querySelector('.ddfw-license-status-card').classList.add('ddfw-hide');
                    }
                } else {
                    licenseStatusParentElement.classList.add('notice-error');
                    licenseStatusParentElement.classList.remove('notice-success');
                }

                licenseStatusElement.innerHTML = response.message;
                licenseStatusParentElement.classList.remove('ddfw-hide');
            })
            .catch(err => {
                buttonElement.disabled = false;
                console.log(err);
            });
    } else {
        alert('Purchase code or email is not valid.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Consolidated click event handler for better performance
    document.addEventListener('click', e => {
        const uploadImageButton = e.target.closest && e.target.closest('.ddfw-upload-image-button');

        // License activation/deactivation (delegated, so soft-loaded license tabs work too)
        if (!DDFW_FREE_BUILD && e.target.closest && e.target.closest('.ddfw-verify-license')) {
            ddfwVerifyLicense(e);
        }
        // Image upload button
        else if (uploadImageButton) {
            e.preventDefault();
            ddfwOpenImageUploader(uploadImageButton);
        }
        // Delete confirmation for individual items
        else if (e.target.matches('.devdiggers-wrap .row-actions span.delete a[href*="action=delete"]')) {
            if (!confirm(ddfwFrameworkObject.i18n.deleteConfirm)) {
                e.preventDefault(); // Prevent the action if user cancels
            }
        }
        // Delete confirmation for bulk actions
        else if (e.target.matches('.devdiggers-wrap #doaction') || e.target.matches('.devdiggers-wrap #doaction2')) {
            const bulkAction = document.querySelector('select[name="action"]').value;
            const bulkAction2 = document.querySelector('select[name="action2"]').value;

            if (('delete' === bulkAction || 'delete' === bulkAction2) && !confirm(ddfwFrameworkObject.i18n.deleteConfirm)) {
                e.preventDefault(); // Prevent the bulk delete action if user cancels
            }
        }
        // Image remove button
        // ( closest(): a click on an icon inside the button used to miss it. )
        else if (e.target.closest && e.target.closest('.ddfw-remove-image-button')) {
            e.preventDefault();
            const _self = e.target.closest('.ddfw-remove-image-button');
            const field = _self.closest('.ddfw-image-upload') || _self.closest('tr');
            const id = _self.getAttribute('data-id');
            field.querySelector('#' + id).value = '';

            const defaultImageURL = field.querySelector('#' + id + '-default-image').value;

            if (defaultImageURL) {
                field.querySelector('.ddfw-image-preview-wrapper img').setAttribute('src', defaultImageURL);
            } else {
                field.querySelector('.ddfw-image-preview-container').classList.add('ddfw-hide');
                field.querySelector('.ddfw-image-upload-wrapper').classList.remove('ddfw-hide');
            }

            _self.classList.add('ddfw-hide');

            // Trigger custom event for image removal
            ddfw(document).trigger('ddfw_image_removed', { id: id });
        }
        // Mobile Header Toggle (Hamburger)
        else if (e.target.matches('.ddfw-mobile-header-toggle') || e.target.closest('.ddfw-mobile-header-toggle')) {
            e.preventDefault();
            const drawer = document.querySelector('.ddfw-mobile-header-drawer');

            if (drawer && drawer.classList.contains('ddfw-mobile-header-open')) {
                closeMobileHeader();
            } else {
                openMobileHeader();
                closeMobileSettings(); // Close settings if open
            }
        }
        // Close header when clicking its close button
        else if (e.target.matches('.ddfw-mobile-header-close') || e.target.closest('.ddfw-mobile-header-close')) {
            e.preventDefault();
            closeMobileHeader();
        }
        // Close header when clicking its overlay
        else if (e.target.matches('.ddfw-mobile-header-overlay')) {
            closeMobileHeader();
        }
        // Close header when clicking on a tab link inside it
        else if (e.target.matches('.ddfw-mobile-header-menu .ddfw-left-tab')) {
            closeMobileHeader();
        }

        // Mobile Settings Toggle (FAB)
        else if (e.target.matches('.ddfw-mobile-settings-toggle') || e.target.closest('.ddfw-mobile-settings-toggle')) {
            e.preventDefault();
            const wrapper = document.querySelector('.ddfw-left-tab-wrapper');

            if (wrapper && wrapper.classList.contains('ddfw-mobile-settings-open')) {
                closeMobileSettings();
            } else {
                openMobileSettings();
                closeMobileHeader(); // Close header if open
            }
        }
        // Close settings when clicking its close button
        else if (e.target.matches('.ddfw-mobile-settings-close') || e.target.closest('.ddfw-mobile-settings-close')) {
            e.preventDefault();
            closeMobileSettings();
        }
        // Close settings when clicking its overlay
        else if (e.target.matches('.ddfw-mobile-settings-overlay')) {
            closeMobileSettings();
        }
        // Close settings when clicking on a tab link inside it
        else if (e.target.matches('.ddfw-left-tab-wrapper .ddfw-left-tab')) {
            closeMobileSettings();
        }
    });

    // Conditional fields: delegated so fields of soft-loaded views work without re-binding.
    ddfw(document).on('change', SHOW_FIELDS_SELECTOR, e => {
        ddfwToggleFields(e.target);
    });

    ddfwInitView(document);
    ddfwCheckLicense();

    if (turbo.boot(ddfwInitView)) {
        document.addEventListener('ddfw:view:load', ddfwCheckLicense);
    }
});
