/**
 * Date picker for every <input type="date"> and <input type="datetime-local"> in a DevDiggers
 * screen: a button showing the date ( "25 Oct 2026", or "25 Oct 2026, 2:30 PM" ) that opens a
 * month calendar in the dashboard menus' style, with an hour and minute row for date and time,
 * instead of each browser's own picker. The input stays in the form, hidden, and keeps the value, its name,
 * `required`, `min` and `max`, so saving, filtering and validation work as before.
 *
 * @package DevDiggers\Framework
 */

const i18n = () => ( window.ddfwFrameworkObject && window.ddfwFrameworkObject.i18n ) || {};
const locale = () => document.documentElement.lang || undefined;

// Dates are 'YYYY-MM-DD' strings handled as UTC, so the browser timezone never moves a day.
const toDate = ( ymd ) => new Date( `${ ymd }T00:00:00Z` );
const toYmd = ( date ) => date.toISOString().slice( 0, 10 );
const isYmd = ( value ) => /^\d{4}-\d{2}-\d{2}$/.test( value || '' );
const addDays = ( ymd, days ) => {
	const date = toDate( ymd );
	date.setUTCDate( date.getUTCDate() + days );
	return toYmd( date );
};
const shiftMonth = ( ymd, offset ) => {
	const date = toDate( ymd );
	return toYmd( new Date( Date.UTC( date.getUTCFullYear(), date.getUTCMonth() + offset, 1 ) ) );
};
const format = ( ymd, options ) => new Intl.DateTimeFormat( locale(), { timeZone: 'UTC', ...options } ).format( toDate( ymd ) );
const isTime = ( value ) => /^\d{2}:\d{2}$/.test( value || '' );
const pad = ( number ) => String( number ).padStart( 2, '0' );
const today = () => {
	const now = new Date();
	return toYmd( new Date( Date.UTC( now.getFullYear(), now.getMonth(), now.getDate() ) ) );
};

const element = ( tag, className, text ) => {
	const node = document.createElement( tag );
	node.className = className;
	if ( undefined !== text ) {
		node.textContent = text;
	}
	return node;
};

const ICON_CALENDAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';
const arrowIcon = ( left ) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ left ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6' }"/></svg>`;

let openPicker = null;

const close = () => {
	if ( openPicker ) {
		openPicker.menu.hidden = true;
		openPicker.trigger.setAttribute( 'aria-expanded', 'false' );
		openPicker = null;
	}
};

document.addEventListener( 'mousedown', ( event ) => {
	if ( openPicker && ! openPicker.wrap.contains( event.target ) ) {
		close();
	}
} );

document.addEventListener( 'keydown', ( event ) => {
	if ( 'Escape' === event.key && openPicker ) {
		const trigger = openPicker.trigger;
		close();
		trigger.focus();
	}
} );

/**
 * Turn one date input into a picker.
 *
 * @param {HTMLInputElement} input Date input.
 */
const enhance = ( input ) => {
	const text = i18n();
	const wrap = element( 'span', 'ddfw-date' );
	const trigger = element( 'button', 'ddfw-date-trigger' );
	const label = element( 'span', 'ddfw-date-label' );
	const menu = element( 'div', 'ddfw-date-menu' );
	const startOfWeek = Number( ( window.ddfwFrameworkObject || {} ).startOfWeek ) || 0;
	const withTime = 'datetime-local' === input.type;
	let month = '';

	// The value split into its date and time ( "2026-10-25T14:30" ); date only for a date input.
	const parts = () => {
		const value = input.value || '';
		const day = value.slice( 0, 10 );
		const time = value.slice( 11, 16 );
		return { day: isYmd( day ) ? day : '', time: withTime && isTime( time ) ? time : '' };
	};
	// A new time starts at the next full hour, the usual choice when scheduling.
	const nextHour = () => `${ pad( ( new Date().getHours() + 1 ) % 24 ) }:00`;

	input.dataset.ddfwDate = '1';
	input.tabIndex = -1;
	input.setAttribute( 'aria-hidden', 'true' );

	// Same width as the field it replaces ( a filter input is narrow, a settings field wide ).
	const width = input.getBoundingClientRect().width;
	if ( width ) {
		wrap.style.width = `${ Math.round( width ) }px`;
	}

	trigger.type = 'button';
	trigger.setAttribute( 'aria-haspopup', 'dialog' );
	trigger.setAttribute( 'aria-expanded', 'false' );
	trigger.innerHTML = ICON_CALENDAR;
	trigger.appendChild( label );
	menu.hidden = true;
	menu.setAttribute( 'role', 'dialog' );

	input.parentNode.insertBefore( wrap, input );
	wrap.append( input, trigger, menu );

	const sync = () => {
		const { day, time } = parts();
		const filled = withTime ? !! ( day && time ) : !! day;
		// A placeholder that only spells the format ( "yyyy-mm-dd" ) says nothing once the picker shows dates.
		const placeholder = /[ymd]{2}/i.test( input.placeholder ) ? '' : input.placeholder;
		let shown = placeholder || ( withTime ? text.selectDateTime : text.selectDate ) || ( withTime ? 'Select date and time' : 'Select date' );

		if ( filled ) {
			shown = format( day, { day: 'numeric', month: 'short', year: 'numeric' } );
			if ( withTime ) {
				shown += ', ' + new Intl.DateTimeFormat( locale(), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' } ).format( new Date( `${ day }T${ time }:00Z` ) );
			}
		}

		label.textContent = shown;
		trigger.classList.toggle( 'is-empty', ! filled );
		trigger.disabled = input.disabled || input.readOnly;
	};

	const choose = ( value ) => {
		input.value = value;
		sync();
		input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
	};

	const render = () => {
		// Days are limited by the date part of min / max ( a datetime min carries a time too ).
		const min = isYmd( ( input.min || '' ).slice( 0, 10 ) ) ? input.min.slice( 0, 10 ) : '';
		const max = isYmd( ( input.max || '' ).slice( 0, 10 ) ) ? input.max.slice( 0, 10 ) : '';
		const { day: value, time } = parts();
		const now = today();
		const lead = ( toDate( month ).getUTCDay() - startOfWeek + 7 ) % 7;
		const first = addDays( month, -lead );

		const nav = ( left ) => {
			const button = element( 'button', 'ddfw-date-nav' );
			const target = shiftMonth( month, left ? -1 : 1 );
			button.type = 'button';
			button.innerHTML = arrowIcon( left );
			button.setAttribute( 'aria-label', left ? ( text.previousMonth || 'Previous month' ) : ( text.nextMonth || 'Next month' ) );
			// No month entirely before min or after max.
			button.disabled = ( left && min && month <= min.slice( 0, 8 ) + '01' ) || ( ! left && max && target > max );
			button.addEventListener( 'click', () => {
				month = target;
				render();
			} );
			return button;
		};

		const header = element( 'div', 'ddfw-date-header' );
		header.append( nav( true ), element( 'strong', '', format( month, { month: 'long', year: 'numeric' } ) ), nav( false ) );

		const grid = element( 'div', 'ddfw-date-grid' );
		for ( let i = 0; i < 7; i++ ) {
			grid.appendChild( element( 'span', 'ddfw-date-weekday', format( addDays( '2023-01-01', ( startOfWeek + i ) % 7 ), { weekday: 'narrow' } ) ) );
		}

		for ( let i = 0; i < 42; i++ ) {
			const day = addDays( first, i );
			const button = element( 'button', 'ddfw-date-day', String( Number( day.slice( 8 ) ) ) );
			button.type = 'button';
			button.disabled = ( min && day < min ) || ( max && day > max );
			button.setAttribute( 'aria-label', format( day, { day: 'numeric', month: 'long', year: 'numeric' } ) );
			button.classList.toggle( 'is-outside', day.slice( 0, 7 ) !== month.slice( 0, 7 ) );
			button.classList.toggle( 'is-today', day === now );
			button.classList.toggle( 'is-selected', day === value );
			if ( day === value ) {
				button.setAttribute( 'aria-pressed', 'true' );
			}
			button.addEventListener( 'click', () => {
				// With a time, picking the day keeps the menu open for the time row.
				if ( withTime ) {
					choose( `${ day }T${ time || nextHour() }` );
					render();
					return;
				}
				choose( day );
				close();
				trigger.focus();
			} );
			grid.appendChild( button );
		}

		const footer = element( 'div', 'ddfw-date-footer' );
		const todayButton = element( 'button', 'ddfw-date-link', withTime ? ( text.now || 'Now' ) : ( text.today || 'Today' ) );
		todayButton.type = 'button';
		todayButton.disabled = ( min && now < min ) || ( max && now > max );
		todayButton.addEventListener( 'click', () => {
			if ( withTime ) {
				const clock = new Date();
				choose( `${ now }T${ pad( clock.getHours() ) }:${ pad( clock.getMinutes() ) }` );
			} else {
				choose( now );
			}
			close();
			trigger.focus();
		} );
		footer.appendChild( todayButton );

		const extra = [];
		if ( withTime ) {
			// Hour and minute ( 5-minute steps, plus the saved minute if it is between them ).
			const row = element( 'div', 'ddfw-date-time' );
			const current = time || nextHour();
			const select = ( name, options, selected ) => {
				const field = element( 'select', `ddfw-date-time-${ name }` );
				field.setAttribute( 'aria-label', 'hour' === name ? ( text.hour || 'Hour' ) : ( text.minute || 'Minute' ) );
				options.forEach( ( [ optionValue, optionLabel ] ) => field.add( new Option( optionLabel, optionValue, false, optionValue === selected ) ) );
				return field;
			};
			const hourLabel = ( hour ) => new Intl.DateTimeFormat( locale(), { hour: 'numeric', timeZone: 'UTC' } ).format( new Date( Date.UTC( 2023, 0, 1, hour ) ) );
			const minutes = [ ...new Set( [ ...Array.from( { length: 12 }, ( _, i ) => pad( i * 5 ) ), current.slice( 3 ) ] ) ].sort();
			const hourField = select( 'hour', Array.from( { length: 24 }, ( _, h ) => [ pad( h ), hourLabel( h ) ] ), current.slice( 0, 2 ) );
			const minuteField = select( 'minute', minutes.map( ( m ) => [ m, m ] ), current.slice( 3 ) );
			const update = () => choose( `${ value || now }T${ hourField.value }:${ minuteField.value }` );

			hourField.addEventListener( 'change', update );
			minuteField.addEventListener( 'change', update );
			row.append( element( 'span', 'ddfw-date-time-label', text.time || 'Time' ), hourField, element( 'span', 'ddfw-date-time-colon', ':' ), minuteField );
			extra.push( row );

			const done = element( 'button', 'ddfw-date-link is-primary', text.done || 'Done' );
			done.type = 'button';
			done.addEventListener( 'click', () => {
				close();
				trigger.focus();
			} );
			footer.appendChild( done );
		}

		// A required field ( `required` in the form builder sets data-required ) cannot be cleared.
		if ( ! input.required && 'true' !== input.dataset.required && value ) {
			const clear = element( 'button', 'ddfw-date-link', text.clear || 'Clear' );
			clear.type = 'button';
			clear.addEventListener( 'click', () => {
				choose( '' );
				close();
				trigger.focus();
			} );
			footer.appendChild( clear );
		}

		menu.replaceChildren( header, grid, ...extra, footer );
	};

	trigger.addEventListener( 'click', () => {
		if ( openPicker && openPicker.wrap === wrap ) {
			close();
			return;
		}

		close();
		month = shiftMonth( parts().day || today(), 0 );
		render();
		menu.hidden = false;
		trigger.setAttribute( 'aria-expanded', 'true' );
		openPicker = { wrap, menu, trigger };

		// Open upwards when there is no room below.
		const rect = trigger.getBoundingClientRect();
		wrap.classList.toggle( 'is-above', rect.bottom + menu.offsetHeight + 12 > window.innerHeight && rect.top > menu.offsetHeight + 12 );
		// Right-aligned to the field when it would run past the window's right edge ( an end date in a sidebar ).
		wrap.classList.toggle( 'is-end', rect.left + menu.offsetWidth + 12 > document.documentElement.clientWidth && rect.right > menu.offsetWidth + 12 );
		( menu.querySelector( '.is-selected' ) || menu.querySelector( '.is-today' ) || menu.querySelector( '.ddfw-date-day:not(:disabled)' ) )?.focus();
	} );

	// A value set by other code ( a reset button, a preset ) shows on the button too.
	input.addEventListener( 'change', sync );
	sync();
};

/**
 * Enhance every date input in a container that has not been enhanced yet.
 *
 * @param {Document|HTMLElement} container Container.
 */
export const initDatePickers = ( container = document ) => {
	container.querySelectorAll( '.devdiggers-wrap input[type="date"]:not([data-ddfw-date]), .devdiggers-wrap input[type="datetime-local"]:not([data-ddfw-date])' ).forEach( enhance );

	// A start and end pair ( two date columns ): the end cannot be picked before the start.
	container.querySelectorAll( '.devdiggers-wrap .ddfw-two-input-columns' ).forEach( ( pair ) => {
		const [ start, end, extra ] = pair.querySelectorAll( 'input[type="date"], input[type="datetime-local"]' );
		if ( ! start || ! end || extra || pair.dataset.ddfwRange ) {
			return;
		}

		pair.dataset.ddfwRange = '1';
		const limit = () => {
			end.min = start.value || '';
		};
		start.addEventListener( 'change', limit );
		limit();
	} );
};
