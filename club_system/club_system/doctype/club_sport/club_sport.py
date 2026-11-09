# Copyright (c) 2026, kareem and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class clubsport(Document):
	def validate(self):
		self.validate_coaches()

	def validate_coaches(self):
		# Ensure the field name here matches the fieldname of the child table in Club Sport
		for coach in getattr(self, "the_coach_data", []) or []:
			# If the coach is Egyptian
			if getattr(coach, "is_he_egyptian", False):
				# Check if national number exists
				if not getattr(coach, "national_number", None):
					frappe.throw(f"National number is required for coach: {getattr(coach, 'coach_name', '')}")

				# Remove any accidental spaces and verify length and that it only contains digits
				national_id = str(getattr(coach, "national_number", "")).strip()
				if len(national_id) != 14 or not national_id.isdigit():
					frappe.throw(f"National number for coach ({getattr(coach, 'coach_name', '')}) is invalid. It must be 14 digits.")