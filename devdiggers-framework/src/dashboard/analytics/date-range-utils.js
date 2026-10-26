/**
 * Header filters for the shared DevDiggers analytics dashboard: the dropdowns, the date range
 * presets and the custom range calendar. Every choice submits the filter form, as before, so
 * plugins keep reading the same `date_range`, `from_date`, `to_date` and filter parameters.
 *
 * @package DevDiggers\Framework
 * @version 1.1.0
 */

// Dates are 'YYYY-MM-DD' strings handled as UTC, so the browser timezone never shifts a day.
const toDate = ( ymd ) => {
	const [ y, m, d ] = ymd.split( '-' ).map( Number );
	return new Date( Date.UTC( y, m - 1, d ) );
};

const toYmd = ( date ) => date.toISOString().slice( 0, 10 );

const addDays = ( ymd, days ) => {
	const date = toDate( ymd );
	date.setUTCDate( date.getUTCDate() + days );
	return toYmd( date );
};

// First day of the month `offset` months after the one holding `ymd`.
const shiftMonth = ( ymd, offset ) => {
	const date = toDate( ymd );
	return toYmd( new Date( Date.UTC( date.getUTCFullYear(), date.getUTCMonth() + offset, 1 ) ) );
};

const format = ( options, ymd ) => new Intl.DateTimeFormat( undefined, { timeZone: 'UTC', ...options } ).format( toDate( ymd ) );

const element = ( tag, className, text ) => {
	const node = document.createElement( tag );
	if ( className ) {
		node.className = className;
	}
	if ( undefined !== text ) {
		node.textContent = text;
	}
	return node;
};

/**
 * Date range utility functions.
 */
export class DateRangeUtils {
	static addDays = addDays;

	static shiftMonth = shiftMonth;

	/**
	 * Short range such as "19 – 25 Oct", with the year only when it is not this one.
	 *
	 * @param {string} from  First day.
	 * @param {string} to    Last day.
	 * @param {string} today Site today.
	 * @return {string} Range.
	 */
	static formatShortRange( from, to, today ) {
		const options = { day: 'numeric', month: 'short', timeZone: 'UTC' };

		if ( to.slice( 0, 4 ) !== today.slice( 0, 4 ) ) {
			options.year = 'numeric';
		}

		const formatter = new Intl.DateTimeFormat( undefined, options );

		return from === to ? formatter.format( toDate( from ) ) : formatter.formatRange( toDate( from ), toDate( to ) );
	}

	/**
	 * Wire up the header filters.
	 *
	 * @param {object} config Localized dashboard config ( today, startOfWeek, i18n ).
	 */
	static initDateRangeToggle( config = {} ) {
		const form = document.querySelector( '.ddfw-dash-date-filter-form' );
		if ( ! form ) {
			return;
		}

		const today = config.today || toYmd( new Date() );
		const i18n = config.i18n || {};

		DateRangeUtils.initDropdowns( form );

		// Filter dropdowns: store the choice and apply it, carrying the chosen dates along.
		form.querySelectorAll( '.ddfw-dash-filter' ).forEach( ( filter ) => {
			filter.querySelectorAll( '.ddfw-dash-option' ).forEach( ( option ) => {
				option.addEventListener( 'click', () => {
					filter.querySelector( 'input[type="hidden"]' ).value = option.dataset.value;
					form.submit();
				} );
			} );
		} );

		const rangeInput = document.getElementById( 'ddfw-dash-selected-range' );
		const fromInput = document.getElementById( 'ddfw-dash-from-date' );
		const toInput = document.getElementById( 'ddfw-dash-to-date' );

		if ( ! rangeInput || ! fromInput || ! toInput ) {
			return;
		}

		// Presets show their own dates and apply straight away.
		form.querySelectorAll( '.ddfw-dash-date-preset' ).forEach( ( preset ) => {
			const hint = preset.querySelector( '.ddfw-dash-preset-dates' );
			if ( hint && preset.dataset.from && preset.dataset.to ) {
				hint.textContent = DateRangeUtils.formatShortRange( preset.dataset.from, preset.dataset.to, today );
			}

			preset.addEventListener( 'click', () => {
				rangeInput.value = preset.dataset.range;
				form.submit();
			} );
		} );

		const calendar = form.querySelector( '.ddfw-dash-calendar' );
		if ( ! calendar ) {
			return;
		}

		const picker = DateRangeUtils.createCalendar( calendar, {
			today,
			startOfWeek: Number( config.startOfWeek ) || 0,
			i18n,
			range: [ fromInput.value, toInput.value ],
			onChange: ( range ) => {
				const selection = form.querySelector( '.ddfw-dash-range-selection' );
				const apply = form.querySelector( '.ddfw-dash-apply-custom-range' );

				selection.replaceChildren(
					document.createTextNode( range[ 0 ] ? DateRangeUtils.formatShortRange( range[ 0 ], range[ 1 ] || range[ 0 ], today ) : ( i18n.pickStart || '' ) )
				);
				if ( range[ 0 ] && ! range[ 1 ] ) {
					selection.appendChild( element( 'small', '', i18n.pickEnd || '' ) );
				}
				apply.disabled = ! range[ 0 ] || ! range[ 1 ];
			},
		} );

		const close = form.querySelector( '.ddfw-dash-cancel-custom-range' );
		if ( close ) {
			close.addEventListener( 'click', () => DateRangeUtils.closeAll( form ) );
		}

		const apply = form.querySelector( '.ddfw-dash-apply-custom-range' );
		if ( apply ) {
			apply.addEventListener( 'click', () => {
				const [ from, to ] = picker.getRange();
				if ( ! from || ! to ) {
					return;
				}
				fromInput.value = from;
				toInput.value = to;
				rangeInput.value = 'custom';
				form.submit();
			} );
		}

		// Reopening the menu starts again from the applied range.
		document.getElementById( 'ddfw-dash-date-range-picker' ).addEventListener( 'click', () => picker.setRange( [ fromInput.value, toInput.value ] ) );
	}

	/**
	 * Open one dropdown at a time; close on Escape or a click outside.
	 *
	 * @param {HTMLFormElement} form Filter form.
	 */
	static initDropdowns( form ) {
		form.querySelectorAll( '.ddfw-dash-dropdown' ).forEach( ( dropdown ) => {
			const trigger = dropdown.querySelector( '.ddfw-dash-trigger' );
			const menu = dropdown.querySelector( '.ddfw-dash-menu' );

			if ( ! trigger || ! menu ) {
				return;
			}

			trigger.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				const open = menu.hidden;
				DateRangeUtils.closeAll( form );
				menu.hidden = ! open;
				trigger.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			} );
		} );

		document.addEventListener( 'mousedown', ( event ) => {
			if ( ! event.target.closest( '.ddfw-dash-dropdown' ) ) {
				DateRangeUtils.closeAll( form );
			}
		} );

		document.addEventListener( 'keydown', ( event ) => {
			if ( 'Escape' === event.key ) {
				DateRangeUtils.closeAll( form );
			}
		} );
	}

	/**
	 * Close every dropdown in the form.
	 *
	 * @param {HTMLFormElement} form Filter form.
	 */
	static closeAll( form ) {
		form.querySelectorAll( '.ddfw-dash-dropdown' ).forEach( ( dropdown ) => {
			const menu = dropdown.querySelector( '.ddfw-dash-menu' );
			const trigger = dropdown.querySelector( '.ddfw-dash-trigger' );
			if ( menu ) {
				menu.hidden = true;
			}
			if ( trigger ) {
				trigger.setAttribute( 'aria-expanded', 'false' );
			}
		} );
	}

	/**
	 * Month grid for a custom range: the first click sets the start, the second the end, and
	 * the range follows the mouse in between. Days after today are disabled.
	 *
	 * @param {HTMLElement} container Calendar container.
	 * @param {object}      options   today, startOfWeek, i18n, range, onChange.
	 * @return {{getRange: Function, setRange: Function}} Picker controls.
	 */
	static createCalendar( container, options ) {
		const { today, startOfWeek, i18n, onChange } = options;
		let range = options.range.slice();
		let month = shiftMonth( range[ 1 ] || range[ 0 ] || today, 0 );
		let hover = '';

		const weekdays = Array.from( { length: 7 }, ( _, index ) => new Intl.DateTimeFormat( undefined, { weekday: 'narrow', timeZone: 'UTC' } ).format( new Date( Date.UTC( 2023, 0, 1 + ( ( startOfWeek + index ) % 7 ) ) ) ) );

		const arrow = ( direction, label, offset ) => {
			const button = element( 'button', 'ddfw-dash-calendar-nav' );
			button.type = 'button';
			button.setAttribute( 'aria-label', label );
			button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ 'left' === direction ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6' }"/></svg>`;
			button.disabled = offset > 0 && shiftMonth( month, 1 ) > today;
			button.addEventListener( 'click', () => {
				month = shiftMonth( month, offset );
				render();
			} );
			return button;
		};

		const render = () => {
			const lead = ( toDate( month ).getUTCDay() - startOfWeek + 7 ) % 7;
			const first = addDays( month, -lead );
			const [ start, end ] = range;
			// While choosing the end, preview the range up to the hovered day.
			const edges = start && ! end && hover ? [ start, hover ].sort() : [ start, end || start ];

			const header = element( 'div', 'ddfw-dash-calendar-header' );
			header.append(
				arrow( 'left', i18n.previousMonth || '', -1 ),
				element( 'strong', '', format( { month: 'long', year: 'numeric' }, month ) ),
				arrow( 'right', i18n.nextMonth || '', 1 )
			);

			const grid = element( 'div', 'ddfw-dash-calendar-grid' );
			weekdays.forEach( ( day ) => grid.appendChild( element( 'span', 'ddfw-dash-calendar-weekday', day ) ) );

			for ( let index = 0; index < 42; index++ ) {
				const day = addDays( first, index );
				const button = element( 'button', '', String( Number( day.slice( 8 ) ) ) );

				button.type = 'button';
				button.disabled = day > today;
				button.setAttribute( 'aria-label', format( { day: 'numeric', month: 'long', year: 'numeric' }, day ) );
				button.classList.toggle( 'is-outside', day.slice( 0, 7 ) !== month.slice( 0, 7 ) );
				button.classList.toggle( 'is-today', day === today );
				button.classList.toggle( 'is-in-range', !! edges[ 0 ] && day >= edges[ 0 ] && day <= edges[ 1 ] );
				button.classList.toggle( 'is-start', day === edges[ 0 ] );
				button.classList.toggle( 'is-end', day === edges[ 1 ] );

				button.addEventListener( 'mouseenter', () => {
					if ( range[ 0 ] && ! range[ 1 ] && hover !== day ) {
						hover = day;
						render();
					}
				} );
				button.addEventListener( 'click', () => {
					// A click after a full range starts a new one; the second click closes it.
					range = range[ 0 ] && ! range[ 1 ] ? [ range[ 0 ], day ].sort() : [ day, '' ];
					hover = '';
					render();
				} );

				grid.appendChild( button );
			}

			container.replaceChildren( header, grid );
			onChange( range );
		};

		render();

		return {
			getRange: () => range,
			setRange: ( next ) => {
				range = next.slice();
				month = shiftMonth( range[ 1 ] || range[ 0 ] || today, 0 );
				hover = '';
				render();
			},
		};
	}
}
