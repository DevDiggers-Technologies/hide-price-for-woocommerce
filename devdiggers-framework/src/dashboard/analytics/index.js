/**
 * Shared DevDiggers analytics dashboard engine.
 *
 * Reads the declarative `ddfwDashboardAnalytics` config localized by DDFW_Dashboard and
 * renders every configured chart with Chart.js. No per-plugin JavaScript is required.
 *
 * @package DevDiggers\Framework
 * @version 1.0.0
 */

import './analytics.less';
import { ChartUtils } from './chart-utils.js';
import { DateRangeUtils } from './date-range-utils.js';

class DDFWDashboard {
	constructor() {
		this.config = window.ddfwDashboardAnalytics || { charts: [] };
		this.currency = this.config.currency || { symbol: this.config.currencySymbol || '$' };
		this.init();
	}

	init() {
		// The date filter is shared and always present.
		DateRangeUtils.initDateRangeToggle( this.config );

		if ( typeof Chart === 'undefined' ) {
			// eslint-disable-next-line no-console
			console.warn( 'Chart.js is not loaded. Dashboard charts will not be displayed.' );
			return;
		}

		( this.config.charts || [] ).forEach( ( chart ) => this.buildChart( chart ) );
	}

	/**
	 * Build a single chart from its declarative config.
	 *
	 * @param {object} cfg Chart config.
	 */
	buildChart( cfg ) {
		const canvas = document.getElementById( cfg.canvasId );
		if ( ! canvas ) {
			return;
		}

		if ( 'doughnut' === cfg.type || 'pie' === cfg.type ) {
			this.buildDoughnut( canvas, cfg );
		} else if ( 'heatmap' === cfg.type ) {
			this.buildHeatmap( canvas, cfg );
		} else {
			this.buildAxisChart( canvas, cfg );
		}
	}

	/**
	 * Resolve x-axis labels, formatting date-like values against the active range.
	 *
	 * @param {Array}  rows Data rows.
	 * @param {string} xKey X-axis key.
	 * @return {Array} Labels.
	 */
	getLabels( rows, xKey ) {
		const range = this.config.dateRange || {};
		let displayFormat = 'M j';

		if ( range.from && range.to ) {
			displayFormat = ChartUtils.getDateFormat( new Date( range.from ), new Date( range.to ) );
		}

		return rows.map( ( row ) => {
			const raw = row[ xKey ];
			const date = new Date( raw );
			return isNaN( date.getTime() ) ? raw : ChartUtils.formatDate( date, displayFormat );
		} );
	}

	/**
	 * Render a line or bar chart. Dated rows are first made into a complete timeline ( every day
	 * or month of the range, empty ones as zero ), so a plugin that only sends the days with
	 * activity still gets a true time axis. A chart of daily dates gets Day / Week / Month and
	 * Line / Bar switches, as on the MultiPOS Reports page, and opens at the interval that suits
	 * the range: days up to three months, weeks up to about six, months beyond.
	 *
	 * @param {HTMLCanvasElement} canvas Canvas element.
	 * @param {object}            cfg    Chart config.
	 */
	buildAxisChart( canvas, cfg ) {
		const series = cfg.series || [];
		const xKey = cfg.xKey || 'date';

		const hasData = ( cfg.data || [] ).length && series.some( ( s ) => cfg.data.some( ( row ) => ( parseFloat( row[ s.key ] ) || 0 ) !== 0 ) );
		if ( ! hasData ) {
			this.renderEmpty( canvas, cfg );
			return;
		}

		const timeline = this.toTimeline( cfg.data, xKey, series );
		const rows = timeline ? timeline.rows : cfg.data;
		const daily = timeline && 'day' === timeline.unit;
		const state = {
			interval: timeline ? this.defaultInterval( timeline ) : '',
			// One point ( Today ) cannot draw a line, so it is a bar.
			type: 'bar' === cfg.type || rows.length < 2 ? 'bar' : 'line',
		};
		let chart = null;

		const draw = () => {
			if ( chart ) {
				chart.destroy();
			}

			const grouped = daily && 'day' !== state.interval ? this.regroup( rows, xKey, series, state.interval ) : rows;
			const unit = timeline ? state.interval : '';
			const labels = unit ? this.getPeriodLabels( grouped, xKey, unit ) : this.getLabels( grouped, xKey );
			const config = this.getAxisChartConfig( grouped, labels, series, state.type, cfg );

			// The tooltip names the whole period ( "Sun, Oct 25, 2026", "Oct 12 – 18, 2026" ).
			config.data.ddfwTitles = unit ? this.getPeriodLabels( grouped, xKey, unit, true ) : null;
			// The period holding today is still being counted: say so beside its dashed segment.
			const range = this.config.dateRange || {};
			const titles = config.data.ddfwTitles;
			if ( titles && titles.length && range.to && this.config.today && range.to >= this.config.today ) {
				titles[ titles.length - 1 ] = ( this.config.i18n.soFar || '%s' ).replace( '%s', titles[ titles.length - 1 ] );
			}
			chart = new Chart( canvas, config );
		};

		draw();

		if ( daily && rows.length > 1 ) {
			this.renderChartControls( canvas, rows, xKey, state, draw );
		}
	}

	/**
	 * Complete, zero-filled timeline for dated rows ( 'YYYY-MM-DD' or 'YYYY-MM' ), or null for
	 * anything else ( hours, names ). Days for a range up to a year, months beyond it, matching
	 * DDFW_Dashboard_Data::get_interval(). Older plugins that group by month or quarter themselves
	 * key each period by its first day ( "2026-04-01" ), so a set of first days is read as months,
	 * or as quarters when they only fall in Jan, Apr, Jul and Oct. Rows outside the range widen it
	 * rather than vanish. All Time starts at the first activity instead of at the 2020 floor.
	 *
	 * @param {Array}  data   Data rows.
	 * @param {string} xKey   X-axis key.
	 * @param {Array}  series Series config.
	 * @return {{rows: Array, unit: string}|null} Timeline.
	 */
	toTimeline( data, xKey, series ) {
		const bucketMonth = ( key ) => key.slice( 0, 7 ) + '-01';

		if ( ! data.every( ( row ) => /^\d{4}-\d{2}(-\d{2})?$/.test( row[ xKey ] ) ) ) {
			return null;
		}

		const range = this.config.dateRange || {};
		const keys = data.map( ( row ) => row[ xKey ] ).sort();
		const span = range.from && range.to ? ( new Date( range.to ) - new Date( range.from ) ) / 864e5 : 0;
		const firstDays = keys.length > 1 && keys.every( ( key ) => 7 === key.length || key.endsWith( '-01' ) );
		const months = keys.map( ( key ) => Number( key.slice( 5, 7 ) ) );
		const quarterly = firstDays && span > 366 && months.every( ( month ) => 1 === month % 3 ) && ! keys.some( ( key, i ) => i && DateRangeUtils.shiftMonth( keys[ i - 1 ], 1 ) === bucketMonth( key ) );
		const unit = quarterly ? 'quarter' : ( firstDays || keys.some( ( key ) => 7 === key.length ) || span > 366 ? 'month' : 'day' );
		const bucket = ( key ) => {
			if ( 'day' === unit ) {
				return key;
			}
			const month = Number( key.slice( 5, 7 ) );
			return 'quarter' === unit ? `${ key.slice( 0, 4 ) }-${ String( month - ( ( month - 1 ) % 3 ) ).padStart( 2, '0' ) }-01` : bucketMonth( key );
		};
		const step = ( key ) => ( 'day' === unit ? DateRangeUtils.addDays( key, 1 ) : DateRangeUtils.shiftMonth( key, 'quarter' === unit ? 3 : 1 ) );

		let first = bucket( keys[ 0 ] );
		let last = bucket( keys[ keys.length - 1 ] );
		if ( range.from && range.to && 'all_time' !== range.key ) {
			first = bucket( range.from ) < first ? bucket( range.from ) : first;
			last = bucket( range.to ) > last ? bucket( range.to ) : last;
		}

		const rows = new Map();
		for ( let key = first, guard = 0; key <= last && guard < 4000; key = step( key ), guard++ ) {
			rows.set( key, Object.fromEntries( [ [ xKey, key ], ...series.map( ( s ) => [ s.key, 0 ] ) ] ) );
		}

		data.forEach( ( row ) => {
			const target = rows.get( bucket( row[ xKey ] ) );
			if ( target ) {
				series.forEach( ( s ) => {
					target[ s.key ] += parseFloat( row[ s.key ] ) || 0;
				} );
			}
		} );

		let list = [ ...rows.values() ];
		if ( 'all_time' === range.key ) {
			const start = list.findIndex( ( row ) => series.some( ( s ) => row[ s.key ] ) );
			list = list.slice( Math.max( 0, Math.min( start, list.length - 2 ) ) );
		}

		return { rows: list, unit };
	}

	/**
	 * Interval a timeline opens at: days up to three months, weeks up to about six, months
	 * beyond, so a chart never opens as a comb of 180 daily spikes.
	 *
	 * @param {{rows: Array, unit: string}} timeline Timeline.
	 * @return {string} 'day' | 'week' | 'month'.
	 */
	defaultInterval( timeline ) {
		if ( 'day' !== timeline.unit ) {
			return timeline.unit;
		}

		const days = timeline.rows.length;
		return days <= 92 ? 'day' : ( days <= 200 ? 'week' : 'month' );
	}

	/**
	 * First day of the week or month holding a 'YYYY-MM-DD' day.
	 *
	 * @param {string} day      Day.
	 * @param {string} interval 'week' | 'month'.
	 * @return {string} Bucket start.
	 */
	bucketOf( day, interval ) {
		if ( 'month' === interval ) {
			return day.slice( 0, 8 ) + '01';
		}

		const weekday = new Date( day + 'T00:00:00Z' ).getUTCDay();
		return DateRangeUtils.addDays( day, -( ( weekday - ( Number( this.config.startOfWeek ) || 0 ) + 7 ) % 7 ) );
	}

	/**
	 * Group daily rows into weeks or months. Series add up, except one marked
	 * `aggregate: 'average'` ( e.g. average response time ), which averages its days with activity.
	 *
	 * @param {Array}  rows     Daily rows.
	 * @param {string} xKey     X-axis key.
	 * @param {Array}  series   Series config.
	 * @param {string} interval 'week' | 'month'.
	 * @return {Array} Grouped rows; each keeps its last day as `ddfwEnd` for the label.
	 */
	regroup( rows, xKey, series, interval ) {
		const buckets = new Map();

		rows.forEach( ( row ) => {
			const key = this.bucketOf( row[ xKey ], interval );

			if ( ! buckets.has( key ) ) {
				// Keyed by the first day it holds, not the week's start: a range from Wednesday
				// labels its first week from Wednesday.
				buckets.set( key, { row: { [ xKey ]: row[ xKey ] }, days: {} } );
			}

			const bucket = buckets.get( key );
			bucket.row.ddfwEnd = row[ xKey ];

			series.forEach( ( s ) => {
				const value = parseFloat( row[ s.key ] ) || 0;
				const average = 'average' === s.aggregate;

				bucket.row[ s.key ] = ( bucket.row[ s.key ] || 0 ) + value;
				if ( average && value ) {
					bucket.days[ s.key ] = ( bucket.days[ s.key ] || 0 ) + 1;
				}
			} );
		} );

		return [ ...buckets.values() ].map( ( { row, days } ) => {
			series.forEach( ( s ) => {
				if ( 'average' === s.aggregate ) {
					row[ s.key ] = days[ s.key ] ? row[ s.key ] / days[ s.key ] : 0;
				}
			} );
			return row;
		} );
	}

	/**
	 * Labels for dated rows at an interval. On the axis: "Oct 5", "Oct 5 – 11" ( a week ), "Oct"
	 * ( a month; "Oct 2025" when the chart spans years ). In the tooltip ( `full` ): "Sun, Oct 5,
	 * 2026", "Oct 5 – 11, 2026", "October 2026". Dates are built from their parts so the browser
	 * timezone never moves a day ( "2026-10-01" read as UTC is 30 Sep in America ).
	 *
	 * @param {Array}   rows     Rows.
	 * @param {string}  xKey     X-axis key.
	 * @param {string}  interval 'day' | 'week' | 'month' | 'quarter' ( "Q4 2026" ).
	 * @param {boolean} full     Tooltip form.
	 * @return {Array} Labels.
	 */
	getPeriodLabels( rows, xKey, interval, full = false ) {
		const local = ( ymd ) => {
			const [ y, m, d ] = ymd.split( '-' ).map( Number );
			return new Date( y, m - 1, d || 1 );
		};
		const format = ( date, options ) => new Intl.DateTimeFormat( 'en-US', options ).format( date );
		const years = new Set( rows.map( ( row ) => row[ xKey ].slice( 0, 4 ) ) ).size;

		return rows.map( ( row ) => {
			const start = local( row[ xKey ] );

			if ( 'quarter' === interval ) {
				return `Q${ Math.floor( start.getMonth() / 3 ) + 1 } ${ start.getFullYear() }`;
			}

			if ( 'month' === interval ) {
				return format( start, full ? { month: 'long', year: 'numeric' } : { month: 'short', ...( years > 1 ? { year: 'numeric' } : {} ) } );
			}

			if ( 'week' === interval && row.ddfwEnd && row.ddfwEnd !== row[ xKey ] ) {
				const end = local( row.ddfwEnd );
				const tail = end.getMonth() === start.getMonth() ? String( end.getDate() ) : format( end, { month: 'short', day: 'numeric' } );
				return `${ format( start, { month: 'short', day: 'numeric' } ) } – ${ tail }${ full ? ', ' + end.getFullYear() : '' }`;
			}

			return format( start, full ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' } );
		} );
	}

	/**
	 * Day / Week / Month and Line / Bar switches in the chart's card header. An interval is only
	 * offered when it makes at least two points, and the switch only when it has a choice.
	 *
	 * @param {HTMLCanvasElement} canvas Canvas element.
	 * @param {Array}             rows   Daily rows.
	 * @param {string}            xKey   X-axis key.
	 * @param {object}            state  Chosen interval and type; changed in place.
	 * @param {Function}          draw   Redraws the chart.
	 */
	renderChartControls( canvas, rows, xKey, state, draw ) {
		const card = canvas.closest( '.ddfw-dash-chart-container, .ddfw-dash-widget' );
		const heading = card && card.querySelector( ':scope > h3' );
		if ( ! heading ) {
			return;
		}

		const i18n = this.config.i18n || {};
		const intervals = [ 'day', 'week', 'month' ].filter( ( interval ) => 'day' === interval || new Set( rows.map( ( row ) => this.bucketOf( row[ xKey ], interval ) ) ).size > 1 );

		const segmented = ( key, options ) => {
			const group = document.createElement( 'div' );
			group.className = 'ddfw-dash-segmented';
			group.setAttribute( 'role', 'group' );

			options.forEach( ( option ) => {
				const button = document.createElement( 'button' );
				button.type = 'button';
				button.textContent = i18n[ option ] || option;
				button.setAttribute( 'aria-pressed', state[ key ] === option ? 'true' : 'false' );
				button.addEventListener( 'click', () => {
					if ( state[ key ] === option ) {
						return;
					}
					state[ key ] = option;
					group.querySelectorAll( 'button' ).forEach( ( item ) => item.setAttribute( 'aria-pressed', item === button ? 'true' : 'false' ) );
					draw();
				} );
				group.appendChild( button );
			} );

			return group;
		};

		const controls = document.createElement( 'div' );
		controls.className = 'ddfw-dash-chart-controls';
		if ( intervals.length > 1 ) {
			controls.appendChild( segmented( 'interval', intervals ) );
		}
		controls.appendChild( segmented( 'type', [ 'line', 'bar' ] ) );

		// The header's date filter already names the period, so the same words here only repeat it.
		const dateLabel = heading.querySelector( '.ddfw-dash-chart-date-range' );
		if ( dateLabel && this.config.dateRange && dateLabel.textContent.trim() === this.config.dateRange.label ) {
			dateLabel.remove();
		}

		heading.appendChild( controls );
	}

	/**
	 * Chart.js config for a line or dot matrix bar chart.
	 *
	 * @param {Array}  rows   Rows.
	 * @param {Array}  labels X-axis labels.
	 * @param {Array}  series Series config.
	 * @param {string} type   'line' | 'bar'.
	 * @param {object} cfg    Chart config.
	 * @return {object} Chart.js config.
	 */
	getAxisChartConfig( rows, labels, series, type, cfg ) {
		const bar = 'bar' === type;

		// The series carrying the most volume is the one that gets shaded.
		// A range that runs to today ends in a period still being counted ( today, this week, this
		// month ), so its last segment is dashed, as in Plausible and Fathom: it says why the last
		// point is low without a marker that would only appear on some charts.
		const range = this.config.dateRange || {};
		const running = ! bar && !! range.to && !! this.config.today && range.to >= this.config.today;

		const totals = series.map( ( s ) => ( 'previous' === s.style ? -1 : rows.reduce( ( sum, row ) => sum + Math.abs( parseFloat( row[ s.key ] ) || 0 ), 0 ) ) );
		const leadIndex = totals.indexOf( Math.max( ...totals ) );
		// A `previous` series ( yesterday, last period ) is drawn as a grey dashed line under the
		// others and takes no palette slot.
		let slot = 0;
		// The last real value of each series ( it can end in nulls: hours still to come today ).
		const lastIndex = series.map( ( s ) => rows.reduce( ( last, row, i ) => ( null === row[ s.key ] || undefined === row[ s.key ] ? last : i ), -1 ) );
		// A series may carry its own `value_format` ( money raised beside a count of orders ). Money
		// and counts never share a scale: the series in another format get their own axis on the right.
		const chartFormat = cfg.valueFormat || 'number';
		const formatOf = ( s ) => s.value_format || chartFormat;
		const leftFormat = series.length ? formatOf( series[ 0 ] ) : chartFormat;
		const other = series.find( ( s ) => formatOf( s ) !== leftFormat );
		const rightFormat = other ? formatOf( other ) : '';
		const datasets = series.map( ( s, index ) => {
			const previous = 'previous' === s.style;
			// The first three series always take the framework palette by position, so every
			// plugin's charts share one family; a plugin's own colour only fills slot four on.
			const color = previous ? '#c4c8cf' : ( ChartUtils.SERIES_COLORS[ slot++ ] || s.color || ChartUtils.SERIES_COLORS[ 0 ] );
			return {
				label: s.label || s.key,
				ddfwPrevious: previous,
				ddfwFormat: formatOf( s ),
				yAxisID: rightFormat && formatOf( s ) !== leftFormat ? 'y1' : 'y',
				// null leaves a gap ( hours still to come today ); anything else counts as a number.
				data: rows.map( ( row ) => ( null === row[ s.key ] ? null : parseFloat( row[ s.key ] ) || 0 ) ),
				borderDash: previous && ! bar ? [ 4, 4 ] : [],
				order: previous ? 1 : 0,
				borderColor: color,
				// The first series is the one the chart is about; when a later one carries more volume
				// and gets the shade, a fainter tint keeps it from outweighing the first line.
				backgroundColor: bar ? color : ChartUtils.getAreaGradient( color, 0 === index ? 0.18 : 0.08 ),
				// Monotone: smooth, but never curves past a real value ( no dips below zero ).
				cubicInterpolationMode: 'monotone',
				segment: running && ! previous ? {
					borderDash: ( ctx ) => ( ctx.p1DataIndex === lastIndex[ index ] ? [ 4, 4 ] : undefined ),
				} : undefined,
				// Only the lead series is shaded: stacked translucent fills mixed into mud.
				fill: ! bar && leadIndex === index && ! previous,
				borderWidth: 2,
				// Points appear on hover only: a dot on every day turned long ranges into beads.
				pointBackgroundColor: color,
				pointBorderColor: '#ffffff',
				pointBorderWidth: 2,
				pointRadius: 0,
				pointHoverRadius: 5,
				pointHoverBorderWidth: 2,
				// Let a point on the top or bottom value line draw past the plot edge
				// instead of being sliced in half.
				clip: 8,
				categoryPercentage: 0.9,
				barPercentage: 0.9,
			};
		} );

		const options = ChartUtils.getLineChartOptions( leftFormat, this.currency );

		if ( rightFormat ) {
			options.scales.y1 = {
				...options.scales.y,
				position: 'right',
				grid: { display: false },
				ticks: { ...options.scales.y.ticks, callback: ( value ) => ChartUtils.formatValueShort( value, rightFormat, this.currency ) },
				// Same number of steps as the left axis, on a round step, so its labels sit on the
				// left axis's grid rows instead of between them.
				afterBuildTicks: ( axis ) => {
					const steps = Math.max( axis.chart.scales.y.ticks.length - 1, 1 );
					// Whole counts step by whole numbers: "0.5 orders" is not a value.
					const whole = 0 === axis.options.ticks.precision;
					const raw = Math.max( axis.max / steps, whole ? 1 : 0 ) || 1;
					const power = 10 ** Math.floor( Math.log10( raw ) );
					const step = ( whole && power < 10 ? [ 1, 2, 5, 10 ] : [ 1, 2, 2.5, 5, 10 ] ).map( ( m ) => m * power ).find( ( m ) => m >= raw );
					axis.max = step * steps;
					axis.ticks = Array.from( { length: steps + 1 }, ( _, i ) => ( { value: step * i } ) );
				},
			};
		}

		// One series needs no key: the card title already names it.
		options.plugins.legend.display = datasets.length > 1;

		// Both styles draw their own dotted scale ( matrix tracks / dot grid ), so ruled
		// gridlines would only cross it.
		options.scales.y.grid.display = false;

		// Whole counts ( orders, visits ) get whole ticks: "1.5 orders" is not a value.
		[ 'y', 'y1' ].forEach( ( axis ) => {
			const own = datasets.filter( ( d ) => d.yAxisID === axis );
			if ( options.scales[ axis ] && own.length && own.every( ( d ) => d.data.every( ( v ) => null === v || Number.isInteger( v ) ) ) ) {
				options.scales[ axis ].ticks = { ...options.scales[ axis ].ticks, precision: 0 };
			}
		} );

		// Room for a hovered point at the right edge.
		options.layout = { padding: { top: 8, right: 10 } };

		return {
			type: bar ? 'bar' : 'line',
			data: { labels, datasets },
			options,
			plugins: [ bar ? ChartUtils.getDotMatrixPlugin() : ChartUtils.getPulseLinePlugin() ],
		};
	}

	/**
	 * Render a doughnut chart.
	 *
	 * @param {HTMLCanvasElement} canvas Canvas element.
	 * @param {object}            cfg    Chart config.
	 */
	buildDoughnut( canvas, cfg ) {
		const rows = cfg.data || [];
		const labelKey = cfg.labelKey || 'label';
		const valueKey = cfg.valueKey || 'value';

		const items = rows
			.map( ( row ) => ( { label: row[ labelKey ], value: parseFloat( row[ valueKey ] ) || 0 } ) )
			.filter( ( item ) => item.value > 0 );

		if ( ! items.length ) {
			this.renderEmpty( canvas, cfg );
			return;
		}

		const colors = ChartUtils.generateColors( items.length ).backgrounds;
		const total = items.reduce( ( sum, item ) => sum + item.value, 0 );
		const format = ( value ) => ChartUtils.formatValue( value, cfg.valueFormat || 'number', this.currency );

		// A compact ring beside a list of every slice ( colour, name, value, share ), so the split
		// reads without hovering; the list wraps under the ring in a narrow card.
		const wrap = canvas.parentElement;
		const layout = document.createElement( 'div' );
		const ring = document.createElement( 'div' );
		const list = document.createElement( 'ul' );

		wrap.classList.add( 'ddfw-dash-chart--doughnut' );
		layout.className = 'ddfw-dash-donut';
		ring.className = 'ddfw-dash-donut-ring';
		list.className = 'ddfw-dash-donut-list';
		ring.appendChild( canvas );
		layout.append( ring, list );
		wrap.appendChild( layout );

		const listRows = items.map( ( item, index ) => {
			const row = document.createElement( 'li' );
			const swatch = document.createElement( 'span' );
			const label = document.createElement( 'span' );
			const value = document.createElement( 'strong' );
			const share = document.createElement( 'span' );

			swatch.className = 'ddfw-dash-donut-swatch';
			swatch.style.background = colors[ index % colors.length ];
			label.className = 'ddfw-dash-donut-label';
			label.textContent = item.label;
			value.className = 'ddfw-dash-donut-value';
			value.textContent = format( item.value );
			share.className = 'ddfw-dash-donut-share';
			// A real but tiny slice reads "<0.1%", never a misleading 0%.
			const percent = total ? Math.round( ( item.value / total ) * 1000 ) / 10 : 0;
			share.textContent = ! percent && item.value > 0 ? '<0.1%' : `${ percent }%`;
			row.append( swatch, label, value, share );
			list.appendChild( row );

			return row;
		} );

		const highlight = ( index ) => listRows.forEach( ( row, i ) => row.classList.toggle( 'is-active', i === index ) );

		const chart = new Chart( canvas, {
			type: 'doughnut',
			data: {
				labels: items.map( ( item ) => item.label ),
				datasets: [ {
					data: items.map( ( item ) => item.value ),
					backgroundColor: items.map( ( _, i ) => colors[ i % colors.length ] ),
					// One ring with clean seams: 2px gaps keep same-hue blues apart. A single slice is
					// the whole ring, so it gets no gap ( it left a notch at the top ).
					borderWidth: 0,
					borderRadius: items.length > 1 ? 3 : 0,
					spacing: items.length > 1 ? 2 : 0,
					hoverOffset: 4,
				} ],
			},
			options: {
				...ChartUtils.getDonutChartOptions(),
				onHover: ( event, active ) => highlight( active.length ? active[ 0 ].index : -1 ),
			},
			plugins: [
				ChartUtils.getDonutCenterPlugin(
					cfg.valueFormat || 'number',
					this.currency,
					( this.config.i18n && this.config.i18n.total ) || 'Total'
				),
			],
		} );

		// Hovering a row lights its slice, and the centre shows its value and share.
		listRows.forEach( ( row, index ) => {
			row.addEventListener( 'mouseenter', () => {
				chart.setActiveElements( [ { datasetIndex: 0, index } ] );
				chart.update();
				highlight( index );
			} );
			row.addEventListener( 'mouseleave', () => {
				chart.setActiveElements( [] );
				chart.update();
				highlight( -1 );
			} );
		} );
	}

	/**
	 * Replace a chart canvas with its empty state.
	 *
	 * @param {HTMLCanvasElement} canvas Canvas element.
	 * @param {object}            cfg    Chart config.
	 */
	/**
	 * Weekday by hour grid ( `type` heatmap ), as on the MultiPOS Reports page: the busiest day
	 * and hour above it, cells shaded by the first series, every series in the tooltip. Rows are
	 * { day: 0-6 ( 0 = Sunday, as PHP's date( 'w' ) ), hour: 0-23, <series keys> }; missing cells
	 * count as zero. The shade follows the square root of the share of the busiest cell, so an
	 * hour with one sale still shows against an hour with none.
	 *
	 * @param {HTMLCanvasElement} canvas Canvas element ( replaced by the grid ).
	 * @param {object}            cfg    Chart config.
	 */
	buildHeatmap( canvas, cfg ) {
		const series = cfg.series || [];
		const lead = series[ 0 ];
		const i18n = this.config.i18n || {};

		if ( ! lead ) {
			return;
		}

		const cells = Array.from( { length: 7 }, () => Array.from( { length: 24 }, () => ( {} ) ) );
		( cfg.data || [] ).forEach( ( row ) => {
			const day = parseInt( row.day, 10 );
			const hour = parseInt( row.hour, 10 );
			if ( day >= 0 && day < 7 && hour >= 0 && hour < 24 ) {
				series.forEach( ( s ) => ( cells[ day ][ hour ][ s.key ] = ( cells[ day ][ hour ][ s.key ] || 0 ) + ( parseFloat( row[ s.key ] ) || 0 ) ) );
			}
		} );

		const value = ( day, hour ) => cells[ day ][ hour ][ lead.key ] || 0;
		const max = Math.max( 0, ...cells.flat().map( ( cell ) => cell[ lead.key ] || 0 ) );

		if ( ! max ) {
			this.renderEmpty( canvas, cfg );
			return;
		}

		const format = ( s, amount ) => ChartUtils.formatValue( amount, s.value_format || cfg.valueFormat || 'number', this.currency );
		const color = ChartUtils.SERIES_COLORS[ 0 ];
		const shade = ( amount ) => ( amount > 0 ? ChartUtils.hexToRgba( color, 0.14 + ( 0.86 * Math.sqrt( amount / max ) ) ) : '' );
		const startOfWeek = Number( this.config.startOfWeek ) || 0;
		const days = Array.from( { length: 7 }, ( _, index ) => ( startOfWeek + index ) % 7 );
		// 2023-01-01 was a Sunday, so index 0 is Sunday.
		const weekday = ( day, width ) => new Intl.DateTimeFormat( undefined, { weekday: width, timeZone: 'UTC' } ).format( new Date( Date.UTC( 2023, 0, 1 + day ) ) );
		const time = ( hour ) => new Intl.DateTimeFormat( undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } ).format( new Date( Date.UTC( 2020, 0, 1, hour % 24 ) ) );
		const slot = ( hour ) => `${ time( hour ) }–${ time( hour + 1 ) }`;
		const tag = ( name, className, text ) => {
			const node = document.createElement( name );
			node.className = className;
			if ( undefined !== text ) {
				node.textContent = text;
			}
			return node;
		};

		// Busiest day and hour by the first series.
		const dayTotals = days.map( ( day ) => [ day, cells[ day ].reduce( ( sum, cell ) => sum + ( cell[ lead.key ] || 0 ), 0 ) ] );
		const hourTotals = Array.from( { length: 24 }, ( _, hour ) => [ hour, cells.reduce( ( sum, row ) => sum + ( row[ hour ][ lead.key ] || 0 ), 0 ) ] );
		const peak = ( totals ) => totals.reduce( ( best, item ) => ( item[ 1 ] > best[ 1 ] ? item : best ) );
		const [ peakDay, peakDayValue ] = peak( dayTotals );
		const [ peakHour, peakHourValue ] = peak( hourTotals );

		const wrap = canvas.parentElement;
		const root = tag( 'div', 'ddfw-dash-heatmap' );
		const stats = tag( 'dl', 'ddfw-dash-heatmap-stats' );

		[
			[ i18n.busiestDay || 'Busiest day', weekday( peakDay, 'long' ), format( lead, peakDayValue ) ],
			[ i18n.busiestHour || 'Busiest hour', slot( peakHour ), format( lead, peakHourValue ) ],
		].forEach( ( [ label, main, detail ] ) => {
			const item = tag( 'div', '' );
			const dd = tag( 'dd', '', main );
			dd.appendChild( tag( 'span', '', detail ) );
			item.append( tag( 'dt', '', label ), dd );
			stats.appendChild( item );
		} );

		const grid = tag( 'div', 'ddfw-dash-heatmap-grid' );
		const tooltip = tag( 'div', 'ddfw-dash-tooltip is-heatmap' );
		grid.setAttribute( 'role', 'img' );
		grid.setAttribute( 'aria-label', cfg.title || lead.label || '' );
		tooltip.setAttribute( 'aria-hidden', 'true' );

		days.forEach( ( day ) => {
			grid.appendChild( tag( 'span', 'ddfw-dash-heatmap-day', weekday( day, 'short' ) ) );

			for ( let hour = 0; hour < 24; hour++ ) {
				const cell = tag( 'span', 'ddfw-dash-heatmap-cell' );
				const background = shade( value( day, hour ) );
				if ( background ) {
					cell.style.backgroundColor = background;
				}

				cell.addEventListener( 'mouseenter', () => {
					tooltip.replaceChildren( tag( 'div', 'ddfw-dash-tooltip-title', `${ weekday( day, 'long' ) }, ${ slot( hour ) }` ) );
					series.forEach( ( s, index ) => {
						const row = tag( 'div', 'ddfw-dash-tooltip-row' );
						const swatch = tag( 'span', 'ddfw-dash-tooltip-swatch' );
						swatch.style.background = index ? 'transparent' : color;
						row.append( swatch, tag( 'span', 'ddfw-dash-tooltip-label', s.label || s.key ), tag( 'strong', 'ddfw-dash-tooltip-value', format( s, cells[ day ][ hour ][ s.key ] || 0 ) ) );
						tooltip.appendChild( row );
					} );

					const x = cell.offsetLeft + ( cell.offsetWidth / 2 );
					tooltip.classList.toggle( 'is-start', x < 110 );
					tooltip.classList.toggle( 'is-end', x > grid.clientWidth - 110 );
					tooltip.style.left = `${ x }px`;
					tooltip.style.top = `${ cell.offsetTop }px`;
					tooltip.classList.add( 'is-visible' );
				} );

				grid.appendChild( cell );
			}
		} );

		grid.appendChild( tag( 'span', '' ) );
		for ( let hour = 0; hour < 24; hour++ ) {
			grid.appendChild( tag( 'span', 'ddfw-dash-heatmap-hour', 0 === hour % 3 ? new Intl.DateTimeFormat( undefined, { hour: 'numeric', timeZone: 'UTC' } ).format( new Date( Date.UTC( 2020, 0, 1, hour ) ) ) : '' ) );
		}
		grid.addEventListener( 'mouseleave', () => tooltip.classList.remove( 'is-visible' ) );
		grid.appendChild( tooltip );

		const legend = tag( 'div', 'ddfw-dash-heatmap-legend' );
		legend.setAttribute( 'aria-hidden', 'true' );
		legend.appendChild( tag( 'span', '', i18n.less || 'Less' ) );
		[ 0, 0.1, 0.3, 0.6, 1 ].forEach( ( step ) => {
			const swatch = tag( 'i', '' );
			if ( step ) {
				swatch.style.backgroundColor = shade( step * max );
			}
			legend.appendChild( swatch );
		} );
		legend.appendChild( tag( 'span', '', i18n.more || 'More' ) );

		root.append( stats, grid, legend );
		wrap.classList.add( 'ddfw-dash-chart--heatmap' );
		wrap.replaceChildren( root );
	}

	renderEmpty( canvas, cfg ) {
		const empty = cfg.empty || {};
		canvas.parentElement.innerHTML = ChartUtils.getEmptyStateHTML(
			cfg.type,
			empty.title || ( this.config.i18n && this.config.i18n.noData ) || 'No data available',
			empty.desc || ''
		);
	}
}

document.addEventListener( 'DOMContentLoaded', () => new DDFWDashboard() );
