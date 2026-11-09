// Copyright (c) 2026, kariem and contributors
// For license information, please see license.txt

(() => {
	const REPORT_NAME = "Club Member Sports Report";
	const NOT_AVAILABLE = "—";

	frappe.query_reports[REPORT_NAME] = {
		filters: [
			{
				fieldname: "sport",
				label: __("Sport"),
				fieldtype: "Link",
				options: "club sport",
			},
			{
				fieldname: "is_dependent",
				label: __("Dependent Status"),
				fieldtype: "Select",
				options: "\nYes\nNo",
			},
			{
				fieldname: "age_from",
				label: __("Age From"),
				fieldtype: "Int",
				default: 0,
			},
			{
				fieldname: "age_to",
				label: __("Age To"),
				fieldtype: "Int",
				default: 100,
			},
			{
				fieldname: "member_name",
				label: __("Member Name"),
				fieldtype: "Data",
			},
			{
				fieldname: "membership_status",
				label: __("Membership Status"),
				fieldtype: "Select",
				options: "\nActive\nInactive\nSuspended\nExpired",
			},
		],

		onload(report) {
			setup_dashboard(report);
			add_print_action(report);
			add_export_action(report);
			wrap_report_refresh(report);
		},

		formatter(value, row, column, data, default_formatter) {
			if (column.fieldname === "is_dependent") {
				const class_name = value === "Yes" ? "is-dependent" : "is-primary";
				return `<span class="club-table-badge ${class_name}">${escape_html(value || __("No"))}</span>`;
			}

			if (column.fieldname === "membership_status") {
				return `<span class="club-table-badge status-${frappe.scrub(value || "unknown")}">${escape_html(
					value || NOT_AVAILABLE
				)}</span>`;
			}

			return default_formatter(value, row, column, data);
		},
	};

	function setup_dashboard(report) {
		if (report.$club_dashboard) {
			return;
		}

		inject_styles();

		report.$club_dashboard = $(
			`<section class="club-member-dashboard" aria-label="${__("Club member analytics dashboard")}">
				<header class="club-dashboard-hero">
					<div>
						<div class="club-dashboard-eyebrow">${__("Club System")} · ${__("Analytics")}</div>
						<h2>${__("Member & Sport Overview")}</h2>
						<p>${__("A live view of your members, enrollments, and club demographics.")}</p>
					</div>
					<div class="club-dashboard-meta">
						<span class="club-dashboard-meta-label">${__("Last refreshed")}</span>
						<strong data-role="refreshed-at">${NOT_AVAILABLE}</strong>
						<span class="club-dashboard-filter-count" data-role="filter-count"></span>
					</div>
				</header>

				<div class="club-dashboard-kpis" data-role="kpis" aria-live="polite"></div>

				<section class="club-dashboard-panel club-dashboard-controls" aria-label="${__("Chart controls")}">
					<div>
						<span class="club-dashboard-section-label">${__("Visual preferences")}</span>
						<p>${__("Customize how the chart data is displayed.")}</p>
					</div>
					<div class="club-dashboard-control-fields">
						<label>
							<span>${__("Trend chart")}</span>
							<select class="form-control input-xs" data-role="chart-type">
								<option value="bar">${__("Bar chart")}</option>
								<option value="line">${__("Line chart")}</option>
							</select>
						</label>
						<label>
							<span>${__("Color theme")}</span>
							<select class="form-control input-xs" data-role="color-theme">
								<option value="default">${__("Club (CVD-Safe)")}</option>
								<option value="pastel">${__("Pastel")}</option>
								<option value="vibrant">${__("Vibrant")}</option>
								<option value="monochrome">${__("Monochrome")}</option>
							</select>
						</label>
						<label>
							<span>${__("Data labels")}</span>
							<select class="form-control input-xs" data-role="data-labels">
								<option value="show">${__("Show")}</option>
								<option value="hide">${__("Hide")}</option>
							</select>
						</label>
					</div>
				</section>

				<section class="club-dashboard-charts" aria-label="${__("Analytics charts")}">
					<article class="club-chart-card club-chart-card-wide">
						<div class="club-chart-heading">
							<div>
								<h3>${__("Enrollment by Sport")}</h3>
								<p>${__("Current active enrollments, ranked by sport.")}</p>
							</div>
							<span class="club-chart-note" data-role="top-sport"></span>
						</div>
						<div class="club-chart-canvas" data-chart="sport"></div>
						<div class="club-chart-summary" data-summary="sport"></div>
					</article>

					<article class="club-chart-card">
						<div class="club-chart-heading">
							<div>
								<h3>${__("Member Type")}</h3>
								<p>${__("Primary members compared with dependents.")}</p>
							</div>
						</div>
						<div class="club-chart-canvas" data-chart="dependent"></div>
						<div class="club-chart-summary" data-summary="dependent"></div>
					</article>

					<article class="club-chart-card">
						<div class="club-chart-heading">
							<div>
								<h3>${__("Age Distribution")}</h3>
								<p>${__("Unique members grouped by age range.")}</p>
							</div>
						</div>
						<div class="club-chart-canvas" data-chart="age"></div>
						<div class="club-chart-summary" data-summary="age"></div>
					</article>
				</section>

				<div class="club-dashboard-table-heading">
					<div>
						<span class="club-dashboard-section-label">${__("Detailed register")}</span>
						<h3>${__("Member enrollments")}</h3>
					</div>
					<span>${__("Use the report controls above to narrow the data.")}</span>
				</div>
			</section>`
		).insertBefore(report.$report);

		report.$club_dashboard.find("[data-role='chart-type'], [data-role='color-theme'], [data-role='data-labels']").on("change", () => {
			render_dashboard(report);
		});
	}

	function add_print_action(report) {
		if (report._club_print_action_added) {
			return;
		}

		report.page.add_inner_button(__("Print / Save PDF"), () => print_dashboard(report));
		report._club_print_action_added = true;
	}

	function add_export_action(report) {
		if (report._club_export_action_added) {
			return;
		}

		report.page.add_inner_button(__("Export Chart (PNG)"), () => export_active_chart(report));
		report._club_export_action_added = true;
	}

	function wrap_report_refresh(report) {
		if (report._club_refresh_wrapped) {
			return;
		}

		const refresh = report.refresh;
		report.refresh = function (...args) {
			const result = refresh.apply(this, args);
			if (result && typeof result.then === "function") {
				result.then(() => render_dashboard(this));
			}
			return result;
		};
		report._club_refresh_wrapped = true;
	}

	function render_dashboard(report) {
		if (!report.$club_dashboard) {
			return;
		}

		const analytics = get_analytics(report.data || []);
		const dashboard = report.$club_dashboard;

		dashboard.find("[data-role='refreshed-at']").text(new Date().toLocaleString());
		dashboard.find("[data-role='filter-count']").text(get_filter_description(report));
		render_kpis(dashboard, analytics);

		if (!analytics.rows.length) {
			render_empty_state(dashboard);
			return;
		}

		render_sport_chart(dashboard, analytics);
		render_dependent_chart(dashboard, analytics);
		render_age_chart(dashboard, analytics);
	}

	function get_analytics(rows) {
		const unique_members = new Map();
		const sport_counts = {};
		const status_counts = {};

		rows.forEach((row) => {
			const member_key = row.member || row.member_name;
			const member = unique_members.get(member_key) || {
				name: row.member_name,
				age: cint(row.member_age),
				is_dependent: row.is_dependent === "Yes",
				status: row.membership_status,
			};

			unique_members.set(member_key, member);
			const sport = row.sport || __("Unassigned");
			sport_counts[sport] = (sport_counts[sport] || 0) + 1;
		});

		unique_members.forEach((member) => {
			const status = member.status || __("Unknown");
			status_counts[status] = (status_counts[status] || 0) + 1;
		});

		const members = [...unique_members.values()];
		const ages = members.map((member) => member.age).filter((age) => age > 0);
		const dependent_count = members.filter((member) => member.is_dependent).length;
		const age_groups = {
			[__("Under 18")]: 0,
			"18–25": 0,
			"26–35": 0,
			"36–45": 0,
			"46–55": 0,
			"56+": 0,
		};

		ages.forEach((age) => {
			if (age < 18) age_groups[__("Under 18")] += 1;
			else if (age <= 25) age_groups["18–25"] += 1;
			else if (age <= 35) age_groups["26–35"] += 1;
			else if (age <= 45) age_groups["36–45"] += 1;
			else if (age <= 55) age_groups["46–55"] += 1;
			else age_groups["56+"] += 1;
		});

		const sports = Object.entries(sport_counts).sort((left, right) => right[1] - left[1]);

		return {
			rows,
			members,
			sports,
			age_groups,
			dependent_count,
			primary_count: members.length - dependent_count,
			active_count: status_counts.Active || 0,
			average_age: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0,
		};
	}

	function render_kpis(dashboard, analytics) {
		const cards = [
			{
				label: __("Members"),
				value: analytics.members.length,
				detail: __("Unique club members"),
				tone: "blue",
			},
			{
				label: __("Enrollments"),
				value: analytics.rows.length,
				detail: __("Matching sport enrollments"),
				tone: "violet",
			},
			{
				label: __("Active"),
				value: analytics.active_count,
				detail: __("Active memberships"),
				tone: "green",
			},
			{
				label: __("Dependents"),
				value: analytics.dependent_count,
				detail: `${format_percent(analytics.dependent_count, analytics.members.length)} ${__("of members")}`,
				tone: "amber",
			},
			{
				label: __("Average age"),
				value: analytics.average_age ? analytics.average_age.toFixed(1) : NOT_AVAILABLE,
				detail: __("Across members with an age"),
				tone: "slate",
			},
		];

		dashboard.find("[data-role='kpis']").html(
			cards
				.map(
					(card) => `<article class="club-kpi-card ${card.tone}">
						<span>${escape_html(card.label)}</span>
						<strong>${escape_html(card.value)}</strong>
						<small>${escape_html(card.detail)}</small>
					</article>`
				)
				.join("")
		);
	}

	function render_sport_chart(dashboard, analytics) {
		const labels = analytics.sports.map(([sport]) => sport);
		const values = analytics.sports.map(([, count]) => count);
		const top_sport = analytics.sports[0];

		dashboard
			.find("[data-role='top-sport']")
			.text(top_sport ? `${top_sport[0]} · ${top_sport[1]} ${__("enrollments")}` : "");
		dashboard
			.find("[data-summary='sport']")
			.html(
				labels
					.map(
						(label, index) =>
							`<span class="club-summary-pill">${escape_html(label)} <b>${values[index]}</b></span>`
					)
					.join("")
			);

		render_chart(dashboard.find("[data-chart='sport']"), {
			data: {
				labels,
				datasets: [{ name: __("Enrollments"), values }],
			},
			type: dashboard.find("[data-role='chart-type']").val() || "bar",
			height: 300,
			colors: get_palette(dashboard.find("[data-role='color-theme']").val(), labels.length),
			barOptions: { spaceRatio: 0.4 },
			lineOptions: { hideDots: 0, regionFill: 1 },
			axisOptions: { shortenYAxisNumbers: 1 },
			tooltipOptions: {
				formatTooltipY: (value) => `${value} ${__("enrollment(s)")}`,
			},
			showValues: dashboard.find("[data-role='data-labels']").val() === "show",
		});
	}

	function render_dependent_chart(dashboard, analytics) {
		const values = [analytics.primary_count, analytics.dependent_count];
		const labels = [__("Primary Members"), __("Dependents")];

		dashboard
			.find("[data-summary='dependent']")
			.html(
				`<span class="club-summary-pill">${escape_html(labels[0])} <b>${values[0]}</b></span>
				<span class="club-summary-pill">${escape_html(labels[1])} <b>${values[1]}</b></span>`
			);

		render_chart(dashboard.find("[data-chart='dependent']"), {
			data: {
				labels,
				datasets: [{ values }],
			},
			type: "percentage",
			height: 260,
			colors: ["#1baf7a", "#e87ba4"],
			tooltipOptions: {
				formatTooltipY: (value) =>
					`${value} ${__("member(s)")} · ${format_percent(value, analytics.members.length)}`,
			},
			showValues: dashboard.find("[data-role='data-labels']").val() === "show",
		});
	}

	function render_age_chart(dashboard, analytics) {
		const labels = Object.keys(analytics.age_groups);
		const values = Object.values(analytics.age_groups);
		dashboard
			.find("[data-summary='age']")
			.html(
				labels
					.map(
						(label, index) =>
							`<span class="club-summary-pill">${escape_html(label)} <b>${values[index]}</b></span>`
					)
					.join("")
			);

		render_chart(dashboard.find("[data-chart='age']"), {
			data: {
				labels,
				datasets: [{ name: __("Members"), values }],
			},
			type: dashboard.find("[data-role='chart-type']").val() || "bar",
			height: 260,
			colors: ["#2a78d6"],
			barOptions: { spaceRatio: 0.35 },
			lineOptions: { hideDots: 0, regionFill: 1 },
			axisOptions: { shortenYAxisNumbers: 1 },
			tooltipOptions: {
				formatTooltipY: (value) => `${value} ${__("member(s)")}`,
			},
			showValues: dashboard.find("[data-role='data-labels']").val() === "show",
		});
	}

	function render_chart(container, options) {
		container.empty();
		if (!options.data.labels.length || !options.data.datasets[0].values.some(Boolean)) {
			container.html(`<div class="club-chart-empty">${__("No data available for the selected filters.")}</div>`);
			return;
		}

		new frappe.Chart(container[0], options);
	}

	function render_empty_state(dashboard) {
		dashboard.find("[data-role='top-sport']").text("");
		dashboard.find("[data-summary]").empty();
		dashboard.find("[data-chart]").html(
			`<div class="club-chart-empty">${__("No data matches the selected filters.")}</div>`
		);
	}

	function get_filter_description(report) {
		const filters = (report.filters || [])
			.map((filter) => ({
				label: filter.df.label,
				value: filter.get_value && filter.get_value(),
			}))
			.filter((filter) => filter.value !== undefined && filter.value !== null && filter.value !== "")
			.map((filter) => `${filter.label}: ${filter.value}`);

		return filters.length ? filters.join(" · ") : __("All members and enrollments");
	}

	function get_palette(theme, count) {
		const palettes = {
			default: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948", "#00b4d8", "#f77f00", "#43aa8b", "#9b2226"],
			pastel: ["#a8d0e6", "#f5b7a8", "#a8e6cf", "#ffd3a8", "#f5a8d0", "#a8e6a8", "#c8a8e6", "#f5a8a8", "#a8e6e6", "#f5d0a8", "#d0e6a8", "#e6a8d0"],
			vibrant: ["#0077ff", "#ff4400", "#00cc66", "#ffaa00", "#ff00aa", "#00aa00", "#7700ff", "#cc0000", "#00ffff", "#ff8800", "#00ff88", "#aa00ff"],
			monochrome: ["#1a3a5c", "#2a5a8c", "#3a7abc", "#4a9aec", "#6ab0f0", "#8ac5f4", "#aadbf8", "#cbf0fc", "#0d1d33", "#163355", "#1f4a77", "#286299"],
		};
		const colors = palettes[theme] || palettes.default;
		return Array.from({ length: count }, (_, index) => colors[index % colors.length]);
	}

	function export_active_chart(report) {
		const dashboard = report.$club_dashboard;
		if (!dashboard) {
			frappe.show_alert({ message: __("Dashboard not initialized"), indicator: "orange" });
			return;
		}

		const chartCanvases = dashboard.find("[data-chart] canvas");
		if (!chartCanvases.length) {
			frappe.show_alert({ message: __("No charts to export"), indicator: "orange" });
			return;
		}

		// Find the first visible chart (or the wide one)
		let targetCanvas = null;
		chartCanvases.each(function() {
			const $canvas = $(this);
			if ($canvas.is(":visible") && $canvas.width() > 0) {
				// Prefer the wide chart (sport chart)
				if ($canvas.closest(".club-chart-card-wide").length) {
					targetCanvas = this;
					return false; // break
				}
				if (!targetCanvas) {
					targetCanvas = this;
				}
			}
		});

		if (!targetCanvas) {
			frappe.show_alert({ message: __("No visible chart found"), indicator: "orange" });
			return;
		}

		const link = document.createElement("a");
		link.download = `club-member-sports-${frappe.datetime.now_date()}.png`;
		link.href = targetCanvas.toDataURL("image/png");
		link.click();
		frappe.show_alert({ message: __("Chart exported as PNG"), indicator: "green" });
	}

	function print_dashboard(report) {
		const analytics = get_analytics(report.data || []);
		if (!analytics.rows.length) {
			frappe.show_alert({ message: __("There is no dashboard data to print."), indicator: "orange" });
			return;
		}

		const print_window = window.open("", "_blank");
		if (!print_window) {
			frappe.msgprint(__("Your browser blocked the print window. Please allow pop-ups and try again."));
			return;
		}

		const dashboard = report.$club_dashboard;
		const charts = [
			printable_chart(dashboard, __("Enrollment by Sport"), "[data-chart='sport']"),
			printable_chart(dashboard, __("Member Type"), "[data-chart='dependent']"),
			printable_chart(dashboard, __("Age Distribution"), "[data-chart='age']"),
		].join("");

		print_window.document.open();
		print_window.document.write(`<!doctype html>
			<html lang="${frappe.boot.lang || "en"}" dir="${frappe.utils.is_rtl() ? "rtl" : "ltr"}">
				<head>
					<meta charset="utf-8">
					<title>${escape_html(__(REPORT_NAME))}</title>
					<style>${get_print_styles()}</style>
				</head>
				<body>
					<header class="print-hero">
						<div>
							<div class="eyebrow">${escape_html(__("Club System"))} · ${escape_html(__("Analytics Report"))}</div>
							<h1>${escape_html(__(REPORT_NAME))}</h1>
							<p>${escape_html(__("Member demographics and sport enrollment overview"))}</p>
						</div>
						<div class="generated">
							<span>${escape_html(__("Generated"))}</span>
							<strong>${escape_html(new Date().toLocaleString())}</strong>
						</div>
					</header>
					<section class="filters">
						<strong>${escape_html(__("Applied filters"))}</strong>
						<span>${escape_html(get_filter_description(report))}</span>
					</section>
					<section class="metrics">${get_print_metrics(analytics)}</section>
					<section class="charts">${charts}</section>
					<section class="register">
						<div class="register-heading">
							<div>
								<div class="eyebrow">${escape_html(__("Detailed register"))}</div>
								<h2>${escape_html(__("Member enrollments"))}</h2>
							</div>
							<span>${analytics.rows.length} ${escape_html(__("records"))}</span>
						</div>
						${get_print_table(analytics.rows)}
					</section>
					<footer>${escape_html(__("Club System"))} · ${escape_html(__("Confidential club management report"))}</footer>
					<script>
						window.addEventListener("load", () => setTimeout(() => window.print(), 250));
					</script>
				</body>
			</html>`);
		print_window.document.close();
	}

	function printable_chart(dashboard, title, selector) {
		const markup = dashboard.find(selector).html() || `<p>${escape_html(__("No chart data available."))}</p>`;
		return `<article class="print-chart"><h2>${escape_html(title)}</h2><div class="print-chart-body">${markup}</div></article>`;
	}

	function get_print_metrics(analytics) {
		const metrics = [
			[__("Members"), analytics.members.length],
			[__("Enrollments"), analytics.rows.length],
			[__("Active memberships"), analytics.active_count],
			[__("Dependents"), analytics.dependent_count],
			[__("Average age"), analytics.average_age ? analytics.average_age.toFixed(1) : NOT_AVAILABLE],
		];

		return metrics
			.map(
				([label, value]) =>
					`<article><span>${escape_html(label)}</span><strong>${escape_html(value)}</strong></article>`
			)
			.join("");
	}

	function get_print_table(rows) {
		const body = rows
			.map(
				(row) => `<tr>
					<td>${escape_html(row.member_name)}</td>
					<td>${escape_html(row.member_age || NOT_AVAILABLE)}</td>
					<td>${escape_html(row.sport || NOT_AVAILABLE)}</td>
					<td>${escape_html(row.is_dependent || __("No"))}</td>
					<td>${escape_html(row.membership_status || NOT_AVAILABLE)}</td>
					<td>${escape_html(row.enrollment_date || NOT_AVAILABLE)}</td>
					<td>${escape_html(row.membership_type || NOT_AVAILABLE)}</td>
				</tr>`
			)
			.join("");

		return `<table>
			<thead>
				<tr>
					<th>${escape_html(__("Member Name"))}</th>
					<th>${escape_html(__("Age"))}</th>
					<th>${escape_html(__("Sport"))}</th>
					<th>${escape_html(__("Dependent"))}</th>
					<th>${escape_html(__("Membership Status"))}</th>
					<th>${escape_html(__("Enrollment Date"))}</th>
					<th>${escape_html(__("Membership Type"))}</th>
				</tr>
			</thead>
			<tbody>${body}</tbody>
		</table>`;
	}

	function get_print_styles() {
		return `
			@page { size: landscape; margin: 12mm; }
			* { box-sizing: border-box; }
			body { color: #172033; font-family: Arial, sans-serif; font-size: 10px; margin: 0; }
			.print-hero { align-items: end; background: linear-gradient(120deg, #102a56, #1d4ed8); border-radius: 10px; color: #fff; display: flex; justify-content: space-between; padding: 18px 22px; }
			.eyebrow { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
			h1, h2, p { margin: 0; } h1 { font-size: 24px; margin: 6px 0; } h2 { font-size: 13px; } .print-hero p { color: #dbeafe; font-size: 11px; }
			.generated { color: #dbeafe; text-align: right; } .generated span { display: block; font-size: 9px; text-transform: uppercase; } .generated strong { color: #fff; display: block; font-size: 10px; margin-top: 4px; }
			.filters { background: #f1f5f9; border-left: 3px solid #2563eb; color: #475569; margin: 12px 0; padding: 8px 10px; } .filters strong { color: #1e293b; margin-right: 10px; }
			.metrics { display: grid; gap: 8px; grid-template-columns: repeat(5, 1fr); margin-bottom: 12px; } .metrics article { border: 1px solid #dbe3ef; border-radius: 7px; padding: 9px 11px; } .metrics span { color: #64748b; display: block; font-size: 9px; text-transform: uppercase; } .metrics strong { color: #172554; display: block; font-size: 21px; margin-top: 4px; }
			.charts { display: grid; gap: 10px; grid-template-columns: 1.35fr 1fr 1fr; margin-bottom: 14px; } .print-chart { border: 1px solid #dbe3ef; border-radius: 8px; break-inside: avoid; padding: 10px; } .print-chart h2 { color: #1e3a8a; margin-bottom: 5px; } .print-chart-body { min-height: 210px; overflow: hidden; } .print-chart svg { height: 210px !important; max-width: 100%; width: 100% !important; }
			.register { break-before: page; } .register-heading { align-items: end; border-bottom: 2px solid #1d4ed8; display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; } .register-heading span { color: #64748b; }
			table { border-collapse: collapse; font-size: 9px; width: 100%; } th { background: #eff6ff; color: #1e3a8a; font-size: 8px; letter-spacing: .04em; text-align: left; text-transform: uppercase; } th, td { border-bottom: 1px solid #dbe3ef; padding: 6px 7px; } tr { break-inside: avoid; } tbody tr:nth-child(even) { background: #f8fafc; }
			footer { border-top: 1px solid #dbe3ef; color: #64748b; font-size: 8px; margin-top: 12px; padding-top: 6px; text-align: center; }
		`;
	}

	function inject_styles() {
		if (document.getElementById("club-member-dashboard-styles")) {
			return;
		}

		$(`<style id="club-member-dashboard-styles">
			.club-member-dashboard { --club-border: var(--border-color, #dce3ee); --club-muted: var(--text-muted, #64748b); --club-card: var(--card-bg, #fff); margin: 18px 0 24px; }
			.club-dashboard-hero { align-items: center; background: linear-gradient(115deg, #0f2858 0%, #1d4ed8 58%, #2563eb 100%); border-radius: 14px; color: #fff; display: flex; gap: 20px; justify-content: space-between; overflow: hidden; padding: 24px 26px; position: relative; }
			.club-dashboard-hero:after { background: rgba(255,255,255,.12); border-radius: 999px; content: ""; height: 180px; position: absolute; right: -48px; top: -98px; width: 180px; }
			.club-dashboard-eyebrow, .club-dashboard-section-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
			.club-dashboard-eyebrow { color: #bfdbfe; } .club-dashboard-hero h2 { color: #fff; font-size: 25px; margin: 6px 0 5px; } .club-dashboard-hero p { color: #dbeafe; margin: 0; }
			.club-dashboard-meta { align-self: stretch; border-left: 1px solid rgba(255,255,255,.28); display: flex; flex-direction: column; justify-content: center; min-width: 205px; padding-left: 21px; position: relative; text-align: right; z-index: 1; }
			.club-dashboard-meta-label { color: #bfdbfe; font-size: 11px; text-transform: uppercase; } .club-dashboard-meta strong { color: #fff; font-size: 13px; margin: 4px 0; } .club-dashboard-filter-count { color: #dbeafe; font-size: 11px; max-width: 280px; }
			.club-dashboard-kpis { display: grid; gap: 12px; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 14px 0; }
			.club-kpi-card { background: var(--club-card); border: 1px solid var(--club-border); border-radius: 12px; min-width: 0; padding: 15px 16px; position: relative; } .club-kpi-card:before { background: var(--accent); border-radius: 4px; content: ""; height: 4px; left: 16px; position: absolute; right: 16px; top: 0; }
			.club-kpi-card.blue { --accent: #2563eb; } .club-kpi-card.violet { --accent: #7c3aed; } .club-kpi-card.green { --accent: #059669; } .club-kpi-card.amber { --accent: #d97706; } .club-kpi-card.slate { --accent: #475569; }
			.club-kpi-card span, .club-kpi-card small { color: var(--club-muted); display: block; font-size: 11px; } .club-kpi-card strong { color: var(--text-color, #172033); display: block; font-size: 25px; line-height: 1.1; margin: 6px 0; }
			.club-dashboard-panel, .club-chart-card { background: var(--club-card); border: 1px solid var(--club-border); border-radius: 12px; } .club-dashboard-controls { align-items: center; display: flex; gap: 16px; justify-content: space-between; margin-bottom: 14px; padding: 13px 16px; }
			.club-dashboard-controls p { color: var(--club-muted); font-size: 12px; margin: 3px 0 0; } .club-dashboard-control-fields { display: flex; gap: 10px; } .club-dashboard-control-fields label { color: var(--club-muted); font-size: 11px; margin: 0; min-width: 130px; } .club-dashboard-control-fields select { margin-top: 4px; }
			.club-dashboard-charts { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); } .club-chart-card { min-width: 0; padding: 17px; } .club-chart-card-wide { grid-column: 1 / -1; }
			.club-chart-heading { align-items: flex-start; display: flex; gap: 12px; justify-content: space-between; min-height: 45px; } .club-chart-heading h3, .club-dashboard-table-heading h3 { color: var(--text-color, #172033); font-size: 15px; margin: 0; } .club-chart-heading p { color: var(--club-muted); font-size: 12px; margin: 4px 0 0; } .club-chart-note { background: var(--control-bg, #eff6ff); border-radius: 999px; color: var(--text-muted, #1d4ed8); font-size: 11px; padding: 5px 9px; white-space: nowrap; }
			.club-chart-canvas { min-height: 260px; padding-top: 8px; } .club-chart-card-wide .club-chart-canvas { min-height: 300px; } .club-chart-empty { align-items: center; color: var(--club-muted); display: flex; font-size: 13px; height: 100%; justify-content: center; min-height: 230px; text-align: center; }
			.club-chart-summary { border-top: 1px solid var(--club-border); display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; padding-top: 11px; } .club-summary-pill { background: var(--control-bg, #f1f5f9); border-radius: 999px; color: var(--club-muted); font-size: 11px; padding: 4px 8px; } .club-summary-pill b { color: var(--text-color, #172033); margin-left: 3px; }
			.club-dashboard-table-heading { align-items: end; border-bottom: 2px solid #2563eb; display: flex; justify-content: space-between; margin-top: 24px; padding: 0 2px 10px; } .club-dashboard-table-heading > span { color: var(--club-muted); font-size: 12px; }
			.club-table-badge { border-radius: 999px; display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; } .club-table-badge.is-dependent { background: #fef3c7; color: #92400e; } .club-table-badge.is-primary { background: #dbeafe; color: #1e40af; } .club-table-badge.status-active { background: #dcfce7; color: #166534; } .club-table-badge.status-inactive { background: #e2e8f0; color: #475569; } .club-table-badge.status-suspended { background: #ffedd5; color: #9a3412; } .club-table-badge.status-expired { background: #fee2e2; color: #b91c1c; }
			@media (max-width: 1024px) { .club-dashboard-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } } @media (max-width: 768px) { .club-dashboard-hero, .club-dashboard-controls, .club-dashboard-table-heading { align-items: flex-start; flex-direction: column; } .club-dashboard-meta { border-left: 0; border-top: 1px solid rgba(255,255,255,.28); min-width: 0; padding: 12px 0 0; text-align: left; width: 100%; } .club-dashboard-kpis, .club-dashboard-charts { grid-template-columns: 1fr; } .club-chart-card-wide { grid-column: auto; } .club-dashboard-control-fields { width: 100%; } .club-dashboard-control-fields label { flex: 1; } }
			@media print { .navbar, .page-head, .page-form, .page-actions, .layout-side-section { display: none !important; } .club-member-dashboard { display: none !important; } }
		</style>`).appendTo("head");
	}

	function format_percent(value, total) {
		return total ? `${((value / total) * 100).toFixed(1)}%` : "0%";
	}

	function escape_html(value) {
		return String(value ?? "").replace(/[&<>"']/g, (character) => {
			return { "&": "&", "<": "<", ">": ">", '"': """, "'": "&#039;" }[character];
		});
	}
})();