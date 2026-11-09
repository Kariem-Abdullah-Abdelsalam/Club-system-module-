# Copyright (c) 2026, kareem and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, nowdate, date_diff
import random

class ClubMember(Document):
    def validate(self):
        self.calc_member_age()
        self.calculate_days_left()
        self.validate_national_number()

    def calc_member_age(self):
        # 1. حساب السن لو تاريخ الميلاد موجود
        if self.date_of_birth:
            today = getdate(nowdate())
            dob = getdate(self.date_of_birth)
            
            if dob > today:
                frappe.throw("Date of Birth cannot be in the future.")
            
            age = date_diff(today, dob) / 365.25
            self.member_age = int(age)

        # 2. التحقق من وجود سن للعضو
        if not self.member_age: 
            frappe.throw("Please provide either Date of Birth or Member Age.")

        # 3. منع التسجيل تحت 18 سنة للعضو الأساسي فقط (السماح للتابعين)
        if not self.is_dependent and self.member_age < 18:
            frappe.throw("Primary Member must be at least 18 years old.")

    def calculate_days_left(self):
        if self.expiry_date:
            today = getdate(nowdate())
            expiry = getdate(self.expiry_date)
            
            self.days_left = date_diff(expiry, today)

            # تحديث الحالة تلقائياً لو الاشتراك انتهى
            if self.days_left <= 0:
                self.membership_status = "Expired"
    def validate_national_number(self):
        if self.national_number:
            national_id = str(self.national_number).strip()
            if len(national_id) != 14 or not national_id.isdigit():
                frappe.throw("National number is invalid. It must be 14 digits.")
    def before_insert(self):
        # start generating a unique member ID
        while True:
            # Generate a random 6-digit number
            random_number = random.randint(100000, 999999)
            member_id = f"MEM-{random_number}"

            # Check if the generated member ID already exists in the database
            existing_member = frappe.db.exists("Club Member", {"membership_id": member_id})

            if not existing_member:
                self.membership_id = member_id
                break
          