from collections import defaultdict

import frappe
from frappe import _
from frappe.utils import cint, getdate, today


def execute(filters=None):
	filters = frappe._dict(filters or {})
	min_age = filters.get("min_age")
	max_age = filters.get("max_age")

	if min_age not in (None, "") and max_age not in (None, "") and cint(min_age) > cint(max_age):
		frappe.throw(_("Minimum age cannot be greater than maximum age."))

	columns = [
		{"fieldname": "member", "label": _("Member"), "fieldtype": "Link", "options": "Club Member", "hidden": 1},
		{"fieldname": "member_name", "label": _("Member Name"), "fieldtype": "Data", "width": 200},
		{"fieldname": "age", "label": _("Age"), "fieldtype": "Int", "width": 80},
		{"fieldname": "sport", "label": _("Sport"), "fieldtype": "Link", "options": "club sport", "width": 160},
		{"fieldname": "is_dependent", "label": _("Dependent"), "fieldtype": "Data", "width": 110},
	]

	member_filters = {}
	if filters.get("is_dependent") in ("0", "1", 0, 1):
		member_filters["is_dependent"] = cint(filters.is_dependent)

	members = frappe.get_list(
		"Club Member",
		filters=member_filters,
		fields=[
			"name",
			"full_name",
			"member_age",
			"date_of_birth",
			"is_dependent",
			"membership_status",
		],
		order_by="full_name asc",
		limit_page_length=0,
	)

	min_age = cint(min_age) if min_age not in (None, "") else None
	max_age = cint(max_age) if max_age not in (None, "") else None
	name_filter = (filters.get("member_name") or "").strip().casefold()
	today_date = getdate(today())
	filtered_members = []

	for member in members:
		age = cint(member.member_age)
		if not age and member.date_of_birth:
			age = int((today_date - getdate(member.date_of_birth)).days / 365.25)

		if min_age is not None and age < min_age:
			continue
		if max_age is not None and age > max_age:
			continue
		if name_filter and name_filter not in (member.full_name or "").casefold():
			continue

		member.age = age
		filtered_members.append(member)

	if not filtered_members:
		return columns, [], None, None, []

	member_names = [member.name for member in filtered_members]
	enrollment_filters = {"member": ["in", member_names]}
	if filters.get("sport"):
		enrollment_filters["sport"] = filters.sport

	enrollments = frappe.get_list(
		"Sport Enrollment",
		filters=enrollment_filters,
		fields=["member", "sport"],
		order_by="sport asc",
		limit_page_length=0,
	)

	sports_by_member = defaultdict(list)
	for enrollment in enrollments:
		if enrollment.sport not in sports_by_member[enrollment.member]:
			sports_by_member[enrollment.member].append(enrollment.sport)

	rows = []
	for member in filtered_members:
		sports = sports_by_member.get(member.name, [])
		if sports:
			for sport in sports:
				rows.append(
					{
						"member": member.name,
						"member_name": member.full_name,
						"age": member.age,
						"sport": sport,
						"is_dependent": _("Yes") if member.is_dependent else _("No"),
					}
				)
		elif not filters.get("sport"):
			# Keep members with no sport enrollment visible in the unfiltered report.
			rows.append(
				{
					"member": member.name,
					"member_name": member.full_name,
					"age": member.age,
					"sport": _("Not Enrolled"),
					"is_dependent": _("Yes") if member.is_dependent else _("No"),
				}
			)

	report_summary = [
		{
			"value": len(filtered_members),
			"label": _("Members"),
			"datatype": "Int",
			"indicator": "Blue",
		},
		{
			"value": sum(bool(member.is_dependent) for member in filtered_members),
			"label": _("Dependents"),
			"datatype": "Int",
			"indicator": "Orange",
		},
		{
			"value": len({row["sport"] for row in rows if row["sport"] != _("Not Enrolled")}),
			"label": _("Sports Represented"),
			"datatype": "Int",
			"indicator": "Green",
		},
		{
			"value": sum(member.membership_status == "Active" for member in filtered_members),
			"label": _("Active Memberships"),
			"datatype": "Int",
			"indicator": "Green",
		},
	]

	return columns, rows, None, None, report_summary
