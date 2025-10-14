#!/usr/bin/env python3
"""
Add Basic Financial Data to Odoo
This script adds sample financial data using basic Odoo modules
"""

import json
import xmlrpc.client
import os
from pathlib import Path
from datetime import datetime, timedelta
import random


class BasicOdooFinancialManager:
    """Basic Odoo financial data manager"""

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

    def create_more_partners(self):
        """Create additional partners for financial data"""
        print("\n👥 Creating additional partners...")

        partners = [
            {
                "name": "ABC Corporation",
                "is_company": True,
                "email": "sales@abc.com",
                "phone": "+1-555-1001",
            },
            {
                "name": "XYZ Ltd",
                "is_company": True,
                "email": "info@xyz.com",
                "phone": "+1-555-1002",
            },
            {
                "name": "Tech Solutions Inc",
                "is_company": True,
                "email": "contact@techsolutions.com",
                "phone": "+1-555-1003",
            },
            {
                "name": "Global Services",
                "is_company": True,
                "email": "hello@globalservices.com",
                "phone": "+1-555-1004",
            },
            {
                "name": "Innovation Co",
                "is_company": True,
                "email": "team@innovation.com",
                "phone": "+1-555-1005",
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

    def create_more_products(self):
        """Create additional products for financial data"""
        print("\n📦 Creating additional products...")

        products = [
            {
                "name": "Premium Software License",
                "type": "service",
                "list_price": 299.99,
                "description": "Premium software license with full features",
            },
            {
                "name": "Basic Software License",
                "type": "service",
                "list_price": 99.99,
                "description": "Basic software license with core features",
            },
            {
                "name": "Technical Support",
                "type": "service",
                "list_price": 150.00,
                "description": "Monthly technical support service",
            },
            {
                "name": "Training Session",
                "type": "service",
                "list_price": 500.00,
                "description": "One-day training session",
            },
            {
                "name": "Consulting Hours",
                "type": "service",
                "list_price": 200.00,
                "description": "Professional consulting service",
            },
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

    def create_quotes_and_orders(self, partner_ids, product_ids):
        """Create sample quotes and orders (simulating contracts)"""
        print("\n📋 Creating quotes and orders (simulating contracts)...")

        if not partner_ids or not product_ids:
            print("  ⚠️  No partners or products available")
            return []

        # Create quotes for the last 6 months
        quotes = []
        base_date = datetime.now() - timedelta(days=180)

        for month in range(6):
            quote_date = base_date + timedelta(days=30 * month)

            for i in range(random.randint(2, 4)):  # 2-4 quotes per month
                partner_id = random.choice(partner_ids)
                product_id = random.choice(product_ids)

                quote = {
                    "partner_id": partner_id,
                    "date_order": quote_date.strftime("%Y-%m-%d"),
                    "validity_date": (quote_date + timedelta(days=30)).strftime(
                        "%Y-%m-%d"
                    ),
                    "state": "sent" if random.choice([True, False]) else "draft",
                    "order_line": [
                        (
                            0,
                            0,
                            {
                                "product_id": product_id,
                                "name": f"Service for {quote_date.strftime('%B %Y')}",
                                "product_uom_qty": random.randint(1, 5),
                                "price_unit": random.uniform(100, 1000),
                            },
                        )
                    ],
                }
                quotes.append(quote)

        created_quotes = []
        for quote in quotes:
            try:
                quote_id = self.models.execute_kw(
                    self.db, self.uid, self.password, "sale.order", "create", [quote]
                )
                created_quotes.append(quote_id)
                print(f"  ✅ Created quote/order: {quote_id}")
            except Exception as e:
                print(f"  ⚠️  Skipped quote (Sales module may not be available)")

        return created_quotes

    def create_opportunities(self, partner_ids, product_ids):
        """Create sample opportunities (simulating sales pipeline)"""
        print("\n🎯 Creating opportunities...")

        if not partner_ids or not product_ids:
            print("  ⚠️  No partners or products available")
            return []

        # Create opportunities for the last 3 months
        opportunities = []
        base_date = datetime.now() - timedelta(days=90)

        for month in range(3):
            opp_date = base_date + timedelta(days=30 * month)

            for i in range(random.randint(3, 6)):  # 3-6 opportunities per month
                partner_id = random.choice(partner_ids)
                product_id = random.choice(product_ids)

                opportunity = {
                    "name": f"Opportunity {opp_date.strftime('%Y%m')}-{i+1:02d}",
                    "partner_id": partner_id,
                    "date_deadline": (opp_date + timedelta(days=30)).strftime(
                        "%Y-%m-%d"
                    ),
                    "expected_revenue": random.uniform(1000, 5000),
                    "probability": random.randint(10, 90),
                    "stage_id": random.randint(1, 5),  # Assuming 5 stages
                    "user_id": self.uid,
                }
                opportunities.append(opportunity)

        created_opportunities = []
        for opportunity in opportunities:
            try:
                opp_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "crm.lead",
                    "create",
                    [opportunity],
                )
                created_opportunities.append(opp_id)
                print(f"  ✅ Created opportunity: {opportunity['name']} (ID: {opp_id})")
            except Exception as e:
                print(f"  ⚠️  Skipped opportunity (CRM module may not be available)")

        return created_opportunities

    def create_tasks_and_projects(self, partner_ids):
        """Create sample tasks and projects (simulating work contracts)"""
        print("\n📋 Creating tasks and projects...")

        if not partner_ids:
            print("  ⚠️  No partners available")
            return []

        # Create projects
        projects = []
        for i in range(3):
            project = {
                "name": f"Project {i+1}: Software Implementation",
                "partner_id": random.choice(partner_ids),
                "date_start": (datetime.now() - timedelta(days=30 * i)).strftime(
                    "%Y-%m-%d"
                ),
                "date": (datetime.now() + timedelta(days=30 * (i + 1))).strftime(
                    "%Y-%m-%d"
                ),
                "user_id": self.uid,
            }
            projects.append(project)

        created_projects = []
        for project in projects:
            try:
                project_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "project.project",
                    "create",
                    [project],
                )
                created_projects.append(project_id)
                print(f"  ✅ Created project: {project['name']} (ID: {project_id})")

                # Create tasks for each project
                for j in range(random.randint(3, 5)):
                    task = {
                        "name": f"Task {j+1} for {project['name']}",
                        "project_id": project_id,
                        "user_id": self.uid,
                        "date_deadline": (
                            datetime.now() + timedelta(days=7 * j)
                        ).strftime("%Y-%m-%d"),
                        "priority": random.choice(["0", "1", "2"]),  # Low, Normal, High
                    }
                    try:
                        task_id = self.models.execute_kw(
                            self.db,
                            self.uid,
                            self.password,
                            "project.task",
                            "create",
                            [task],
                        )
                        print(f"    ✅ Created task: {task['name']} (ID: {task_id})")
                    except:
                        print(
                            f"    ⚠️  Skipped task (Project module may not be available)"
                        )

            except Exception as e:
                print(f"  ⚠️  Skipped project (Project module may not be available)")

        return created_projects

    def add_all_basic_financial_data(self):
        """Add all basic financial data to Odoo"""
        print("💰 Adding Basic Financial Data to Odoo")
        print("=" * 40)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Get existing partners and products
        try:
            existing_partners = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.partner",
                "search_read",
                [[("is_company", "=", True)]],
                {"limit": 10},
            )
            partner_ids = [p["id"] for p in existing_partners]
            print(f"\n👥 Found {len(partner_ids)} existing partners")
        except:
            partner_ids = []

        try:
            existing_products = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "product.product",
                "search_read",
                [],
                {"limit": 10},
            )
            product_ids = [p["id"] for p in existing_products]
            print(f"📦 Found {len(product_ids)} existing products")
        except:
            product_ids = []

        # Create additional data
        new_partners = self.create_more_partners()
        new_products = self.create_more_products()

        # Combine existing and new
        all_partner_ids = partner_ids + new_partners
        all_product_ids = product_ids + new_products

        # Create financial data
        quote_ids = self.create_quotes_and_orders(all_partner_ids, all_product_ids)
        opportunity_ids = self.create_opportunities(all_partner_ids, all_product_ids)
        project_ids = self.create_tasks_and_projects(all_partner_ids)

        print("\n✅ Basic financial data addition completed!")
        print("\n📊 Summary:")
        print(f"  - {len(all_partner_ids)} Total partners")
        print(f"  - {len(all_product_ids)} Total products")
        print(f"  - {len(quote_ids)} Quotes/Orders created")
        print(f"  - {len(opportunity_ids)} Opportunities created")
        print(f"  - {len(project_ids)} Projects created")

        return {
            "partners": all_partner_ids,
            "products": all_product_ids,
            "quotes": quote_ids,
            "opportunities": opportunity_ids,
            "projects": project_ids,
        }


def main():
    """Main function"""
    print("🎯 Odoo Basic Financial Data Generator")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize data manager
    manager = BasicOdooFinancialManager()

    # Add financial data
    results = manager.add_all_basic_financial_data()

    if results:
        print("\n🔧 Next Steps:")
        print("1. Check your Odoo instance to see the new data")
        print("2. Use the MCP tools to query the data")
        print("3. Test sales pipeline and project management")
        print(f"\n📋 Created Record IDs:")
        print(f"  Partners: {results['partners']}")
        print(f"  Products: {results['products']}")
        print(f"  Quotes: {results['quotes']}")
        print(f"  Opportunities: {results['opportunities']}")
        print(f"  Projects: {results['projects']}")


if __name__ == "__main__":
    main()
