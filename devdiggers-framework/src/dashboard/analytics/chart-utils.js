/**
 * Chart Utilities for the shared DevDiggers analytics dashboard.
 *
 * @package DevDiggers\Framework
 * @version 1.0.0
 */

/**
 * Chart utility functions.
 */
export class ChartUtils {
	/**
	 * Series colours in fixed order: brand blue, orange, teal. Checked as a set for colour
	 * blind separation ( worst pair CVD ΔE 13.8 ) and 3:1 contrast on white. Blue next to
	 * purple, the old second colour, scored 2.5 and read as one colour to protan viewers.
	 * Green and red stay out: they mean good and bad elsewhere on the dashboard.
	 */
	static SERIES_COLORS = [ '#0256ff', '#ea580c', '#0d9488' ];

	/**
	 * Format a date for chart display.
	 *
	 * @param {Date}   date   Date to format.
	 * @param {string} format Format token ( 'MMM YYYY' | 'QQQ YYYY' | 'M j' ).
	 * @return {string} Formatted label.
	 */
	static formatDate( date, format ) {
		if ( ! date || ! format ) {
			return date;
		}

		if ( 'MMM YYYY' === format ) {
			return new Intl.DateTimeFormat( 'en-US', { month: 'short', year: 'numeric' } ).format( date );
		}

		if ( 'QQQ YYYY' === format ) {
			const quarter = Math.ceil( ( date.getMonth() + 1 ) / 3 );
			return `Q${ quarter } ${ date.getFullYear() }`;
		}

		return new Intl.DateTimeFormat( 'en-US', { month: 'short', day: 'numeric' } ).format( date );
	}

	/**
	 * Determine the appropriate date format based on the range length.
	 *
	 * @param {Date} fromDate Range start.
	 * @param {Date} toDate   Range end.
	 * @return {string} Format token.
	 */
	static getDateFormat( fromDate, toDate ) {
		const daysDiff = Math.ceil( ( toDate - fromDate ) / ( 1000 * 60 * 60 * 24 ) );

		if ( daysDiff > 365 ) {
			return 'QQQ YYYY';
		} else if ( daysDiff > 90 ) {
			return 'MMM YYYY';
		}

		return 'M j';
	}

	/**
	 * Convert a hex color to an rgba string.
	 *
	 * @param {string} hex   Hex color (e.g. #0256ff).
	 * @param {number} alpha Alpha value.
	 * @return {string} rgba() string.
	 */
	static hexToRgba( hex, alpha = 1 ) {
		const value = hex.replace( '#', '' );
		const bigint = parseInt( value.length === 3 ? value.replace( /(.)/g, '$1$1' ) : value, 16 );
		const r = ( bigint >> 16 ) & 255;
		const g = ( bigint >> 8 ) & 255;
		const b = bigint & 255;
		return `rgba(${ r }, ${ g }, ${ b }, ${ alpha })`;
	}

	/**
	 * Format a numeric value, optionally as money in the store's own currency format: symbol,
	 * its position, decimals and separators all come from the store settings.
	 *
	 * @param {number} value       Value to format.
	 * @param {string} valueFormat 'number' | 'currency'.
	 * @param {object} currency    Store currency ( symbol, position, decimals, decimalSeparator, thousandSeparator ).
	 * @return {string} Formatted value.
	 */
	static formatValue( value, valueFormat, currency = {} ) {
		if ( 'currency' === valueFormat ) {
			const decimals = undefined === currency.decimals ? 2 : Number( currency.decimals );
			const [ whole, fraction ] = Math.abs( Number( value ) || 0 ).toFixed( decimals ).split( '.' );
			const grouped = whole.replace( /\B(?=(\d{3})+(?!\d))/g, undefined === currency.thousandSeparator ? ',' : currency.thousandSeparator );
			const amount = fraction ? grouped + ( currency.decimalSeparator || '.' ) + fraction : grouped;

			return ( Number( value ) < 0 ? '-' : '' ) + ChartUtils.withSymbol( amount, currency );
		}

		return Number( value ).toLocaleString();
	}

	/**
	 * Put the currency symbol where the store puts it: "$5", "5 €", "€ 5".
	 *
	 * @param {string} amount   Formatted amount.
	 * @param {object} currency Store currency.
	 * @return {string} Amount with symbol.
	 */
	static withSymbol( amount, currency = {} ) {
		const symbol = currency.symbol || '$';

		switch ( currency.position ) {
			case 'right':
				return amount + symbol;
			case 'right_space':
				return `${ amount } ${ symbol }`;
			case 'left_space':
				return `${ symbol } ${ amount }`;
			default:
				return symbol + amount;
		}
	}

	/**
	 * Short value for chart axes: "$150K", "1.2K". Full digits and cents only add noise there.
	 *
	 * @param {number} value       Value to format.
	 * @param {string} valueFormat 'number' | 'currency'.
	 * @param {object} currency    Store currency.
	 * @return {string} Formatted value.
	 */
	static formatValueShort( value, valueFormat, currency = {} ) {
		const short = new Intl.NumberFormat( undefined, { notation: 'compact', maximumFractionDigits: 1 } ).format( Math.abs( Number( value ) || 0 ) );
		const sign = Number( value ) < 0 ? '-' : '';

		return sign + ( 'currency' === valueFormat ? ChartUtils.withSymbol( short, currency ) : short );
	}

	/**
	 * Empty state in the Reports style: a grey line icon for the chart type ( no illustration
	 * tile ), a title and one line of help. Both strings arrive escaped from PHP.
	 *
	 * @param {string} type        Chart type.
	 * @param {string} title       Empty-state title.
	 * @param {string} description Empty-state description.
	 * @return {string} HTML.
	 */
	static getEmptyStateHTML( type, title, description ) {
		const paths = {
			doughnut: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
			bar: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-3"/><path d="M13 17V9"/><path d="M18 17V5"/>',
			line: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
		};
		const icon = paths[ 'pie' === type ? 'doughnut' : type ] || paths.line;

		return `
			<div class="ddfw-dash-empty-state">
				<span class="ddfw-dash-empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ icon }</svg></span>
				<h4 class="ddfw-dash-empty-title">${ title }</h4>
				${ description ? `<p class="ddfw-dash-empty-description">${ description }</p>` : '' }
			</div>
		`;
	}

	/**
	 * Generate brand-shade chart colors.
	 *
	 * @param {number} count Number of colors required.
	 * @return {{backgrounds: string[], borders: string[]}} Color sets.
	 */
	static generateColors( count ) {
		const brandShades = [
			'#0256ff', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe',
			'#1e40af', '#1d4ed8', '#2563eb', '#1e3a8a', '#312e81',
		];

		const backgrounds = [];
		const borders = [];

		for ( let i = 0; i < count; i++ ) {
			backgrounds.push( brandShades[ i % brandShades.length ] );
			borders.push( '#ffffff' );
		}

		return { backgrounds, borders };
	}

	/**
	 * Shared tooltip as an HTML card over the chart instead of Chart.js's canvas box, so it can
	 * have the menus' shadow and right-aligned values: the hovered label as a title, then one
	 * row per series with its colour, name and value.
	 *
	 * @param {string} valueFormat 'number' | 'currency'; a series can override it with its own.
	 * @param {object} currency    Store currency.
	 * @return {object} Chart.js tooltip options.
	 */
	static getTooltipOptions( valueFormat = 'number', currency = {} ) {
		const element = ( tag, className, text ) => {
			const node = document.createElement( tag );
			node.className = className;
			if ( undefined !== text ) {
				node.textContent = text;
			}
			return node;
		};

		return {
			enabled: false,
			external: ( { chart, tooltip } ) => {
				const parent = chart.canvas.parentNode;
				let card = parent.querySelector( '.ddfw-dash-tooltip' );

				if ( ! card ) {
					card = element( 'div', 'ddfw-dash-tooltip' );
					card.setAttribute( 'aria-hidden', 'true' );
					parent.appendChild( card );
				}

				if ( ! tooltip.opacity || ! tooltip.dataPoints || ! tooltip.dataPoints.length ) {
					card.classList.remove( 'is-visible' );
					return;
				}

				// A dated chart passes the full period name ( "Sun, Oct 25, 2026" ) for its point.
				const titles = chart.data.ddfwTitles;
				const title = titles ? titles[ tooltip.dataPoints[ 0 ].dataIndex ] : tooltip.title.join( ' ' );
				card.replaceChildren( element( 'div', 'ddfw-dash-tooltip-title', title ) );

				tooltip.dataPoints.forEach( ( point ) => {
					if ( null === point.raw ) {
						return;
					}

					const row = element( 'div', 'ddfw-dash-tooltip-row' );
					const swatch = element( 'span', 'ddfw-dash-tooltip-swatch' );
					const dataset = point.dataset;

					swatch.style.background = dataset.ddfwPrevious
						? `repeating-linear-gradient(90deg, ${ dataset.borderColor } 0 4px, transparent 4px 7px)`
						: dataset.borderColor;
					row.append(
						swatch,
						element( 'span', 'ddfw-dash-tooltip-label', dataset.label ),
						element( 'strong', 'ddfw-dash-tooltip-value', ChartUtils.formatValue( point.parsed.y, dataset.ddfwFormat || valueFormat, currency ) )
					);
					card.appendChild( row );
				} );

				// Beside the point, flipped to the other side near the right edge, kept inside the chart.
				const gap = 14;
				const left = tooltip.caretX + gap + card.offsetWidth > parent.clientWidth ? tooltip.caretX - gap - card.offsetWidth : tooltip.caretX + gap;
				const top = Math.min( Math.max( tooltip.caretY - ( card.offsetHeight / 2 ), 0 ), Math.max( parent.clientHeight - card.offsetHeight, 0 ) );

				card.style.transform = `translate(${ Math.max( left, 0 ) }px, ${ top }px)`;
				card.classList.add( 'is-visible' );
			},
		};
	}

	/**
	 * Shared legend: small round markers, right aligned above the plot.
	 *
	 * @param {string} position Legend position.
	 * @return {object} Chart.js legend options.
	 */
	static getLegendOptions( position = 'top' ) {
		return {
			position,
			align: 'top' === position ? 'end' : 'center',
			labels: {
				usePointStyle: true,
				pointStyle: 'circle',
				boxWidth: 6,
				boxHeight: 6,
				padding: 16,
				color: '#3f3f46',
				font: { size: 12, weight: '500' },
			},
		};
	}

	/**
	 * Vertical gradient fill for a line series: the brand tint fades out toward the axis.
	 *
	 * @param {string} color   Series colour ( hex ).
	 * @param {number} opacity Tint at the top of the fill.
	 * @return {Function} Scriptable backgroundColor.
	 */
	static getAreaGradient( color, opacity = 0.18 ) {
		return ( context ) => {
			const { ctx, chartArea } = context.chart;
			if ( ! chartArea ) {
				return ChartUtils.hexToRgba( color, opacity / 2 );
			}

			const gradient = ctx.createLinearGradient( 0, chartArea.top, 0, chartArea.bottom );
			gradient.addColorStop( 0, ChartUtils.hexToRgba( color, opacity ) );
			gradient.addColorStop( 1, ChartUtils.hexToRgba( color, 0 ) );
			return gradient;
		};
	}

	/**
	 * Chart.js plugin that draws bar series as dot matrix columns: each bar becomes a stack
	 * of small rounded squares over a faint full height track. The bar elements still exist
	 * underneath, so hover, tooltips, legend toggling and the grow animation work as before.
	 *
	 * @return {object} Chart.js plugin.
	 */
	static getDotMatrixPlugin() {
		return {
			id: 'ddfwDotMatrix',
			beforeDatasetDraw( chart, args ) {
				const meta = args.meta;
				if ( 'bar' !== meta.type || ! chart.isDatasetVisible( args.index ) ) {
					return;
				}

				const { ctx, chartArea } = chart;
				const color = chart.data.datasets[ args.index ].borderColor || '#0256ff';
				const active = chart.getActiveElements().map( ( item ) => item.datasetIndex + ':' + item.index );

				ctx.save();
				ctx.beginPath();
				ctx.rect( chartArea.left, chartArea.top, chartArea.width, chartArea.height );
				ctx.clip();

				meta.data.forEach( ( bar, index ) => {
					const { x, y, base, width } = bar.getProps( [ 'x', 'y', 'base', 'width' ] );
					const cell = Math.max( 3, Math.min( 9, width * 0.72 ) );
					const pitch = cell + Math.max( 1.5, cell * 0.32 );
					const left = x - ( cell / 2 );
					const radius = Math.min( 2, cell / 3 );
					const up = y <= base;
					const filled = Math.round( Math.abs( base - y ) / pitch );
					const track = Math.floor( ( up ? base - chartArea.top : chartArea.bottom - base ) / pitch );

					for ( let i = 0; i < track; i++ ) {
						const top = up ? base - ( ( i + 1 ) * pitch ) + ( pitch - cell ) : base + ( i * pitch );
						const lit = i < filled;

						ctx.globalAlpha = 1;
						ctx.fillStyle = lit ? color : 'rgba(24, 24, 27, 0.045)';
						if ( lit && active.length && ! active.includes( args.index + ':' + index ) ) {
							ctx.globalAlpha = 0.45;
						}

						ctx.beginPath();
						if ( ctx.roundRect ) {
							ctx.roundRect( left, top, cell, cell, radius );
						} else {
							ctx.rect( left, top, cell, cell );
						}
						ctx.fill();
					}
				} );

				ctx.restore();
				return false;
			},
		};
	}

	/**
	 * Chart.js plugin for line charts, in the same language as the dot matrix bars: dotted
	 * value rows behind the plot instead of ruled lines and a dashed guide under the hovered day.
	 * Points show on hover only, as in Stripe, Shopify and Google Analytics; a period still being
	 * counted is a dashed last segment ( see DDFWDashboard.getAxisChartConfig ), not a marker.
	 *
	 * @return {object} Chart.js plugin.
	 */
	static getPulseLinePlugin() {
		const dot = ( ctx, x, y, r, fill ) => {
			ctx.beginPath();
			ctx.arc( x, y, r, 0, Math.PI * 2 );
			ctx.fillStyle = fill;
			ctx.fill();
		};

		return {
			id: 'ddfwPulseLine',
			beforeDatasetsDraw( chart ) {
				const { ctx, chartArea, scales } = chart;
				const ys = scales.y.ticks.map( ( _, i ) => scales.y.getPixelForTick( i ) );

				// Dotted rows at each value tick only: columns per day turned long ranges into noise.
				ctx.save();
				ys.forEach( ( y ) => {
					for ( let x = chartArea.left; x <= chartArea.right; x += 7 ) {
						dot( ctx, x, y, 1, 'rgba(24, 24, 27, 0.18)' );
					}
				} );

				const active = chart.getActiveElements()[ 0 ];
				if ( active ) {
					ctx.setLineDash( [ 3, 4 ] );
					ctx.lineWidth = 1;
					ctx.strokeStyle = 'rgba(24, 24, 27, 0.25)';
					ctx.beginPath();
					ctx.moveTo( active.element.x, chartArea.top );
					ctx.lineTo( active.element.x, chartArea.bottom );
					ctx.stroke();
				}
				ctx.restore();
			},
		};
	}

	/**
	 * Chart.js plugin that writes the total in the hole of a doughnut, and the hovered slice's
	 * value and share while a slice is hovered.
	 *
	 * @param {string} valueFormat Value format.
	 * @param {object} currency    Store currency.
	 * @param {string} totalLabel  Caption under the total.
	 * @return {object} Chart.js plugin.
	 */
	static getDonutCenterPlugin( valueFormat, currency, totalLabel ) {
		return {
			id: 'ddfwDonutCenter',
			afterDatasetsDraw( chart ) {
				const meta = chart.getDatasetMeta( 0 );
				const arc = meta.data[ 0 ];
				if ( ! arc ) {
					return;
				}

				const data = chart.data.datasets[ 0 ].data;
				const total = data.reduce( ( sum, value, i ) => sum + ( chart.getDataVisibility( i ) ? value : 0 ), 0 );
				const active = chart.getActiveElements()[ 0 ];
				const value = active ? data[ active.index ] : total;
				const caption = active
					? `${ chart.data.labels[ active.index ] } · ${ total ? ( ( value / total ) * 100 ).toFixed( 1 ) : 0 }%`
					: totalLabel;
				const { x, y, innerRadius } = arc.getProps( [ 'x', 'y', 'innerRadius' ] );
				const size = Math.max( 16, Math.min( 26, innerRadius * 0.3 ) );
				const { ctx } = chart;

				ctx.save();
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillStyle = '#18181b';
				ctx.font = `700 ${ size }px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
				ctx.fillText( ChartUtils.formatValue( value, valueFormat, currency ), x, y - ( size * 0.3 ) );
				ctx.fillStyle = '#6b6b74';
				ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
				ctx.fillText( caption, x, y + ( size * 0.55 ), innerRadius * 1.7 );
				ctx.restore();
			},
		};
	}

	/**
	 * Common options for line/bar charts.
	 *
	 * @param {string} valueFormat 'number' | 'currency'.
	 * @param {object} currency    Store currency.
	 * @return {object} Chart.js options.
	 */
	static getLineChartOptions( valueFormat = 'number', currency = {} ) {
		const tick = { color: '#a1a1aa', font: { size: 11 } };

		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: ChartUtils.getLegendOptions( 'top' ),
				tooltip: {
					...ChartUtils.getTooltipOptions( valueFormat, currency ),
					mode: 'index',
					intersect: false,
				},
			},
			scales: {
				x: {
					display: true,
					grid: { display: false },
					border: { display: false },
					ticks: { ...tick, maxRotation: 0, autoSkipPadding: 16 },
				},
				y: {
					display: true,
					border: { display: false },
					grid: { color: '#f1f1f3', drawTicks: false },
					beginAtZero: true,
					ticks: {
						...tick,
						padding: 10,
						maxTicksLimit: 6,
						callback: ( value ) => ChartUtils.formatValueShort( value, valueFormat, currency ),
					},
				},
			},
			interaction: { mode: 'nearest', axis: 'x', intersect: false },
		};
	}

	/**
	 * Common options for doughnut charts. Values are written in the centre by
	 * getDonutCenterPlugin(), so the options need no value format.
	 *
	 * @return {object} Chart.js options.
	 */
	static getDonutChartOptions() {
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				// The list beside the ring is the legend ( see DDFWDashboard.buildDoughnut ).
				legend: { display: false },
				// The centre label already shows the hovered slice, so a tooltip would cover it.
				tooltip: { enabled: false },
			},
			cutout: '78%',
			// Room for the hovered slice to grow outward; without it the canvas sliced it flat.
			layout: { padding: 6 },
			interaction: { intersect: false },
		};
	}
}
