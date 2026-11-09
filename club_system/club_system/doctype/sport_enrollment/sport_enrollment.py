# Copyright (c) 2026, kareem and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SportEnrollment(Document):
    def validate(self):
        if not self.member or not self.sport:
            return

        self.validate_membership_activeness()
        self.validate_enrollment_limit()

    def validate_membership_activeness(self):
        # Check if the member's membership is active 
        membership_status = frappe.db.get_value("Club Member", self.member, "membership_status")
        if membership_status != "Active":
            frappe.throw(
                f"Member {self.member} does not have an active membership. Current status: {membership_status}."
            )

    def validate_enrollment_limit(self):
        max_capacity = frappe.db.get_value("club sport", self.sport, "max_capacity") or 0
        current_enrollment = frappe.db.get_value("club sport", self.sport, "current_enrollment") or 0

        # لو فيه سعة محددة وتجاوزناها
        if max_capacity > 0 and current_enrollment >= max_capacity:
            frappe.throw(f"The sport {self.sport} has reached its maximum enrollment limit of {max_capacity}.")

    def after_insert(self):
        # Increment the current enrollment count for the sport
        current = frappe.db.get_value("club sport", self.sport, "current_enrollment") or 0
        frappe.db.set_value("club sport", self.sport, "current_enrollment", current + 1)