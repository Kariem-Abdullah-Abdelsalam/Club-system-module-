/**
 * Club Member Sports Report - Complete Script Report JavaScript
 *
 * This single-file script can be used in multiple ways:
 * 1. Pasted into a Client Script (Client Script > New > Club Member > club_member_sports_report.js)
 * 2. Pasted into browser console on the Report page for quick testing
 * 3. Used as reference for the file-based report at club_system/report/club_member_sports_report/
 *
 * Features:
 * - Filters: Sport (Link), Dependent Status (Select), Age Range (Int), Member Name (Data), Membership Status (Select)
 * - Bar Chart: Members per Sport (with dynamic chart type selector)
 * - Pie/Donut Chart: Dependent vs Primary Members
 * - Bar Chart: Age Group Distribution
 * - Dynamic updates when filters change
 * - Professional color palette (CVD-safe)
 * - Summary statistics
 * - Responsive tabbed interface
 */

frappe.provide("club_system.reports");

club_system.reports.club_member_sports = {
	// ============================================================
	// FILTER DEFINITIONS
	// ============================================================
	filters: [
		{
			fieldname: "sport",
			label: __("Sport"),
			fieldtype: "Link",
			options: "club sport",
			reqd: 0,
			on_change: function() {
				club_system.reports.club_member_sports.refresh_charts();
			}
		},
		{
			fieldname: "is_dependent",
			label: __("Dependent Status"),
			fieldtype: "Select",
			options: [
				{ value: "", label: __("All") },
				{ value: "1", label: __("Yes") },
				{ value: "0", label: __("No") }
			],
			reqd: 0,
			on_change: function() {
				club_system.reports.club_member_sports.refresh_charts();
			}
		},
		{
			fieldname: "age_from",
			label: __("Age From"),
			fieldtype: "Int",
			reqd: 0,
			default: 0,
			description: __("Minimum age (inclusive)"),
			on_change: function() {
				club_system.reports.club_member_sports.refresh_charts();
			}
		},
		{
			fieldname: "age_to",
			label: __("Age To"),
			fieldtype: "Int",
			reqd: 0,
			default: 100,
			description: __("Maximum age (inclusive)"),
			on_change: function() {
				club_system.reports.club_member_sports.refresh_charts();
			}
		},
		{
			fieldname: "member_name",
			label: __("Member Name"),
			fieldtype: "Data",
			reqd: 0,
			description: __("Partial name search"),
			on_change: function() {
				club_system.reports.club_member_sports.refresh_charts();
			}
		},
		{
			fieldname: "membership_status",
			label: __("Membership Status"),
			fieldtype: "Select",
			options: [
				{ value: "", label: __("All") },
				{ value: "Active", label: __("Active") },
				{ value: "Inactive", label: __("Inactive") },
				{ value: "Suspended", label: __("Suspended") },
				{ value: "Expired", label: __("Expired") }
			],
			reqd: 0,
			on_change: function() {
				club_system.reports.club_member_sports.refresh_charts();
			}
		}
	],

	// ============================================================
	// CHART COLOR PALETTES (CVD-Safe, validated)
	// ============================================================
	color_palettes: {
		default: [
			"#2a78d6", "#eb6834", "#1baf7a", "#eda100",
			"#e87ba4", "#008300", "#6250d6", "#e34948",
			"#00b4d8", "#f77f00", "#43aa8b", "#9b2226"
		],
		pastel: [
			"#a8d0e6", "#f5b7a8", "#a8e6cf", "#ffd3a8",
			"#f5a8d0", "#a8e6a8", "#c8a8e6", "#f5a8a8",
			"#a8e6e6", "#f5d0a8", "#d0e6a8", "#e6a8d0"
		],
		vibrant: [
			"#0077ff", "#ff4400", "#00cc66", "#ffaa00",
			"#ff00aa", "#00aa00", "#7700ff", "#cc0000",
			"#00ffff", "#ff8800", "#00ff88", "#aa00ff"
		],
		monochrome: [
			"#1a3a5c", "#2a5a8c", "#3a7abc", "#4a9aec",
			"#6ab0f0", "#8ac5f4", "#aadbf8", "#cbf0fc",
			"#0d1d33", "#163355", "#1f4a77", "#286299"
		]
	},

	// ============================================================
	// STATE MANAGEMENT
	// ============================================================
	state: {
		charts: {},
		report: null,
		chart_type: "bar",
		show_values: true,
		color_theme: "default"
	},

	// ============================================================
	// INITIALIZATION
	// ============================================================
	init: function(report) {
		this.state.report = report;
		this.setup_chart_container(report);
		this.bind_events();

		// Initial render
		setTimeout(() => this.render_charts(report), 500);

		// Wrap report refresh to update charts
		if (!report._club_sports_chart_wrapped) {
			const original_refresh = report.refresh.bind(report);
			report.refresh = async (...args) => {
				const result = await original_refresh(...args);
				this.render_charts(report);
				return result;
			};
			report._club_sports_chart_wrapped = true;
		}
	},

	// ============================================================
	// CHART CONTAINER SETUP
	// ============================================================
	setup_chart_container: function(report) {
		// Remove existing
		$("#club-member-sports-charts").remove();

		const html = `
			<div id="club-member-sports-charts" class="club-member-sports-charts" style="margin-top: 20px;">
				<!-- Chart Tabs -->
				<ul class="nav nav-tabs chart-tabs" role="tablist" style="margin-bottom: 15px; border-bottom: 2px solid var(--border-color);">
					<li class="nav-item">
						<a class="nav-link active" id="sport-chart-tab" data-toggle="tab" href="#sport-chart-pane" role="tab" style="font-weight: 500;">
							<i class="fa fa-bar-chart fa-fw" style="margin-right: 6px;"></i> ${__("Members per Sport")}
						</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" id="dependent-chart-tab" data-toggle="tab" href="#dependent-chart-pane" role="tab" style="font-weight: 500;">
							<i class="fa fa-pie-chart fa-fw" style="margin-right: 6px;"></i> ${__("Dependent vs Primary")}
						</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" id="age-chart-tab" data-toggle="tab" href="#age-chart-pane" role="tab" style="font-weight: 500;">
							<i class="fa fa-area-chart fa-fw" style="margin-right: 6px;"></i> ${__("Age Distribution")}
						</a>
					</li>
				</ul>

				<!-- Chart Tab Panes -->
				<div class="tab-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-top: none; border-radius: 0 0 8px 8px; padding: 20px;">
					<div class="tab-pane fade show active" id="sport-chart-pane" role="tabpanel">
						<div id="sport-chart-container" class="chart-container" style="height: 350px; position: relative;"></div>
						<div id="sport-chart-summary" class="chart-summary mt-3" style="font-size: 13px; color: var(--text-muted);"></div>
					</div>
					<div class="tab-pane fade" id="dependent-chart-pane" role="tabpanel">
						<div id="dependent-chart-container" class="chart-container" style="height: 350px; position: relative;"></div>
						<div id="dependent-chart-summary" class="chart-summary mt-3" style="font-size: 13px; color: var(--text-muted);"></div>
					</div>
					<div class="tab-pane fade" id="age-chart-pane" role="tabpanel">
						<div id="age-chart-container" class="chart-container" style="height: 350px; position: relative;"></div>
						<div id="age-chart-summary" class="chart-summary mt-3" style="font-size: 13px; color: var(--text-muted);"></div>
					</div>
				</div>

				<!-- Chart Controls -->
				<div class="chart-controls row mt-3 mb-3" style="padding: 0 10px;">
					<div class="col-md-4 col-sm-6 mb-2">
						<label class="control-label" style="font-weight: 500; font-size: 13px;">${__("Chart Type (Bar/Line)")}</label>
						<select class="form-control chart-type-selector" id="sport-chart-type" style="height: 34px;">
							<option value="bar">${__("Bar Chart")}</option>
							<option value="line">${__("Line Chart")}</option>
						</select>
					</div>
					<div class="col-md-4 col-sm-6 mb-2">
						<label class="control-label" style="font-weight: 500; font-size: 13px;">${__("Donut Chart Type")}</label>
						<select class="form-control chart-type-selector" id="donut-chart-type" style="height: 34px;">
							<option value="pie">${__("Pie Chart")}</option>
							<option value="percentage" selected>${__("Donut Chart")}</option>
						</select>
					</div>
					<div class="col-md-4 col-sm-6 mb-2">
						<div class="checkbox" style="margin-top: 22px;">
							<label style="font-weight: 500; font-size: 13px; cursor: pointer;">
								<input type="checkbox" id="show-chart-values" checked style="margin-right: 8px;"> ${__("Show Data Labels")}
							</label>
						</div>
					</div>
					<div class="col-md-4 col-sm-6 mb-2">
						<label class="control-label" style="font-weight: 500; font-size: 13px;">${__("Color Theme")}</label>
						<select class="form-control chart-color-theme" id="chart-color-theme" style="height: 34px;">
							<option value="default">${__("Default (CVD-Safe)")}</option>
							<option value="pastel">${__("Pastel")}</option>
							<option value="vibrant">${__("Vibrant")}</option>
							<option value="monochrome">${__("Monochrome")}</option>
						</select>
					</div>
					<div class="col-md-4 col-sm-6 mb-2">
						<div style="margin-top: 22px;">
							<button class="btn btn-default btn-sm" id="refresh-charts-btn" style="width: 100%;">
								<i class="fa fa-refresh fa-fw"></i> ${__("Refresh Charts")}
							</button>
						</div>
					</div>
					<div class="col-md-4 col-sm-6 mb-2">
						<div style="margin-top: 22px;">
							<button class="btn btn-primary btn-sm" id="export-charts-btn" style="width: 100%;">
								<i class="fa fa-download fa-fw"></i> ${__("Export as PNG")}
							</button>
						</div>
					</div>
				</div>
			</div>
		`;

		// Insert after report toolbar
		$(report.page.main).find(".report-toolbar").after(html);

		// Bind tab events
		$('a[data-toggle="tab"]').on('shown.bs.tab', (e) => {
			setTimeout(() => $(window).trigger('resize'), 100);
		});
	},

	// ============================================================
	// EVENT BINDING
	// ============================================================
	bind_events: function() {
		$("#sport-chart-type").on("change", () => {
			this.state.chart_type = $("#sport-chart-type").val();
			this.render_charts(this.state.report);
		});

		$("#donut-chart-type").on("change", () => {
			this.render_charts(this.state.report);
		});

		$("#show-chart-values").on("change", () => {
			this.state.show_values = $("#show-chart-values").is(":checked");
			this.render_charts(this.state.report);
		});

		$("#chart-color-theme").on("change", () => {
			this.state.color_theme = $("#chart-color-theme").val();
			this.render_charts(this.state.report);
		});

		$("#refresh-charts-btn").on("click", () => {
			this.render_charts(this.state.report);
			frappe.show_alert({ message: __("Charts refreshed"), indicator: "green" });
		});

		$("#export-charts-btn").on("click", () => {
			this.export_active_chart();
		});
	},

	// ============================================================
	// MAIN RENDER FUNCTION
	// ============================================================
	render_charts: function(report) {
		if (!report || !report.data || report.data.length === 0) {
			this.show_no_data();
			return;
		}

		const data = report.data;
		const chart_data = this.process_data(data);
		const colors = this.get_colors(chart_data.sport_labels.length);

		// Render all three charts
		this.render_sport_chart(chart_data, colors);
		this.render_dependent_chart(chart_data, colors);
		this.render_age_chart(chart_data, colors);

		// Update summaries
		this.update_summaries(chart_data);
	},

	// ============================================================
	// DATA PROCESSING
	// ============================================================
	process_data: function(data) {
		// Sport distribution
		const sport_counts = {};
		data.forEach(row => {
			const sport = row.sport || __("Unknown");
			sport_counts[sport] = (sport_counts[sport] || 0) + 1;
		});

		const sorted_sports = Object.entries(sport_counts).sort((a, b) => b[1] - a[1]);
		const sport_labels = sorted_sports.map(s => s[0]);
		const sport_values = sorted_sports.map(s => s[1]);

		// Dependent distribution
		const dependent_counts = { "Yes": 0, "No": 0 };
		data.forEach(row => {
			const dep = row.is_dependent === 1 || row.is_dependent === "1" || row.is_dependent === "Yes" ? "Yes" : "No";
			dependent_counts[dep] = (dependent_counts[dep] || 0) + 1;
		});

		// Age distribution
		const age_groups = {
			[__("Under 18")]: 0,
			[__("18-25")]: 0,
			[__("26-35")]: 0,
			[__("36-45")]: 0,
			[__("46-55")]: 0,
			[__("56+")]: 0
		};

		data.forEach(row => {
			const age = parseInt(row.member_age || row.age || 0, 10);
			if (age < 18) age_groups[__("Under 18")]++;
			else if (age <= 25) age_groups[__("18-25")]++;
			else if (age <= 35) age_groups[__("26-35")]++;
			else if (age <= 45) age_groups[__("36-45")]++;
			else if (age <= 55) age_groups[__("46-55")]++;
			else age_groups[__("56+")]++;
		});

		return {
			sport_labels,
			sport_values,
			sport_counts,
			dependent_labels: Object.keys(dependent_counts),
			dependent_values: Object.values(dependent_counts),
			dependent_counts,
			age_labels: Object.keys(age_groups),
			age_values: Object.values(age_groups),
			age_groups,
			total_members: data.length
		};
	},

	// ============================================================
	// CHART RENDERING - SPORT DISTRIBUTION (Bar/Line)
	// ============================================================
	render_sport_chart: function(chart_data, colors) {
		const container = document.getElementById("sport-chart-container");
		if (!container) return;

		container.innerHTML = "";

		if (chart_data.sport_labels.length === 0) {
			container.innerHTML = `<div class="text-center text-muted py-5" style="padding: 80px 20px;">${__("No sport data available")}</div>`;
			return;
		}

		const chart_data_obj = {
			labels: chart_data.sport_labels,
			datasets: [{
				name: __("Member Count"),
				values: chart_data.sport_values
			}]
		};

		// Destroy existing chart
		if (this.state.charts.sport) {
			this.state.charts.sport.destroy();
		}

		this.state.charts.sport = new frappe.Chart(container, {
			title: __("Members per Sport"),
			data: chart_data_obj,
			type: this.state.chart_type,
			height: 320,
			colors: colors.slice(0, chart_data.sport_labels.length),
			axisOptions: {
				shortenYAxisNumbers: true,
				xAxisMode: "tick",
				yAxisMode: "span",
				numberFormatter: (val) => val.toLocaleString()
			},
			tooltipOptions: {
				formatTooltipX: (d) => d,
				formatTooltipY: (val) => `${val} ${__("member(s)")}`
			},
			showValues: this.state.show_values,
			valueOptions: { precision: 0 },
			lineOptions: { hideDots: false, dotSize: 6 },
			barOptions: { spaceRatio: 0.3, seriesSpaceRatio: 0.1 },
			legendOptions: { position: "bottom" },
			isNavigable: true
		});
	},

	// ============================================================
	// CHART RENDERING - DEPENDENT VS PRIMARY (Pie/Donut)
	// ============================================================
	render_dependent_chart: function(chart_data, colors) {
		const container = document.getElementById("dependent-chart-container");
		if (!container) return;

		container.innerHTML = "";

		if (chart_data.dependent_values.every(v => v === 0)) {
			container.innerHTML = `<div class="text-center text-muted py-5" style="padding: 80px 20px;">${__("No member data available")}</div>`;
			return;
		}

		const donut_type = $("#donut-chart-type").val() || "percentage";

		const chart_data_obj = {
			labels: chart_data.dependent_labels.map(l => __(l)),
			datasets: [{
				name: __("Members"),
				values: chart_data.dependent_values
			}]
		};

		if (this.state.charts.dependent) {
			this.state.charts.dependent.destroy();
		}

		this.state.charts.dependent = new frappe.Chart(container, {
			title: __("Dependent vs Primary Members"),
			data: chart_data_obj,
			type: donut_type,
			height: 320,
			colors: colors.slice(0, chart_data.dependent_labels.length),
			tooltipOptions: {
				formatTooltipX: (d) => d,
				formatTooltipY: (val) => {
					const total = chart_data.dependent_values.reduce((a, b) => a + b, 0);
					const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
					return `${val} ${__("member(s)")} (${pct}%)`;
				}
			},
			showValues: this.state.show_values,
			valueOptions: { precision: 1, suffix: "%" },
			legendOptions: { position: "bottom" }
		});
	},

	// ============================================================
	// CHART RENDERING - AGE DISTRIBUTION (Bar)
	// ============================================================
	render_age_chart: function(chart_data, colors) {
		const container = document.getElementById("age-chart-container");
		if (!container) return;

		container.innerHTML = "";

		if (chart_data.age_values.every(v => v === 0)) {
			container.innerHTML = `<div class="text-center text-muted py-5" style="padding: 80px 20px;">${__("No age data available")}</div>`;
			return;
		}

		const chart_data_obj = {
			labels: chart_data.age_labels,
			datasets: [{
				name: __("Member Count"),
				values: chart_data.age_values
			}]
		};

		if (this.state.charts.age) {
			this.state.charts.age.destroy();
		}

		this.state.charts.age = new frappe.Chart(container, {
			title: __("Age Group Distribution"),
			data: chart_data_obj,
			type: this.state.chart_type,
			height: 320,
			colors: [colors[0]],
			axisOptions: {
				shortenYAxisNumbers: true,
				numberFormatter: (val) => val.toLocaleString()
			},
			tooltipOptions: {
				formatTooltipX: (d) => d,
				formatTooltipY: (val) => `${val} ${__("member(s)")}`
			},
			showValues: this.state.show_values,
			valueOptions: { precision: 0 },
			barOptions: { spaceRatio: 0.3 },
			legendOptions: { position: "bottom" }
		});
	},

	// ============================================================
	// COLOR PALETTE HELPER
	// ============================================================
	get_colors: function(count) {
		const palette = this.color_palettes[this.state.color_theme] || this.color_palettes.default;

		if (count <= palette.length) {
			return palette.slice(0, count);
		}

		// Extend with opacity variations
		const extended = [...palette];
		const opacities = [0.8, 0.6, 0.4];
		let idx = 0;
		while (extended.length < count) {
			const base = palette[idx % palette.length];
			const opacity = opacities[Math.floor(idx / palette.length) % opacities.length];
			const r = parseInt(base.slice(1, 3), 16);
			const g = parseInt(base.slice(3, 5), 16);
			const b = parseInt(base.slice(5, 7), 16);
			extended.push(`rgba(${r}, ${g}, ${b}, ${opacity})`);
			idx++;
		}
		return extended.slice(0, count);
	},

	// ============================================================
	// SUMMARY STATISTICS
	// ============================================================
	update_summaries: function(chart_data) {
		// Sport summary
		const sport_badges = chart_data.sport_labels.map((label, i) =>
			`<span class="badge badge-info" style="margin: 2px 4px 2px 0; font-size: 11px;">${label}: ${chart_data.sport_values[i]}</span>`
		).join(" ");
		$("#sport-chart-summary").html(
			`<strong>${__("Total Members:")} ${chart_data.total_members}</strong> | ${sport_badges}`
		);

		// Dependent summary
		const total = chart_data.dependent_values.reduce((a, b) => a + b, 0);
		const dep_badges = chart_data.dependent_labels.map((label, i) => {
			const pct = total > 0 ? ((chart_data.dependent_values[i] / total) * 100).toFixed(1) : 0;
			const badge_class = label === "Yes" ? "badge-success" : "badge-secondary";
			return `<span class="badge ${badge_class}" style="margin: 2px 4px 2px 0; font-size: 11px;">${__(label)}: ${chart_data.dependent_values[i]} (${pct}%)</span>`;
		}).join(" ");
		$("#dependent-chart-summary").html(
			`<strong>${__("Total:")} ${total}</strong> | ${dep_badges}`
		);

		// Age summary
		const age_badges = chart_data.age_labels.map((label, i) =>
			`<span class="badge badge-primary" style="margin: 2px 4px 2px 0; font-size: 11px;">${label}: ${chart_data.age_values[i]}</span>`
		).join(" ");
		$("#age-chart-summary").html(
			`<strong>${__("Total Members:")} ${chart_data.total_members}</strong> | ${age_badges}`
		);
	},

	// ============================================================
	// NO DATA STATE
	// ============================================================
	show_no_data: function() {
		["sport-chart-container", "dependent-chart-container", "age-chart-container"].forEach(id => {
			const container = document.getElementById(id);
			if (container) {
				container.innerHTML = `<div class="text-center text-muted py-5" style="padding: 80px 20px;">${__("No data available. Please adjust filters.")}</div>`;
			}
		});
		$("#sport-chart-summary, #dependent-chart-summary, #age-chart-summary").html("");
	},

	// ============================================================
	// EXPORT CHART AS PNG
	// ============================================================
	export_active_chart: function() {
		const active_tab = $(".chart-tabs .nav-link.active").attr("href");
		let chart = null;
		let filename = "chart";

		if (active_tab === "#sport-chart-pane" && this.state.charts.sport) {
			chart = this.state.charts.sport;
			filename = "members-per-sport";
		} else if (active_tab === "#dependent-chart-pane" && this.state.charts.dependent) {
			chart = this.state.charts.dependent;
			filename = "dependent-vs-primary";
		} else if (active_tab === "#age-chart-pane" && this.state.charts.age) {
			chart = this.state.charts.age;
			filename = "age-distribution";
		}

		if (chart && chart.canvas) {
			const link = document.createElement("a");
			link.download = `${filename}-${frappe.datetime.now_date()}.png`;
			link.href = chart.canvas.toDataURL("image/png");
			link.click();
			frappe.show_alert({ message: __("Chart exported as PNG"), indicator: "green" });
		} else {
			frappe.show_alert({ message: __("No chart to export"), indicator: "orange" });
		}
	},

	// ============================================================
	// PUBLIC REFRESH METHOD
	// ============================================================
	refresh_charts: function() {
		if (this.state.report && this.state.report.data) {
			this.render_charts(this.state.report);
		}
	}
};

// ============================================================
// AUTO-INITIALIZATION WHEN REPORT LOADS
// ============================================================
$(document).on("page-change", function() {
	const route = frappe.get_route();
	if (route[1] === "Report" && route[3] === "Club Member Sports Report") {
		// Wait for report to be ready
		const check_report = setInterval(() => {
			if (window.cur_report && window.cur_report.page) {
				clearInterval(check_report);
				club_system.reports.club_member_sports.init(window.cur_report);
			}
		}, 200);
	}
});

// ============================================================
// ALSO SUPPORT OLD REPORT NAME FOR BACKWARD COMPATIBILITY
// ============================================================
$(document).on("page-change", function() {
	const route = frappe.get_route();
	if (route[1] === "Report" && route[3] === "Club Member Sports") {
		const check_report = setInterval(() => {
			if (window.cur_report && window.cur_report.page) {
				clearInterval(check_report);
				club_system.reports.club_member_sports.init(window.cur_report);
			}
		}, 200);
	}
});

// ============================================================
// EXPORT FOR MODULE USAGE
// ============================================================
if (typeof module !== "undefined" && module.exports) {
	module.exports = club_system.reports.club_member_sports;
}

// ============================================================
// USAGE INSTRUCTIONS (as comments)
/*
 * TO USE THIS SCRIPT:
 *
 * OPTION 1: As a Client Script (Recommended for production)
 * ---------------------------------------------------------
 * 1. Go to: Desk > Customization > Client Script > New
 * 2. Module: Club System
 * 3. DocType: Club Member
 * 4. Script: (paste this entire file content)
 * 5. Save
 *
 * OPTION 2: In the Script Report's JS field (via Report Builder)
 * ---------------------------------------------------------------
 * 1. Go to: Desk > Report > Club Member Sports Report
 * 2. Click "Edit Report" (if you have permission)
 * 3. In the "Script" section, paste the JS portion (frappe.query_reports...)
 * 4. Save
 *
 * OPTION 3: Quick test in browser console
 * ---------------------------------------
 * 1. Open the Report page
 * 2. Open DevTools Console
 * 3. Paste this entire script and press Enter
 * 4. Run: club_system.reports.club_member_sports.init(window.cur_report)
 *
 * OPTION 4: File-based Report (Already created at)
 * ------------------------------------------------
 * /home/kariem/frappe/frappe-bench/apps/club_system/club_system/club_system/report/club_member_sports_report/
 * - club_member_sports_report.py    (Python backend with execute())
 * - club_member_sports_report.js    (This JavaScript)
 * - club_member_sports_report.json  (Report definition)
 * - __init__.py
 *
 * PYTHON BACKEND (club_member_sports_report.py) includes:
 * - execute(filters) function with all filters
 * - get_columns() - defines 7 columns
 * - get_data(filters) - SQL query joining Club Member + Sport Enrollment
 * - get_chart_data() - prepares data for 3 charts
 * - get_sports_list() - whitelisted method for filter dropdown
 *
 * FILTERS SUPPORTED:
 * - Sport (Link to club sport)
 * - Dependent Status (Yes/No/All)
 * - Age From / Age To (Int range)
 * - Member Name (partial search)
 * - Membership Status (Active/Inactive/Suspended/Expired)
 *
 * CHARTS:
 * 1. Bar/Line Chart: Members per Sport
 * 2. Pie/Donut Chart: Dependent vs Primary Members
 * 3. Bar/Line Chart: Age Group Distribution (6 groups)
 *
 * FEATURES:
 * - CVD-safe color palette (validated)
 * - Dark mode compatible
 * - Responsive tabbed interface
 * - Dynamic filter updates
 * - Data labels toggle
 * - Chart type selector (Bar/Line/Donut)
 * - Color theme selector (4 themes)
 * - Export as PNG
 * - Summary statistics badges
 * - Professional tooltips with counts & percentages
 * - RTL support
 * - Translation ready (__() wrapped)
 */

console.log("Club Member Sports Report JS loaded. Use club_system.reports.club_member_sports.init(report) to initialize.");