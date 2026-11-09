frappe.query_reports["Club Member Sports"] = {
	filters: [
		{
			fieldname: "sport",
			label: __("Sport"),
			fieldtype: "Link",
			options: "club sport",
		},
		{
			fieldname: "is_dependent",
			label: __("Dependent"),
			fieldtype: "Select",
			options: [
				{ value: "", label: __("All") },
				{ value: "1", label: __("Yes") },
				{ value: "0", label: __("No") },
			],
		},
		{
			fieldname: "min_age",
			label: __("Minimum Age"),
			fieldtype: "Int",
		},
		{
			fieldname: "max_age",
			label: __("Maximum Age"),
			fieldtype: "Int",
		},
		{
			fieldname: "member_name",
			label: __("Member Name"),
			fieldtype: "Data",
		},
	],

	// The native report chart is a bar chart showing enrollments by sport.
	get_chart_data(columns, result) {
		const sportIndex = columns.findIndex((column) => column.fieldname === "sport");
		const counts = {};

		(result || []).forEach((row) => {
			const sport = Array.isArray(row) ? row[sportIndex] : row.sport;
			if (sport && sport !== __("Not Enrolled")) {
				counts[sport] = (counts[sport] || 0) + 1;
			}
		});

		const labels = Object.keys(counts);
		if (!labels.length) return null;

		return {
			data: {
				labels,
				datasets: [{ name: __("Enrollments"), values: labels.map((label) => counts[label]) }],
			},
			type: "bar",
			colors: ["#2563eb"],
			barOptions: { spaceRatio: 0.45 },
		};
	},

	onload(report) {
		// Browser printing includes the dashboard charts, summary cards, and results table.
		if (!report._clubPrintStyleAdded) {
			$(
				"<style>" +
					"@media print {" +
					".page-head, .page-form, .page-actions, .layout-side-section, .form-message, .report-footer { display:none !important; }" +
					".layout-main-section { padding:0 !important; border:0 !important; }" +
					".chart-wrapper, .club-member-mix-chart, .report-summary, .report-wrapper { display:block !important; width:100% !important; }" +
					".club-member-mix-chart { break-inside:avoid; }" +
					".dt-scrollable, .dt-scrollable__container { overflow:visible !important; height:auto !important; max-height:none !important; }" +
					"@page { size:landscape; margin:12mm; }" +
					"}" +
					"</style>"
			).appendTo("head");
			report._clubPrintStyleAdded = true;
		}
		if (!report._clubPrintButtonAdded) {
			report.page.add_inner_button(__("Print Dashboard"), () => window.print());
			report._clubPrintButtonAdded = true;
		}

		// Add a second, independently rendered pie chart next to the native bar chart.
		if (!report.$member_mix_chart) {
			report.$member_mix_chart = $(
				'<div class="club-member-mix-chart" style="display:none; margin: 16px 0 24px; padding: 16px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px;">' +
					'<div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">' +
					__("Member Mix") +
					"</div>" +
					'<div class="club-member-mix-chart-container" style="min-height: 260px;"></div>' +
					"</div>"
			).insertAfter(report.$chart);
		}

		// Refresh both charts whenever the report filters trigger a data reload.
		if (!report._clubMemberChartRefreshWrapped) {
			const originalRefresh = report.refresh;
			report.refresh = function (...args) {
				return originalRefresh.apply(this, args).then((response) => {
					render_member_mix_chart(this);
					return response;
				});
			};
			report._clubMemberChartRefreshWrapped = true;
		}
	},
};

function render_member_mix_chart(report) {
	const chart = report.$member_mix_chart;
	if (!chart || !report.raw_data || !report.raw_data.result || !report.raw_data.result.length) {
		chart && chart.hide();
		return;
	}

	const columns = report.raw_data.columns || [];
	const memberIndex = columns.findIndex((column) => column.fieldname === "member");
	const dependentIndex = columns.findIndex((column) => column.fieldname === "is_dependent");
	const members = new Map();

	report.raw_data.result.forEach((row) => {
		const member = Array.isArray(row) ? row[memberIndex] : row.member;
		const dependent = Array.isArray(row) ? row[dependentIndex] : row.is_dependent;
		if (member && !members.has(member)) {
			members.set(member, dependent === __("Yes") || dependent === "Yes");
		}
	});

	const dependentCount = [...members.values()].filter(Boolean).length;
	const regularCount = members.size - dependentCount;
	const container = chart.find(".club-member-mix-chart-container").empty();
	chart.show();

	report.club_member_mix_chart && report.club_member_mix_chart.destroy();
	report.club_member_mix_chart = null;
	if (!members.size) return;

	report.club_member_mix_chart = new frappe.Chart(container[0], {
		data: {
			labels: [__("Primary Members"), __("Dependents")],
			datasets: [{ values: [regularCount, dependentCount] }],
		},
		type: "pie",
		colors: ["#0f766e", "#f59e0b"],
		height: 250,
	});
}
