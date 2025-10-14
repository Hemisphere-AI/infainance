#!/usr/bin/env python3
"""
Add Financial Data to Odoo using MCP Integration
This script adds sample financial data including contracts, invoices, and payments
"""

import json
import xmlrpc.client
import os
from pathlib import Path
from datetime import datetime, timedelta
import random


class OdooFinancialDataManager:
    """Odoo financial data manager using XML-RPC"""

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

    def get_or_create_partners(self):
        """Get existing partners or create new ones"""
        print("\n👥 Getting/Creating partners...")

        # Try to get existing partners first
        try:
            existing_partners = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.partner",
                "search_read",
                [[("is_company", "=", True)]],
                {"limit": 5},
            )
            if existing_partners:
                print(f"  Found {len(existing_partners)} existing partners")
                return [p["id"] for p in existing_partners]
        except:
            pass

        # Create new partners if none exist
        partners = [
            {
                "name": "Acme Corporation",
                "is_company": True,
                "email": "contact@acme.com",
            },
            {
                "name": "TechStart Inc",
                "is_company": True,
                "email": "info@techstart.com",
            },
            {
                "name": "Global Solutions Ltd",
                "is_company": True,
                "email": "sales@global.com",
            },
        ]

        partner_ids = []
        for partner in partners:
            try:
                partner_id = self.models.execute_kw(
                    self.db, self.uid, self.password, "res.partner", "create", [partner]
                )
                partner_ids.append(partner_id)
                print(f"  ✅ Created partner: {partner['name']} (ID: {partner_id})")
            except Exception as e:
                print(f"  ❌ Failed to create partner {partner['name']}: {e}")

        return partner_ids

    def get_or_create_products(self):
        """Get existing products or create new ones"""
        print("\n📦 Getting/Creating products...")

        # Try to get existing products first
        try:
            existing_products = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "product.product",
                "search_read",
                [],
                {"limit": 5},
            )
            if existing_products:
                print(f"  Found {len(existing_products)} existing products")
                return [p["id"] for p in existing_products]
        except:
            pass

        # Create new products if none exist
        products = [
            {"name": "Software License", "type": "service", "list_price": 99.99},
            {"name": "Consulting Service", "type": "service", "list_price": 150.00},
            {"name": "Support Contract", "type": "service", "list_price": 200.00},
        ]

        product_ids = []
        for product in products:
            try:
                product_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "product.product",
                    "create",
                    [product],
                )
                product_ids.append(product_id)
                print(f"  ✅ Created product: {product['name']} (ID: {product_id})")
            except Exception as e:
                print(f"  ❌ Failed to create product {product['name']}: {e}")

        return product_ids

    def create_selling_contracts(self, partner_ids, product_ids):
        """Create sample selling contracts for multiple months"""
        print("\n📋 Creating selling contracts...")

        if not partner_ids or not product_ids:
            print("  ⚠️  No partners or products available for contracts")
            return []

        # Generate contracts for the last 6 months
        contracts = []
        base_date = datetime.now() - timedelta(days=180)

        for month in range(6):
            contract_date = base_date + timedelta(days=30 * month)

            for i in range(random.randint(2, 4)):  # 2-4 contracts per month
                partner_id = random.choice(partner_ids)
                product_id = random.choice(product_ids)

                contract = {
                    "name": f"Contract-{contract_date.strftime('%Y%m')}-{i+1:02d}",
                    "partner_id": partner_id,
                    "date_start": contract_date.strftime("%Y-%m-%d"),
                    "date_end": (contract_date + timedelta(days=365)).strftime(
                        "%Y-%m-%d"
                    ),
                    "recurring_rule_type": "monthly",
                    "recurring_interval": 1,
                    "recurring_next_date": contract_date.strftime("%Y-%m-%d"),
                    "state": "open",
                    "recurring_invoice_line_ids": [
                        (
                            0,
                            0,
                            {
                                "product_id": product_id,
                                "name": f"Monthly service for {contract_date.strftime('%B %Y')}",
                                "quantity": 1,
                                "price_unit": random.uniform(100, 500),
                            },
                        )
                    ],
                }
                contracts.append(contract)

        created_contracts = []
        for contract in contracts:
            try:
                contract_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "sale.subscription",
                    "create",
                    [contract],
                )
                created_contracts.append(contract_id)
                print(f"  ✅ Created contract: {contract['name']} (ID: {contract_id})")
            except Exception as e:
                print(
                    f"  ⚠️  Skipped contract (Subscription module may not be available): {contract['name']}"
                )

        return created_contracts

    def create_open_invoices(self, partner_ids, product_ids):
        """Create sample open invoices"""
        print("\n🧾 Creating open invoices...")

        if not partner_ids or not product_ids:
            print("  ⚠️  No partners or products available for invoices")
            return []

        # Create invoices for the last 3 months
        invoices = []
        base_date = datetime.now() - timedelta(days=90)

        for month in range(3):
            invoice_date = base_date + timedelta(days=30 * month)

            for i in range(random.randint(3, 6)):  # 3-6 invoices per month
                partner_id = random.choice(partner_ids)
                product_id = random.choice(product_ids)

                invoice = {
                    "partner_id": partner_id,
                    "invoice_date": invoice_date.strftime("%Y-%m-%d"),
                    "invoice_date_due": (invoice_date + timedelta(days=30)).strftime(
                        "%Y-%m-%d"
                    ),
                    "state": "posted",
                    "move_type": "out_invoice",
                    "invoice_line_ids": [
                        (
                            0,
                            0,
                            {
                                "product_id": product_id,
                                "name": f"Service for {invoice_date.strftime('%B %Y')}",
                                "quantity": random.randint(1, 5),
                                "price_unit": random.uniform(100, 1000),
                            },
                        )
                    ],
                }
                invoices.append(invoice)

        created_invoices = []
        for invoice in invoices:
            try:
                invoice_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.move",
                    "create",
                    [invoice],
                )
                # Post the invoice
                self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.move",
                    "action_post",
                    [invoice_id],
                )
                created_invoices.append(invoice_id)
                print(f"  ✅ Created invoice: {invoice_id}")
            except Exception as e:
                print(f"  ⚠️  Skipped invoice (Accounting module may not be available)")

        return created_invoices

    def create_open_payments(self, partner_ids):
        """Create sample open payments"""
        print("\n💰 Creating open payments...")

        if not partner_ids:
            print("  ⚠️  No partners available for payments")
            return []

        # Create payments for the last 2 months
        payments = []
        base_date = datetime.now() - timedelta(days=60)

        for month in range(2):
            payment_date = base_date + timedelta(days=30 * month)

            for i in range(random.randint(2, 4)):  # 2-4 payments per month
                partner_id = random.choice(partner_ids)

                payment = {
                    "partner_id": partner_id,
                    "payment_date": payment_date.strftime("%Y-%m-%d"),
                    "amount": random.uniform(500, 2000),
                    "payment_type": "inbound",
                    "partner_type": "customer",
                    "state": "draft",
                    "journal_id": 1,  # Assuming journal ID 1 exists
                }
                payments.append(payment)

        created_payments = []
        for payment in payments:
            try:
                payment_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.payment",
                    "create",
                    [payment],
                )
                created_payments.append(payment_id)
                print(f"  ✅ Created payment: {payment_id}")
            except Exception as e:
                print(f"  ⚠️  Skipped payment (Accounting module may not be available)")

        return created_payments

    def add_all_financial_data(self):
        """Add all financial data to Odoo"""
        print("💰 Adding Financial Data to Odoo")
        print("=" * 40)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Get or create partners and products
        partner_ids = self.get_or_create_partners()
        product_ids = self.get_or_create_products()

        # Create financial data
        contract_ids = self.create_selling_contracts(partner_ids, product_ids)
        invoice_ids = self.create_open_invoices(partner_ids, product_ids)
        payment_ids = self.create_open_payments(partner_ids)

        print("\n✅ Financial data addition completed!")
        print("\n📊 Summary:")
        print(f"  - {len(partner_ids)} Partners available")
        print(f"  - {len(product_ids)} Products available")
        print(f"  - {len(contract_ids)} Selling contracts created")
        print(f"  - {len(invoice_ids)} Open invoices created")
        print(f"  - {len(payment_ids)} Open payments created")

        return {
            "partners": partner_ids,
            "products": product_ids,
            "contracts": contract_ids,
            "invoices": invoice_ids,
            "payments": payment_ids,
        }


def main():
    """Main function"""
    print("🎯 Odoo Financial Data Generator")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize data manager
    manager = OdooFinancialDataManager()

    # Add financial data
    results = manager.add_all_financial_data()

    if results:
        print("\n🔧 Next Steps:")
        print("1. Check your Odoo instance to see the new financial data")
        print("2. Use the MCP tools to query contracts, invoices, and payments")
        print("3. Test financial reporting and analytics")
        print(f"\n📋 Created Record IDs:")
        print(f"  Partners: {results['partners']}")
        print(f"  Products: {results['products']}")
        print(f"  Contracts: {results['contracts']}")
        print(f"  Invoices: {results['invoices']}")
        print(f"  Payments: {results['payments']}")


if __name__ == "__main__":
    main()
