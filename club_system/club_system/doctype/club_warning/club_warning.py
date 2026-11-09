
import frappe
from frappe.model.document import Document


class clubwarning(Document):
    def after_insert(self):
        self.apply_warning_penalties()

    def apply_warning_penalties(self):
        if not self.member:
            return

        # 1. Fetch the current member data from the database
        member_data = frappe.db.get_value(
            "Club Member",
            self.member,
            ["warning_count", "loyalty_points", "membership_status"],
            as_dict=True
        )

        if not member_data:
            return

        current_warnings = member_data.warning_count or 0
        current_points = member_data.loyalty_points or 0

        # 2. Calculate the new warning count and deduct points
        new_warnings = current_warnings + 1
        deduction = self.points_deducted or 0
        new_points = max(0, current_points - deduction)

        updates = {
            "warning_count": new_warnings,
            "loyalty_points": new_points
        }

        # 3. Automatically suspend the membership when it reaches 3 warnings or more
        if new_warnings >= 3:
            updates["membership_status"] = "Suspended"
            frappe.msgprint(
                msg=f"Alert: Member ({self.member}) reached {new_warnings} warnings and their membership status was automatically changed to Suspended.",
                title="Membership Suspension",
                indicator="red"
            )
        else:
            frappe.msgprint(
                msg=f"Warning recorded successfully. Total warnings: {new_warnings}, points balance after deduction: {new_points}.",
                title="Record Warning",
                indicator="orange"
            )

        # 4. Update the member record in the databas
        frappe.db.set_value("Club Member", self.member, updates)
