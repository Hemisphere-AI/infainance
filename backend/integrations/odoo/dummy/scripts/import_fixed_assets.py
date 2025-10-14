#!/usr/bin/env python3
"""
Import Fixed Assets Data to Odoo
This script imports fixed assets with original cost and accumulated depreciation
"""

import json
import xmlrpc.client
import os
from pathlib import Path
from datetime import datetime, timedelta
import random


class OdooFixedAssetsImporter:
    """Odoo fixed assets importer"""

    def __init__(self, config_file="odoo_config.json"):
        """Initialize with configuration"""
        self.config = self._load_config(config_file)
        self.url = self.config.get("url")
        self.db = self.config.get("db")
        self.username = self.config.get("username")
        self.password = self.config.get("password")

        # Initialize XML-RPC connections
        self.common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
        self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

        # Authenticate
        self.uid = self._authenticate()

    def _load_config(self, config_file):
        """Load configuration from file or environment variables"""
        config = {}

        if Path(config_file).exists():
            with open(config_file) as f:
                config = json.load(f)
        else:
            config = {
                "url": os.getenv("ODOO_URL"),
                "db": os.getenv("ODOO_DB"),
                "username": os.getenv("ODOO_USERNAME"),
                "password": os.getenv("ODOO_PASSWORD"),
            }

        return config

    def _authenticate(self):
        """Authenticate with Odoo"""
        try:
            if self.username and self.password:
                print(f"🔐 Authenticating with username/password...")
                uid = self.common.authenticate(
                    self.db, self.username, self.password, {}
                )
            else:
                print("❌ No username/password provided for authentication")
                return None

            if uid:
                print(f"✅ Authenticated successfully (UID: {uid})")
                return uid
            else:
                print("❌ Authentication failed")
                return None

        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return None

    def test_connection(self):
        """Test connection to Odoo"""
        try:
            version = self.common.version()
            print(f"✅ Connected to Odoo {version.get('server_version', 'Unknown')}")
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False

    def create_asset_categories(self):
        """Create asset categories"""
        print("\n📂 Creating asset categories...")

        categories = [
            {
                "name": "Computer Equipment",
                "description": "Computers, laptops, servers, and related equipment",
                "account_asset_id": 1,  # Assuming account ID 1 exists
                "account_depreciation_id": 2,  # Assuming account ID 2 exists
                "account_depreciation_expense_id": 3,  # Assuming account ID 3 exists
            },
            {
                "name": "Office Furniture",
                "description": "Desks, chairs, cabinets, and office furniture",
                "account_asset_id": 1,
                "account_depreciation_id": 2,
                "account_depreciation_expense_id": 3,
            },
            {
                "name": "Vehicles",
                "description": "Company vehicles and transportation equipment",
                "account_asset_id": 1,
                "account_depreciation_id": 2,
                "account_depreciation_expense_id": 3,
            },
            {
                "name": "Machinery & Equipment",
                "description": "Production machinery and industrial equipment",
                "account_asset_id": 1,
                "account_depreciation_id": 2,
                "account_depreciation_expense_id": 3,
            },
            {
                "name": "Software Licenses",
                "description": "Software licenses and intangible assets",
                "account_asset_id": 1,
                "account_depreciation_id": 2,
                "account_depreciation_expense_id": 3,
            },
        ]

        category_ids = []
        for category in categories:
            try:
                category_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.asset.category",
                    "create",
                    [category],
                )
                category_ids.append(category_id)
                print(f"  ✅ Created category: {category['name']} (ID: {category_id})")
            except Exception as e:
                print(
                    f"  ⚠️  Skipped category (Asset module may not be available): {category['name']}"
                )

        return category_ids

    def create_fixed_assets(self, category_ids):
        """Create fixed assets with original cost and depreciation"""
        print("\n🏢 Creating fixed assets...")

        if not category_ids:
            print("  ⚠️  No asset categories available")
            return []

        # Sample fixed assets data
        assets_data = [
            {
                "name": "Dell Laptop - John Smith",
                "category_id": category_ids[0] if category_ids else 1,
                "original_value": 2500.00,
                "acquisition_date": "2022-01-15",
                "depreciation_method": "linear",
                "depreciation_percentage": 20.0,  # 5 years
                "accumulated_depreciation": 1000.00,
                "current_value": 1500.00,
                "location": "Office - Desk 1",
                "serial_number": "DL-2022-001",
            },
            {
                "name": "HP Desktop - Accounting",
                "category_id": category_ids[0] if category_ids else 1,
                "original_value": 1800.00,
                "acquisition_date": "2022-03-10",
                "depreciation_method": "linear",
                "depreciation_percentage": 20.0,
                "accumulated_depreciation": 720.00,
                "current_value": 1080.00,
                "location": "Office - Accounting",
                "serial_number": "HP-2022-002",
            },
            {
                "name": "Office Desk - Executive",
                "category_id": category_ids[1] if len(category_ids) > 1 else 1,
                "original_value": 1200.00,
                "acquisition_date": "2021-06-01",
                "depreciation_method": "linear",
                "depreciation_percentage": 10.0,  # 10 years
                "accumulated_depreciation": 300.00,
                "current_value": 900.00,
                "location": "Office - Executive Suite",
                "serial_number": "DESK-2021-001",
            },
            {
                "name": "Office Chair - Ergonomic",
                "category_id": category_ids[1] if len(category_ids) > 1 else 1,
                "original_value": 450.00,
                "acquisition_date": "2022-02-15",
                "depreciation_method": "linear",
                "depreciation_percentage": 20.0,  # 5 years
                "accumulated_depreciation": 135.00,
                "current_value": 315.00,
                "location": "Office - Desk 1",
                "serial_number": "CHAIR-2022-001",
            },
            {
                "name": "Company Vehicle - Toyota Camry",
                "category_id": category_ids[2] if len(category_ids) > 2 else 1,
                "original_value": 25000.00,
                "acquisition_date": "2021-09-01",
                "depreciation_method": "linear",
                "depreciation_percentage": 20.0,  # 5 years
                "accumulated_depreciation": 10000.00,
                "current_value": 15000.00,
                "location": "Company Garage",
                "serial_number": "VIN-2021-001",
            },
            {
                "name": "Production Machine - CNC",
                "category_id": category_ids[3] if len(category_ids) > 3 else 1,
                "original_value": 50000.00,
                "acquisition_date": "2020-01-15",
                "depreciation_method": "linear",
                "depreciation_percentage": 10.0,  # 10 years
                "accumulated_depreciation": 15000.00,
                "current_value": 35000.00,
                "location": "Production Floor",
                "serial_number": "CNC-2020-001",
            },
            {
                "name": "Microsoft Office License",
                "category_id": category_ids[4] if len(category_ids) > 4 else 1,
                "original_value": 500.00,
                "acquisition_date": "2022-01-01",
                "depreciation_method": "linear",
                "depreciation_percentage": 33.33,  # 3 years
                "accumulated_depreciation": 166.65,
                "current_value": 333.35,
                "location": "Software License",
                "serial_number": "MS-2022-001",
            },
            {
                "name": "Server Rack - Dell PowerEdge",
                "category_id": category_ids[0] if category_ids else 1,
                "original_value": 15000.00,
                "acquisition_date": "2021-11-01",
                "depreciation_method": "linear",
                "depreciation_percentage": 20.0,  # 5 years
                "accumulated_depreciation": 6000.00,
                "current_value": 9000.00,
                "location": "Server Room",
                "serial_number": "SRV-2021-001",
            },
            {
                "name": "Conference Table - Large",
                "category_id": category_ids[1] if len(category_ids) > 1 else 1,
                "original_value": 2000.00,
                "acquisition_date": "2021-08-15",
                "depreciation_method": "linear",
                "depreciation_percentage": 10.0,  # 10 years
                "accumulated_depreciation": 400.00,
                "current_value": 1600.00,
                "location": "Conference Room A",
                "serial_number": "TABLE-2021-001",
            },
            {
                "name": "Printer - HP LaserJet",
                "category_id": category_ids[0] if category_ids else 1,
                "original_value": 800.00,
                "acquisition_date": "2022-05-01",
                "depreciation_method": "linear",
                "depreciation_percentage": 20.0,  # 5 years
                "accumulated_depreciation": 240.00,
                "current_value": 560.00,
                "location": "Office - Print Station",
                "serial_number": "PRT-2022-001",
            },
        ]

        created_assets = []
        for asset_data in assets_data:
            try:
                # Create the asset record
                asset_record = {
                    "name": asset_data["name"],
                    "category_id": asset_data["category_id"],
                    "original_value": asset_data["original_value"],
                    "acquisition_date": asset_data["acquisition_date"],
                    "depreciation_method": asset_data["depreciation_method"],
                    "depreciation_percentage": asset_data["depreciation_percentage"],
                    "location": asset_data["location"],
                    "serial_number": asset_data["serial_number"],
                    "state": "open",
                }

                asset_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.asset",
                    "create",
                    [asset_record],
                )

                # Update with accumulated depreciation
                self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.asset",
                    "write",
                    [asset_id],
                    {
                        "accumulated_depreciation": asset_data[
                            "accumulated_depreciation"
                        ],
                        "current_value": asset_data["current_value"],
                    },
                )

                created_assets.append(
                    {
                        "id": asset_id,
                        "name": asset_data["name"],
                        "original_value": asset_data["original_value"],
                        "accumulated_depreciation": asset_data[
                            "accumulated_depreciation"
                        ],
                        "current_value": asset_data["current_value"],
                    }
                )

                print(f"  ✅ Created asset: {asset_data['name']} (ID: {asset_id})")
                print(f"      Original: ${asset_data['original_value']:,.2f}")
                print(
                    f"      Depreciation: ${asset_data['accumulated_depreciation']:,.2f}"
                )
                print(f"      Current Value: ${asset_data['current_value']:,.2f}")

            except Exception as e:
                print(
                    f"  ⚠️  Skipped asset (Asset module may not be available): {asset_data['name']}"
                )

        return created_assets

    def create_depreciation_entries(self, assets):
        """Create depreciation entries for assets"""
        print("\n📉 Creating depreciation entries...")

        if not assets:
            print("  ⚠️  No assets available for depreciation entries")
            return []

        depreciation_entries = []

        for asset in assets:
            # Create monthly depreciation entries for the last 12 months
            base_date = datetime.now() - timedelta(days=365)

            for month in range(12):
                entry_date = base_date + timedelta(days=30 * month)

                # Calculate monthly depreciation
                monthly_depreciation = asset["original_value"] * (
                    asset.get("depreciation_percentage", 20) / 100 / 12
                )

                entry = {
                    "asset_id": asset["id"],
                    "date": entry_date.strftime("%Y-%m-%d"),
                    "amount": monthly_depreciation,
                    "description": f"Monthly depreciation for {asset['name']}",
                    "state": "posted",
                }

                depreciation_entries.append(entry)

        print(f"  Generated {len(depreciation_entries)} depreciation entries")
        return depreciation_entries

    def generate_assets_summary(self, assets, depreciation_entries):
        """Generate assets summary"""
        print("\n📊 Generating assets summary...")

        if not assets:
            return {}

        # Calculate totals
        total_original_value = sum(asset["original_value"] for asset in assets)
        total_accumulated_depreciation = sum(
            asset["accumulated_depreciation"] for asset in assets
        )
        total_current_value = sum(asset["current_value"] for asset in assets)

        # Calculate depreciation ratio
        depreciation_ratio = (
            (total_accumulated_depreciation / total_original_value * 100)
            if total_original_value > 0
            else 0
        )

        # Group by category
        categories = {}
        for asset in assets:
            category = asset.get("category_name", "Unknown")
            if category not in categories:
                categories[category] = {
                    "count": 0,
                    "original_value": 0,
                    "current_value": 0,
                }
            categories[category]["count"] += 1
            categories[category]["original_value"] += asset["original_value"]
            categories[category]["current_value"] += asset["current_value"]

        summary = {
            "generated_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_assets": len(assets),
            "total_original_value": total_original_value,
            "total_accumulated_depreciation": total_accumulated_depreciation,
            "total_current_value": total_current_value,
            "depreciation_ratio": depreciation_ratio,
            "categories": categories,
            "depreciation_entries": len(depreciation_entries),
        }

        return summary

    def save_assets_data(self, assets, depreciation_entries, summary):
        """Save assets data to files"""
        print("\n💾 Saving assets data to files...")

        # Save assets
        with open("fixed_assets.json", "w") as f:
            json.dump(assets, f, indent=2)
        print("  ✅ Saved assets to fixed_assets.json")

        # Save depreciation entries
        with open("depreciation_entries.json", "w") as f:
            json.dump(depreciation_entries, f, indent=2)
        print("  ✅ Saved depreciation entries to depreciation_entries.json")

        # Save summary
        with open("assets_summary.json", "w") as f:
            json.dump(summary, f, indent=2)
        print("  ✅ Saved summary to assets_summary.json")

    def import_all_fixed_assets(self):
        """Import all fixed assets data"""
        print("🏢 Importing Fixed Assets to Odoo")
        print("=" * 50)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Create asset categories
        category_ids = self.create_asset_categories()

        # Create fixed assets
        assets = self.create_fixed_assets(category_ids)

        # Create depreciation entries
        depreciation_entries = self.create_depreciation_entries(assets)

        # Generate summary
        summary = self.generate_assets_summary(assets, depreciation_entries)

        # Display summary
        if summary:
            print("\n" + "=" * 50)
            print("📊 FIXED ASSETS SUMMARY")
            print("=" * 50)

            print(f"\n🏢 Assets Overview:")
            print(f"  Total Assets: {summary['total_assets']}")
            print(f"  Total Original Value: ${summary['total_original_value']:,.2f}")
            print(
                f"  Total Accumulated Depreciation: ${summary['total_accumulated_depreciation']:,.2f}"
            )
            print(f"  Total Current Value: ${summary['total_current_value']:,.2f}")
            print(f"  Depreciation Ratio: {summary['depreciation_ratio']:.1f}%")

            print(f"\n📂 Assets by Category:")
            for category, data in summary["categories"].items():
                print(f"  {category}: {data['count']} assets")
                print(f"    Original Value: ${data['original_value']:,.2f}")
                print(f"    Current Value: ${data['current_value']:,.2f}")

            print(f"\n📉 Depreciation Entries:")
            print(f"  Total Entries: {summary['depreciation_entries']}")

        # Save data to files
        self.save_assets_data(assets, depreciation_entries, summary)

        print("\n✅ Fixed assets import completed!")
        print("\n🔧 Next Steps:")
        print("1. Check the generated data files in your project directory")
        print("2. Review the assets in your Odoo instance")
        print("3. Use the MCP tools to query asset data")

        return {
            "assets": assets,
            "depreciation_entries": depreciation_entries,
            "summary": summary,
        }


def main():
    """Main function"""
    print("🎯 Odoo Fixed Assets Importer")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize importer
    importer = OdooFixedAssetsImporter()

    # Import fixed assets
    results = importer.import_all_fixed_assets()

    if results:
        print(f"\n📋 Generated Data Files:")
        print(f"  - fixed_assets.json")
        print(f"  - depreciation_entries.json")
        print(f"  - assets_summary.json")


if __name__ == "__main__":
    main()
