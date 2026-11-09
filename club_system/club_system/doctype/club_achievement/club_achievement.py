# Copyright (c) 2026, kareem and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class ClubAchievement(Document):
    def on_update(self):
        if self.status == "approved" and self.point_earnd and not self.flags.points_awarded:
            self.update_member_points(int(self.point_earnd))

    def update_member_points(self, loyalty_points):
        member_doc = frappe.get_doc("Club Member", self.member)
        if member_doc.is_dependent:
            if not member_doc.primary_member:
                frappe.throw("Dependent member must have a primary member linked.")
            target_id = member_doc.primary_member
            current_points = frappe.db.get_value("Club Member", target_id, "loyalty_points") or 0
        else:
            target_id = self.member
            current_points = member_doc.loyalty_points or 0
        new_points = current_points + loyalty_points
        frappe.db.set_value("Club Member", target_id, "loyalty_points", new_points)
        frappe.msgprint(f"Added {loyalty_points} points to {target_id}. New balance: {new_points}")
        self.flags.points_awarded = True