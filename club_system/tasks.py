# Copyright (c) 2026, kareem and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import today

def check_expired_memberships():
    """
    مهمة يومية مجدولة:
    فحص تواريخ انتهاء اشتراك الأعضاء وتحويل المنتهي منها إلى Expired
    """
    current_date = today()

    # جلب أسماء الأعضاء النشطين المنتهية صلاحيتهم
    expired_members = frappe.get_all(
        "Club Member",
        filters={
            "membership_status": "Active",
            "expiry_date": ["<", current_date]
        },
        pluck="name"
    )

    if not expired_members:
        return

    # تحديث حالة الأعضاء المنتهية عضويتهم
    for member_id in expired_members:
        frappe.db.set_value("Club Member", member_id, "membership_status", "Expired")

    frappe.db.commit()
    frappe.logger().info(f"Club System: Updated {len(expired_members)} members to Expired.")