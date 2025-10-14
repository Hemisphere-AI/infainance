#!/usr/bin/env python3
"""
Create Fixed Assets Excel Template
This script creates a comprehensive Excel template for fixed assets import
"""

import json
import pandas as pd
from datetime import datetime, timedelta
import random


def create_fixed_assets_excel():
    """Create Excel template for fixed assets"""
    print("📊 Creating Fixed Assets Excel Template")
    print("=" * 50)

    # Load the fixed assets data
    with open("fixed_assets_template.json", "r") as f:
        data = json.load(f)

    assets = data["fixed_assets"]
    depreciation_schedule = data["depreciation_schedule"]
    summary = data["summary"]

    # Create Excel file with multiple sheets
    with pd.ExcelWriter("Fixed_Assets_Template.xlsx", engine="openpyxl") as writer:

        # Sheet 1: Fixed Assets Register
        print("📋 Creating Fixed Assets Register sheet...")
        assets_df = pd.DataFrame(assets)
        assets_df.to_excel(writer, sheet_name="Fixed Assets Register", index=False)

        # Sheet 2: Depreciation Schedule
        print("📉 Creating Depreciation Schedule sheet...")
        depreciation_df = pd.DataFrame(depreciation_schedule)
        depreciation_df.to_excel(
            writer, sheet_name="Depreciation Schedule", index=False
        )

        # Sheet 3: Summary Report
        print("📊 Creating Summary Report sheet...")
        summary_data = []
        summary_data.append(["Total Assets", summary["total_assets"]])
        summary_data.append(
            ["Total Original Cost", f"${summary['total_original_cost']:,.2f}"]
        )
        summary_data.append(
            [
                "Total Accumulated Depreciation",
                f"${summary['total_accumulated_depreciation']:,.2f}",
            ]
        )
        summary_data.append(
            ["Total Current Book Value", f"${summary['total_current_book_value']:,.2f}"]
        )
        summary_data.append(
            [
                "Average Depreciation Rate",
                f"{summary['average_depreciation_rate']:.1f}%",
            ]
        )
        summary_data.append(["", ""])
        summary_data.append(["Category Breakdown:", ""])

        for category, details in summary["categories"].items():
            summary_data.append([f"{category} Count", details["count"]])
            summary_data.append(
                [f"{category} Original Cost", f"${details['original_cost']:,.2f}"]
            )
            summary_data.append(
                [f"{category} Current Value", f"${details['current_value']:,.2f}"]
            )
            summary_data.append(["", ""])

        summary_df = pd.DataFrame(summary_data, columns=["Metric", "Value"])
        summary_df.to_excel(writer, sheet_name="Summary Report", index=False)

        # Sheet 4: Import Template
        print("📥 Creating Import Template sheet...")
        import_template = []
        for asset in assets:
            import_template.append(
                {
                    "Asset ID": asset["asset_id"],
                    "Name": asset["name"],
                    "Category": asset["category"],
                    "Original Cost": asset["original_cost"],
                    "Acquisition Date": asset["acquisition_date"],
                    "Depreciation Method": asset["depreciation_method"],
                    "Useful Life (Years)": asset["useful_life_years"],
                    "Depreciation Rate (%)": asset["depreciation_rate_annual"],
                    "Accumulated Depreciation": asset["accumulated_depreciation"],
                    "Current Book Value": asset["current_book_value"],
                    "Location": asset["location"],
                    "Serial Number": asset["serial_number"],
                    "Vendor": asset["vendor"],
                    "Purchase Order": asset["purchase_order"],
                    "Warranty Expiry": asset["warranty_expiry"],
                    "Status": asset["status"],
                    "Assigned To": asset["assigned_to"],
                    "Department": asset["department"],
                }
            )

        import_df = pd.DataFrame(import_template)
        import_df.to_excel(writer, sheet_name="Import Template", index=False)

        # Sheet 5: Depreciation Calculation
        print("🧮 Creating Depreciation Calculation sheet...")
        calc_data = []
        for asset in assets:
            monthly_depreciation = asset["original_cost"] * (
                asset["depreciation_rate_annual"] / 100 / 12
            )
            remaining_life_months = (asset["useful_life_years"] * 12) - (
                asset["accumulated_depreciation"] / monthly_depreciation
            )

            calc_data.append(
                {
                    "Asset ID": asset["asset_id"],
                    "Name": asset["name"],
                    "Original Cost": asset["original_cost"],
                    "Depreciation Rate (Annual %)": asset["depreciation_rate_annual"],
                    "Monthly Depreciation": round(monthly_depreciation, 2),
                    "Accumulated Depreciation": asset["accumulated_depreciation"],
                    "Current Book Value": asset["current_book_value"],
                    "Remaining Life (Months)": round(remaining_life_months, 0),
                    "Depreciation to Date (Months)": round(
                        asset["accumulated_depreciation"] / monthly_depreciation, 0
                    ),
                }
            )

        calc_df = pd.DataFrame(calc_data)
        calc_df.to_excel(writer, sheet_name="Depreciation Calculation", index=False)

    print("\n✅ Excel template created successfully!")
    print("📁 File: Fixed_Assets_Template.xlsx")
    print("\n📋 Sheets created:")
    print("  1. Fixed Assets Register - Complete asset details")
    print("  2. Depreciation Schedule - Monthly depreciation entries")
    print("  3. Summary Report - Financial summary and category breakdown")
    print("  4. Import Template - Ready for Odoo import")
    print(
        "  5. Depreciation Calculation - Depreciation calculations and remaining life"
    )

    return True


def create_csv_templates():
    """Create CSV templates for easy import"""
    print("\n📄 Creating CSV templates...")

    # Load the fixed assets data
    with open("fixed_assets_template.json", "r") as f:
        data = json.load(f)

    assets = data["fixed_assets"]

    # Create CSV for fixed assets
    assets_df = pd.DataFrame(assets)
    assets_df.to_csv("Fixed_Assets_Import.csv", index=False)
    print("  ✅ Created Fixed_Assets_Import.csv")

    # Create CSV for depreciation schedule
    depreciation_df = pd.DataFrame(data["depreciation_schedule"])
    depreciation_df.to_csv("Depreciation_Schedule.csv", index=False)
    print("  ✅ Created Depreciation_Schedule.csv")

    return True


def main():
    """Main function"""
    print("🎯 Fixed Assets Excel Template Creator")
    print("=" * 50)

    try:
        # Create Excel template
        create_fixed_assets_excel()

        # Create CSV templates
        create_csv_templates()

        print("\n🎉 All templates created successfully!")
        print("\n🔧 Next Steps:")
        print("1. Open Fixed_Assets_Template.xlsx to review the data")
        print("2. Use Fixed_Assets_Import.csv for Odoo import")
        print("3. Customize the data as needed for your organization")
        print("4. Import the data into your Odoo system")

    except Exception as e:
        print(f"❌ Error creating templates: {e}")
        return False


if __name__ == "__main__":
    main()
