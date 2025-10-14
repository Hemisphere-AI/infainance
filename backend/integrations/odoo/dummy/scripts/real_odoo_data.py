#!/usr/bin/env python3
"""
Real Odoo Data Manager using XML-RPC
This script actually connects to Odoo and adds dummy data
"""

import json
import xmlrpc.client
import os
from pathlib import Path

class RealOdooDataManager:
    """Real Odoo data manager using XML-RPC"""

    def __init__(self, config_file="odoo_config.json"):
        """Initialize with configuration"""
        self.config = self._load_config(config_file)
        self.url = self.config.get("url")
        self.db = self.config.get("db")
        self.api_key = self.config.get("api_key")
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
                "api_key": os.getenv("ODOO_API_KEY"),
                "username": os.getenv("ODOO_USERNAME"),
                "password": os.getenv("ODOO_PASSWORD"),
            }

        return config

    def _authenticate(self):
        """Authenticate with Odoo"""
        try:
            # For now, use username/password authentication
            # API key authentication requires different approach in Odoo
            if self.username and self.password:
                print(f"🔐 Authenticating with username/password...")
                uid = self.common.authenticate(self.db, self.username, self.password, {})
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

    def add_contacts(self):
        """Add sample contacts/partners"""
        print("\n👥 Adding sample contacts...")

        contacts = [
            {
                "name": "Acme Corporation",
                "is_company": True,
                "email": "contact@acme.com",
                "phone": "+1-555-0123",
                "street": "123 Business Ave",
                "city": "New York",
                "zip": "10001",
            },
            {
                "name": "TechStart Inc",
                "is_company": True,
                "email": "info@techstart.com",
                "phone": "+1-555-0456",
                "street": "456 Innovation St",
                "city": "San Francisco",
                "zip": "94102",
            },
            {
                "name": "John Smith",
                "is_company": False,
                "email": "john.smith@email.com",
                "phone": "+1-555-0789",
                "street": "789 Personal Lane",
                "city": "Los Angeles",
                "zip": "90210",
            }
        ]

        created_contacts = []
        for contact in contacts:
            try:
                print(f"  Adding: {contact['name']}")
                contact_id = self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'res.partner', 'create',
                    [contact]
                )
                created_contacts.append(contact_id)
                print(f"    ✅ Created with ID: {contact_id}")
            except Exception as e:
                print(f"    ❌ Failed: {e}")

        return created_contacts

    def add_products(self):
        """Add sample products"""
        print("\n📦 Adding sample products...")

        products = [
            {
                "name": "Laptop Computer",
                "type": "consu",  # Changed from "product" to "consu" (consumable)
                "list_price": 1299.99,
                "standard_price": 800.00,
                "description": "High-performance laptop for business use",
            },
            {
                "name": "Office Chair",
                "type": "consu",  # Changed from "product" to "consu" (consumable)
                "list_price": 299.99,
                "standard_price": 150.00,
                "description": "Ergonomic office chair for comfort",
            },
            {
                "name": "Software License",
                "type": "service",
                "list_price": 99.99,
                "standard_price": 50.00,
                "description": "Annual software license subscription",
            }
        ]

        created_products = []
        for product in products:
            try:
                print(f"  Adding: {product['name']}")
                product_id = self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'product.product', 'create',
                    [product]
                )
                created_products.append(product_id)
                print(f"    ✅ Created with ID: {product_id}")
            except Exception as e:
                print(f"    ❌ Failed: {e}")

        return created_products

    def add_employees(self):
        """Add sample employees"""
        print("\n👨‍💼 Adding sample employees...")

        employees = [
            {
                "name": "Alice Johnson",
                "work_email": "alice.johnson@company.com",
                "work_phone": "+1-555-1001",
                "job_title": "Sales Manager",
            },
            {
                "name": "Bob Wilson",
                "work_email": "bob.wilson@company.com",
                "work_phone": "+1-555-1002",
                "job_title": "Developer",
            },
            {
                "name": "Carol Davis",
                "work_email": "carol.davis@company.com",
                "work_phone": "+1-555-1003",
                "job_title": "Accountant",
            }
        ]

        created_employees = []
        for employee in employees:
            try:
                print(f"  Adding: {employee['name']}")
                # Try to create employee, but skip if HR module is not available
                employee_id = self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'hr.employee', 'create',
                    [employee]
                )
                created_employees.append(employee_id)
                print(f"    ✅ Created with ID: {employee_id}")
            except Exception as e:
                print(f"    ⚠️  Skipped (HR module may not be available): {employee['name']}")

        return created_employees

    def add_sales_orders(self, partner_ids, product_ids):
        """Add sample sales orders"""
        print("\n🛒 Adding sample sales orders...")

        if not partner_ids or not product_ids:
            print("  ⚠️  No partners or products available for sales orders")
            return []

        orders = [
            {
                "partner_id": partner_ids[0],
                "order_line": [
                    (0, 0, {
                        "product_id": product_ids[0],
                        "product_uom_qty": 2,
                        "price_unit": 1299.99,
                    }),
                    (0, 0, {
                        "product_id": product_ids[1] if len(product_ids) > 1 else product_ids[0],
                        "product_uom_qty": 1,
                        "price_unit": 299.99,
                    })
                ],
                "note": "Bulk order for new office setup",
            }
        ]

        created_orders = []
        for order in orders:
            try:
                print(f"  Adding Sales Order")
                # Try to create sales order, but skip if Sales module is not available
                order_id = self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'sale.order', 'create',
                    [order]
                )
                created_orders.append(order_id)
                print(f"    ✅ Created with ID: {order_id}")
            except Exception as e:
                print(f"    ⚠️  Skipped (Sales module may not be available)")

        return created_orders

    def add_all_dummy_data(self):
        """Add all dummy data to Odoo"""
        print("🚀 Adding Real Dummy Data to Odoo")
        print("=" * 40)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Add different types of data
        partner_ids = self.add_contacts()
        product_ids = self.add_products()
        employee_ids = self.add_employees()
        order_ids = self.add_sales_orders(partner_ids, product_ids)

        print("\n✅ Dummy data addition completed!")
        print("\n📊 Summary:")
        print(f"  - {len(partner_ids)} Contacts/Partners added")
        print(f"  - {len(product_ids)} Products added")
        print(f"  - {len(employee_ids)} Employees added")
        print(f"  - {len(order_ids)} Sales Orders added")

        return {
            "partners": partner_ids,
            "products": product_ids,
            "employees": employee_ids,
            "orders": order_ids
        }

def main():
    """Main function"""
    print("🎯 Real Odoo Dummy Data Generator")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize data manager
    manager = RealOdooDataManager()

    # Add dummy data
    results = manager.add_all_dummy_data()

    if results:
        print("\n🔧 Next Steps:")
        print("1. Check your Odoo instance to see the new data")
        print("2. Use the MCP tools to query the data")
        print("3. Test the integration with real Odoo operations")
        print(f"\n📋 Created Record IDs:")
        print(f"  Partners: {results['partners']}")
        print(f"  Products: {results['products']}")
        print(f"  Employees: {results['employees']}")
        print(f"  Orders: {results['orders']}")

if __name__ == "__main__":
    main()