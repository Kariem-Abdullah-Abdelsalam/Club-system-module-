# Copyright (c) 2026, kariem and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	"""
	Script Report: Club Member Sports Report

	Displays each member's name, age, sport, and dependent status
	with interactive bar and pie charts.
	"""
	if not filters:
		filters = {}

	columns = get_columns()
	data = get_data(filters)

	return columns, data


def get_columns():
	"""Define report columns"""
	return [
		{
			"fieldname": "member",
			"label": _("Member"),
			"fieldtype": "Link",
			"options": "Club Member",
			"hidden": 1,
		},
		{
			"fieldname": "member_name",
			"label": _("Member Name"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "member_age",
			"label": _("Age"),
			"fieldtype": "Int",
			"width": 80
		},
		{
			"fieldname": "sport",
			"label": _("Sport"),
			"fieldtype": "Link",
			"options": "club sport",
			"width": 180
		},
		{
			"fieldname": "is_dependent",
			"label": _("Dependent"),
			"fieldtype": "Select",
			"options": "\nYes\nNo",
			"width": 100
		},
		{
			"fieldname": "membership_status",
			"label": _("Membership Status"),
			"fieldtype": "Data",
			"width": 130
		},
		{
			"fieldname": "enrollment_date",
			"label": _("Enrollment Date"),
			"fieldtype": "Date",
			"width": 120
		},
		{
			"fieldname": "membership_type",
			"label": _("Membership Type"),
			"fieldtype": "Data",
			"width": 120
		}
	]


def get_data(filters):
	"""Fetch report data with filters applied"""

	# Build conditions
	conditions = []
	values = {}

	# Sport filter
	if filters.get("sport"):
		conditions.append("se.sport = %(sport)s")
		values["sport"] = filters.get("sport")

	# Dependent status filter
	if filters.get("is_dependent") is not None and filters.get("is_dependent") != "":
		conditions.append("cm.is_dependent = %(is_dependent)s")
		values["is_dependent"] = 1 if filters.get("is_dependent") == "Yes" else 0

	# Age range filter
	if filters.get("age_from"):
		conditions.append("cm.member_age >= %(age_from)s")
		values["age_from"] = filters.get("age_from")

	if filters.get("age_to"):
		conditions.append("cm.member_age <= %(age_to)s")
		values["age_to"] = filters.get("age_to")

	# Name search filter
	if filters.get("member_name"):
		conditions.append("cm.full_name LIKE %(member_name)s")
		values["member_name"] = f"%{filters.get('member_name')}%"

	# Membership status filter
	if filters.get("membership_status"):
		conditions.append("cm.membership_status = %(membership_status)s")
		values["membership_status"] = filters.get("membership_status")

	where_clause = " AND ".join(conditions) if conditions else "1=1"

	# Main query joining Club Member with Sport Enrollment
	query = f"""
		SELECT
			cm.name as member,
			cm.full_name as member_name,
			cm.member_age,
			se.sport,
			CASE WHEN cm.is_dependent = 1 THEN 'Yes' ELSE 'No' END as is_dependent,
			cm.membership_status,
			se.enrollment_date,
			cm.membership_type
		FROM `tabClub Member` cm
		INNER JOIN `tabSport Enrollment` se ON se.member = cm.name
		WHERE {where_clause}
		AND se.status = 'Active'
		ORDER BY cm.full_name
	"""

	data = frappe.db.sql(query, values, as_dict=True)

	return data


@frappe.whitelist()
def get_sports_list():
	"""Get list of active sports for filter dropdown"""
	sports = frappe.get_all("club sport",
		fields=["name", "sports_name"],
		filters={},
		order_by="sports_name")
	return [{"value": s.name, "label": s.sports_name} for s in sports]


@frappe.whitelist()
def get_dashboard_data():
	"""Get aggregated data for dashboard card"""
	# Get all active members with enrollments
	data = frappe.db.sql("""
		SELECT
			cm.name,
			cm.full_name,
			cm.member_age,
			cm.is_dependent,
			se.sport
		FROM `tabClub Member` cm
		INNER JOIN `tabSport Enrollment` se ON se.member = cm.name
		WHERE se.status = 'Active'
		AND cm.membership_status IN ('Active', 'Inactive')
	""", as_dict=True)

	if not data:
		return {
			"total_members": 0,
			"dependents_count": 0,
			"primary_count": 0,
			"sports_count": 0,
			"dependent_pct": 0,
			"sport_distribution": [],
			"age_distribution": {}
		}

	# Calculate stats
	total_members = len(data)
	dependents_count = sum(1 for d in data if d.is_dependent == 1)
	primary_count = total_members - dependents_count
	dependent_pct = round((dependents_count / total_members) * 100, 1) if total_members > 0 else 0

	# Sport distribution
	sport_counts = {}
	for row in data:
		sport = row.get("sport", "Unknown")
		sport_counts[sport] = sport_counts.get(sport, 0) + 1

	sorted_sports = sorted(sport_counts.items(), key=lambda x: x[1], reverse=True)
	sports_count = len(sorted_sports)
	sport_distribution = [{"label": s[0], "value": s[1]} for s in sorted_sports[:8]]

	# Age distribution
	age_groups = {
		"Under 18": 0,
		"18-25": 0,
		"26-35": 0,
		"36-45": 0,
		"46-55": 0,
		"56+": 0
	}

	for row in data:
		age = row.get("member_age", 0)
		if age < 18:
			age_groups["Under 18"] += 1
		elif age <= 25:
			age_groups["18-25"] += 1
		elif age <= 35:
			age_groups["26-35"] += 1
		elif age <= 45:
			age_groups["36-45"] += 1
		elif age <= 55:
			age_groups["46-55"] += 1
		else:
			age_groups["56+"] += 1

	return {
		"total_members": total_members,
		"dependents_count": dependents_count,
		"primary_count": primary_count,
		"sports_count": sports_count,
		"dependent_pct": dependent_pct,
		"sport_distribution": sport_distribution,
		"age_distribution": age_groups
	}
