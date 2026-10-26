import './setup-wizard.less';

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const DDFW_Wizard = {
        init: function() {
            this.form = document.getElementById('ddfw-setup-wizard-form');
            this.content = document.querySelector('.ddfw-setup-wizard-content');
            this.progressBar = document.querySelector('.ddfw-setup-wizard-progress-bar');
            this.stepCounter = document.querySelector('.ddfw-current-step-number');
            this.params = typeof ddfw_wizard_params !== 'undefined' ? ddfw_wizard_params : {};
            this.totalSteps = this.params.steps ? this.params.steps.length : 0;

            this.bindEvents();
        },

        bindEvents: function() {
            document.addEventListener('click', (e) => {
                const nextBtn = e.target.closest('.ddfw-setup-wizard-next');
                if (nextBtn) {
                    this.handleNext(e, nextBtn);
                }

                // Finish is handled on click like Continue. As a plain submit, the browser validated
                // every step's fields, and a hidden required one (the license key) blocked it silently.
                const finishBtn = e.target.closest('.ddfw-setup-wizard-finish');
                if (finishBtn) {
                    e.preventDefault();
                    this.finish();
                }

                const prevBtn = e.target.closest('.ddfw-setup-wizard-prev');
                if (prevBtn) {
                    this.handlePrev(e, prevBtn);
                }
            });

            if (this.form) {
                this.form.addEventListener('submit', this.handleSubmit.bind(this));
            }
        },

        handleNext: function(e, btn) {
            e.preventDefault();
            const nextStep = btn.dataset.next;
            const stepContainer = btn.closest('.ddfw-setup-wizard-step-content');
            const currentStep = stepContainer ? stepContainer.dataset.step : null;

            if (currentStep && nextStep && this.validateStep(stepContainer)) {
                this.saveStep(currentStep, nextStep);
            }
        },

        finish: function() {
            const visibleStep = document.querySelector('.ddfw-setup-wizard-step-content:not(.ddfw-hide)');
            if (visibleStep && this.validateStep(visibleStep)) {
                this.saveStep(visibleStep.dataset.step, 'finish');
            }
        },

        // Validate only the fields a user can see in the current step.
        validateStep: function(stepContainer) {
            const fields = stepContainer.querySelectorAll('input, select, textarea');

            for (const field of fields) {
                if (field.willValidate && field.offsetParent !== null && !field.checkValidity()) {
                    field.reportValidity();
                    return false;
                }
            }

            return true;
        },

        handlePrev: function(e, btn) {
            e.preventDefault();
            const prevStep = btn.dataset.prev;
            if (prevStep) {
                this.showStep(prevStep);
            }
        },

        // Enter in a field submits the form: move on from the current step.
        handleSubmit: function(e) {
            e.preventDefault();
            const visibleStep = document.querySelector('.ddfw-setup-wizard-step-content:not(.ddfw-hide)');
            const nextBtn = visibleStep ? visibleStep.querySelector('.ddfw-setup-wizard-next') : null;

            if (nextBtn) {
                nextBtn.click();
            } else {
                this.finish();
            }
        },

        saveStep: function(currentStep, nextStep) {
            this.showLoader();

            // Replicate jQuery's serializeArray format for form_data parameter
            const bodyParams = new URLSearchParams();
            bodyParams.append('action', 'ddfw_save_wizard_step');
            bodyParams.append('nonce', this.params.nonce);
            bodyParams.append('plugin_slug', this.params.plugin_slug);
            bodyParams.append('step_id', currentStep);

            if (this.form) {
                let index = 0;
                const stepContainer = document.querySelector(`.ddfw-setup-wizard-step-content[data-step="${currentStep}"]`);
                const checkedNames = new Set();

                new FormData(this.form).forEach((value, name) => {
                    bodyParams.append(`form_data[${index}][name]`, name);
                    bodyParams.append(`form_data[${index}][value]`, value);
                    checkedNames.add(name);
                    index++;
                });

                // Unchecked checkboxes are not included in FormData by the browser.
                // Explicitly send them with an empty value so PHP can clear them.
                if (stepContainer) {
                    stepContainer.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                        if (!cb.checked && cb.name && !checkedNames.has(cb.name)) {
                            bodyParams.append(`form_data[${index}][name]`, cb.name);
                            bodyParams.append(`form_data[${index}][value]`, '');
                            index++;
                        }
                    });
                }
            }

            fetch(this.params.ajax_url, {
                method: 'POST',
                body: bodyParams,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                }
            })
            .then(response => response.json())
            .then(response => {
                this.hideLoader();
                if (response.success) {
                    if (nextStep === 'finish') {
                        window.location.href = this.params.redirect;
                    } else {
                        this.showStep(nextStep);
                    }
                } else {
                    alert((response.data && response.data.message) || 'Error saving step.');
                }
            })
            .catch(error => {
                this.hideLoader();
                alert('An error occurred.');
            });
        },

        showStep: function(stepId) {
            // Toggle step content visibility
            document.querySelectorAll('.ddfw-setup-wizard-step-content').forEach(el => {
                el.classList.add('ddfw-hide');
            });
            
            const targetStep = document.querySelector(`.ddfw-setup-wizard-step-content[data-step="${stepId}"]`);
            if (targetStep) {
                targetStep.classList.remove('ddfw-hide');
            }

            // Update progress bar and step counter
            if (this.params.steps) {
                const stepIndex = this.params.steps.indexOf(stepId);
                const stepNumber = stepIndex + 1;
                const progress = (stepNumber / this.totalSteps) * 100;

                if (this.progressBar) this.progressBar.style.width = progress + '%';
                if (this.stepCounter) this.stepCounter.textContent = stepNumber;
            }

            // Update URL for better UX
            if (window.history.pushState) {
                const url = new URL(window.location.href);
                url.searchParams.set('step', stepId);
                window.history.pushState({}, '', url);
            }

            // Bring the wizard back into view only when the user scrolled past its top,
            // and go to the page top so the plugin header stays visible.
            const wrap = document.querySelector('.ddfw-setup-wizard-wrap');
            if (wrap && wrap.getBoundingClientRect().top < 0) {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        },

        showLoader: function() {
            if (!document.querySelector('.ddfw-wizard-loader-overlay') && this.content) {
                const loader = document.createElement('div');
                loader.className = 'ddfw-wizard-loader-overlay';
                loader.innerHTML = '<div class="ddfw-wizard-loader"></div>';
                this.content.appendChild(loader);
            }
        },

        hideLoader: function() {
            const loader = document.querySelector('.ddfw-wizard-loader-overlay');
            if (loader) {
                loader.remove();
            }
        }
    };

    DDFW_Wizard.init();
});
