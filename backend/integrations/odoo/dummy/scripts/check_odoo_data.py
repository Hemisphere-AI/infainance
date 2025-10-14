#!/usr/bin/env python3
"""
Check Odoo Data
This script shows what data exists in your Odoo instance
"""

import json
import xmlrpc.client
import os
from pathlib import Path


class OdooDataChecker:
    """Odoo data checker using XML-RPC"""

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

    def check_partners(self):
        """Check all partners in the system"""
        print("\n👥 Checking Partners...")

        try:
            partners = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.partner",
                "search_read",
                [],
                {"fields": ["id", "name", "email", "phone", "is_company"], "limit": 20},
            )

            print(f"  Found {len(partners)} partners:")
            for partner in partners:
                company_type = "Company" if partner.get("is_company") else "Individual"
                print(f"    ID {partner['id']}: {partner['name']} ({company_type})")
                if partner.get("email"):
                    print(f"      Email: {partner['email']}")
                if partner.get("phone"):
                    print(f"      Phone: {partner['phone']}")

            return partners

        except Exception as e:
            print(f"  ❌ Error checking partners: {e}")
            return []

    def check_products(self):
        """Check all products in the system"""
        print("\n📦 Checking Products...")

        try:
            products = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "product.product",
                "search_read",
                [],
                {"fields": ["id", "name", "list_price", "type"], "limit": 20},
            )

            print(f"  Found {len(products)} products:")
            for product in products:
                print(f"    ID {product['id']}: {product['name']}")
                print(f"      Price: ${product.get('list_price', 0):.2f}")
                print(f"      Type: {product.get('type', 'Unknown')}")

            return products

        except Exception as e:
            print(f"  ❌ Error checking products: {e}")
            return []

    def check_sales_orders(self):
        """Check sales orders if available"""
        print("\n🛒 Checking Sales Orders...")

        try:
            orders = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "sale.order",
                "search_read",
                [],
                {
                    "fields": ["id", "name", "partner_id", "amount_total", "state"],
                    "limit": 10,
                },
            )

            print(f"  Found {len(orders)} sales orders:")
            for order in orders:
                print(f"    ID {order['id']}: {order.get('name', 'N/A')}")
                print(f"      Partner ID: {order.get('partner_id', 'N/A')}")
                print(f"      Amount: ${order.get('amount_total', 0):.2f}")
                print(f"      State: {order.get('state', 'Unknown')}")

            return orders

        except Exception as e:
            print(f"  ⚠️  Sales module not available: {e}")
            return []

    def check_invoices(self):
        """Check invoices if available"""
        print("\n🧾 Checking Invoices...")

        try:
            invoices = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "search_read",
                [("move_type", "=", "out_invoice")],
                {
                    "fields": ["id", "name", "partner_id", "amount_total", "state"],
                    "limit": 10,
                },
            )

            print(f"  Found {len(invoices)} invoices:")
            for invoice in invoices:
                print(f"    ID {invoice['id']}: {invoice.get('name', 'N/A')}")
                print(f"      Partner ID: {invoice.get('partner_id', 'N/A')}")
                print(f"      Amount: ${invoice.get('amount_total', 0):.2f}")
                print(f"      State: {invoice.get('state', 'Unknown')}")

            return invoices

        except Exception as e:
            print(f"  ⚠️  Accounting module not available: {e}")
            return []

    def check_all_data(self):
        """Check all data in the system"""
        print("🔍 Checking Odoo Data")
        print("=" * 40)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        try:
            version = self.common.version()
            print(f"✅ Connected to Odoo {version.get('server_version', 'Unknown')}")
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return

        # Check different types of data
        partners = self.check_partners()
        products = self.check_products()
        orders = self.check_sales_orders()
        invoices = self.check_invoices()

        print("\n📊 Summary:")
        print(f"  - {len(partners)} Partners")
        print(f"  - {len(products)} Products")
        print(f"  - {len(orders)} Sales Orders")
        print(f"  - {len(invoices)} Invoices")

        return {
            "partners": partners,
            "products": products,
            "orders": orders,
            "invoices": invoices,
        }


def main():
    """Main function"""
    print("🎯 Odoo Data Checker")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize data checker
    checker = OdooDataChecker()

    # Check all data
    results = checker.check_all_data()

    if results:
        print("\n🔧 Next Steps:")
        print("1. Check your Odoo web interface to see the data")
        print("2. Use the MCP tools to query specific records")
        print("3. Test creating new records through the interface")


if __name__ == "__main__":
    main()
