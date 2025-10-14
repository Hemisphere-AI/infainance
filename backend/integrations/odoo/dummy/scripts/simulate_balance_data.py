#!/usr/bin/env python3
"""
Simulate Balance Data for Odoo
This script creates simulated financial balance data including transactions, balances, and reports
"""

import json
import xmlrpc.client
import os
from pathlib import Path
from datetime import datetime, timedelta
import random


class OdooBalanceSimulator:
    """Odoo balance data simulator"""

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

    def get_existing_data(self):
        """Get existing partners and products"""
        print("\n📊 Getting existing data...")

        # Get partners
        try:
            partners = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.partner",
                "search_read",
                [],
                {"fields": ["id", "name"], "limit": 10},
            )
            print(f"  Found {len(partners)} partners")
        except:
            partners = []

        # Get products
        try:
            products = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "product.product",
                "search_read",
                [],
                {"fields": ["id", "name", "list_price"], "limit": 10},
            )
            print(f"  Found {len(products)} products")
        except:
            products = []

        return partners, products

    def create_financial_transactions(self, partners, products):
        """Create simulated financial transactions"""
        print("\n💰 Creating financial transactions...")

        if not partners or not products:
            print("  ⚠️  No partners or products available")
            return []

        # Generate transactions for the last 12 months
        transactions = []
        base_date = datetime.now() - timedelta(days=365)

        for month in range(12):
            month_date = base_date + timedelta(days=30 * month)

            # Create 5-15 transactions per month
            for i in range(random.randint(5, 15)):
                partner = random.choice(partners)
                product = random.choice(products)

                # Random transaction type
                transaction_type = random.choice(
                    ["sale", "purchase", "payment", "refund"]
                )

                # Generate transaction data
                transaction = {
                    "date": month_date.strftime("%Y-%m-%d"),
                    "partner_id": partner["id"],
                    "product_id": product["id"],
                    "type": transaction_type,
                    "amount": random.uniform(100, 5000),
                    "description": f"{transaction_type.title()} transaction for {partner['name']}",
                    "reference": f"TXN-{month_date.strftime('%Y%m')}-{i+1:03d}",
                    "status": random.choice(["completed", "pending", "cancelled"]),
                }
                transactions.append(transaction)

        print(f"  Generated {len(transactions)} financial transactions")
        return transactions

    def create_account_balances(self):
        """Create simulated account balances"""
        print("\n🏦 Creating account balances...")

        # Simulate different account types
        account_types = [
            {"name": "Cash", "type": "asset", "balance": random.uniform(50000, 150000)},
            {
                "name": "Bank Account",
                "type": "asset",
                "balance": random.uniform(100000, 500000),
            },
            {
                "name": "Accounts Receivable",
                "type": "asset",
                "balance": random.uniform(25000, 100000),
            },
            {
                "name": "Inventory",
                "type": "asset",
                "balance": random.uniform(15000, 75000),
            },
            {
                "name": "Accounts Payable",
                "type": "liability",
                "balance": random.uniform(20000, 80000),
            },
            {
                "name": "Sales Revenue",
                "type": "income",
                "balance": random.uniform(200000, 800000),
            },
            {
                "name": "Cost of Goods Sold",
                "type": "expense",
                "balance": random.uniform(100000, 400000),
            },
            {
                "name": "Operating Expenses",
                "type": "expense",
                "balance": random.uniform(50000, 200000),
            },
        ]

        balances = []
        for account in account_types:
            balance = {
                "account_name": account["name"],
                "account_type": account["type"],
                "balance": account["balance"],
                "currency": "USD",
                "last_updated": datetime.now().strftime("%Y-%m-%d"),
            }
            balances.append(balance)

        print(f"  Created {len(balances)} account balances")
        return balances

    def create_monthly_reports(self):
        """Create simulated monthly financial reports"""
        print("\n📈 Creating monthly reports...")

        reports = []
        base_date = datetime.now() - timedelta(days=365)

        for month in range(12):
            report_date = base_date + timedelta(days=30 * month)

            # Generate monthly financial data
            revenue = random.uniform(50000, 200000)
            expenses = random.uniform(30000, 150000)
            profit = revenue - expenses

            report = {
                "month": report_date.strftime("%Y-%m"),
                "revenue": revenue,
                "expenses": expenses,
                "profit": profit,
                "profit_margin": (profit / revenue * 100) if revenue > 0 else 0,
                "cash_flow": random.uniform(-10000, 50000),
                "customer_count": random.randint(50, 200),
                "transaction_count": random.randint(100, 500),
            }
            reports.append(report)

        print(f"  Generated {len(reports)} monthly reports")
        return reports

    def create_customer_balances(self, partners):
        """Create customer account balances"""
        print("\n👥 Creating customer balances...")

        if not partners:
            print("  ⚠️  No partners available")
            return []

        customer_balances = []
        for partner in partners:
            # Generate random balance for each customer
            balance = {
                "customer_id": partner["id"],
                "customer_name": partner["name"],
                "outstanding_balance": random.uniform(0, 10000),
                "credit_limit": random.uniform(5000, 50000),
                "payment_terms": random.choice(["Net 30", "Net 15", "Due on Receipt"]),
                "last_payment_date": (
                    datetime.now() - timedelta(days=random.randint(1, 90))
                ).strftime("%Y-%m-%d"),
                "status": random.choice(["active", "overdue", "suspended"]),
            }
            customer_balances.append(balance)

        print(f"  Created {len(customer_balances)} customer balances")
        return customer_balances

    def create_inventory_balances(self, products):
        """Create inventory balances"""
        print("\n📦 Creating inventory balances...")

        if not products:
            print("  ⚠️  No products available")
            return []

        inventory_balances = []
        for product in products:
            # Generate inventory data for each product
            balance = {
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity_on_hand": random.randint(0, 1000),
                "quantity_reserved": random.randint(0, 100),
                "quantity_available": random.randint(0, 900),
                "unit_cost": random.uniform(10, 500),
                "total_value": random.uniform(1000, 50000),
                "last_updated": datetime.now().strftime("%Y-%m-%d"),
            }
            inventory_balances.append(balance)

        print(f"  Created {len(inventory_balances)} inventory balances")
        return inventory_balances

    def generate_balance_summary(
        self, transactions, balances, reports, customer_balances, inventory_balances
    ):
        """Generate a comprehensive balance summary"""
        print("\n📊 Generating Balance Summary...")

        # Calculate totals
        total_assets = sum(
            b["balance"] for b in balances if b["account_type"] == "asset"
        )
        total_liabilities = sum(
            b["balance"] for b in balances if b["account_type"] == "liability"
        )
        total_income = sum(
            b["balance"] for b in balances if b["account_type"] == "income"
        )
        total_expenses = sum(
            b["balance"] for b in balances if b["account_type"] == "expense"
        )

        # Calculate customer totals
        total_outstanding = sum(cb["outstanding_balance"] for cb in customer_balances)
        total_credit_limit = sum(cb["credit_limit"] for cb in customer_balances)

        # Calculate inventory totals
        total_inventory_value = sum(ib["total_value"] for ib in inventory_balances)

        # Calculate monthly averages
        avg_revenue = (
            sum(r["revenue"] for r in reports) / len(reports) if reports else 0
        )
        avg_expenses = (
            sum(r["expenses"] for r in reports) / len(reports) if reports else 0
        )
        avg_profit = sum(r["profit"] for r in reports) / len(reports) if reports else 0

        summary = {
            "generated_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "financial_position": {
                "total_assets": total_assets,
                "total_liabilities": total_liabilities,
                "net_worth": total_assets - total_liabilities,
            },
            "income_statement": {
                "total_income": total_income,
                "total_expenses": total_expenses,
                "net_income": total_income - total_expenses,
            },
            "customer_summary": {
                "total_customers": len(customer_balances),
                "total_outstanding": total_outstanding,
                "total_credit_limit": total_credit_limit,
                "credit_utilization": (
                    (total_outstanding / total_credit_limit * 100)
                    if total_credit_limit > 0
                    else 0
                ),
            },
            "inventory_summary": {
                "total_products": len(inventory_balances),
                "total_inventory_value": total_inventory_value,
                "average_product_value": (
                    total_inventory_value / len(inventory_balances)
                    if inventory_balances
                    else 0
                ),
            },
            "monthly_averages": {
                "avg_revenue": avg_revenue,
                "avg_expenses": avg_expenses,
                "avg_profit": avg_profit,
                "avg_profit_margin": (
                    (avg_profit / avg_revenue * 100) if avg_revenue > 0 else 0
                ),
            },
            "transaction_summary": {
                "total_transactions": len(transactions),
                "completed_transactions": len(
                    [t for t in transactions if t["status"] == "completed"]
                ),
                "pending_transactions": len(
                    [t for t in transactions if t["status"] == "pending"]
                ),
            },
        }

        return summary

    def simulate_all_balance_data(self):
        """Simulate all balance data"""
        print("💰 Simulating Balance Data for Odoo")
        print("=" * 50)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Get existing data
        partners, products = self.get_existing_data()

        # Create simulated data
        transactions = self.create_financial_transactions(partners, products)
        balances = self.create_account_balances()
        reports = self.create_monthly_reports()
        customer_balances = self.create_customer_balances(partners)
        inventory_balances = self.create_inventory_balances(products)

        # Generate summary
        summary = self.generate_balance_summary(
            transactions, balances, reports, customer_balances, inventory_balances
        )

        # Display summary
        print("\n" + "=" * 50)
        print("📊 BALANCE DATA SUMMARY")
        print("=" * 50)

        print(f"\n💰 Financial Position:")
        print(f"  Total Assets: ${summary['financial_position']['total_assets']:,.2f}")
        print(
            f"  Total Liabilities: ${summary['financial_position']['total_liabilities']:,.2f}"
        )
        print(f"  Net Worth: ${summary['financial_position']['net_worth']:,.2f}")

        print(f"\n📈 Income Statement:")
        print(f"  Total Income: ${summary['income_statement']['total_income']:,.2f}")
        print(
            f"  Total Expenses: ${summary['income_statement']['total_expenses']:,.2f}"
        )
        print(f"  Net Income: ${summary['income_statement']['net_income']:,.2f}")

        print(f"\n👥 Customer Summary:")
        print(f"  Total Customers: {summary['customer_summary']['total_customers']}")
        print(
            f"  Outstanding Receivables: ${summary['customer_summary']['total_outstanding']:,.2f}"
        )
        print(
            f"  Credit Utilization: {summary['customer_summary']['credit_utilization']:.1f}%"
        )

        print(f"\n📦 Inventory Summary:")
        print(f"  Total Products: {summary['inventory_summary']['total_products']}")
        print(
            f"  Total Inventory Value: ${summary['inventory_summary']['total_inventory_value']:,.2f}"
        )

        print(f"\n📊 Monthly Averages:")
        print(f"  Average Revenue: ${summary['monthly_averages']['avg_revenue']:,.2f}")
        print(
            f"  Average Expenses: ${summary['monthly_averages']['avg_expenses']:,.2f}"
        )
        print(f"  Average Profit: ${summary['monthly_averages']['avg_profit']:,.2f}")
        print(
            f"  Average Profit Margin: {summary['monthly_averages']['avg_profit_margin']:.1f}%"
        )

        print(f"\n💳 Transaction Summary:")
        print(
            f"  Total Transactions: {summary['transaction_summary']['total_transactions']}"
        )
        print(
            f"  Completed: {summary['transaction_summary']['completed_transactions']}"
        )
        print(f"  Pending: {summary['transaction_summary']['pending_transactions']}")

        # Save data to files
        self.save_simulated_data(
            transactions,
            balances,
            reports,
            customer_balances,
            inventory_balances,
            summary,
        )

        print("\n✅ Balance data simulation completed!")
        print("\n🔧 Next Steps:")
        print("1. Check the generated data files in your project directory")
        print("2. Use this data for financial analysis and reporting")
        print("3. Integrate with your Odoo MCP tools for real-time queries")

        return {
            "transactions": transactions,
            "balances": balances,
            "reports": reports,
            "customer_balances": customer_balances,
            "inventory_balances": inventory_balances,
            "summary": summary,
        }

    def save_simulated_data(
        self,
        transactions,
        balances,
        reports,
        customer_balances,
        inventory_balances,
        summary,
    ):
        """Save simulated data to JSON files"""
        print("\n💾 Saving simulated data to files...")

        # Save transactions
        with open("simulated_transactions.json", "w") as f:
            json.dump(transactions, f, indent=2)
        print("  ✅ Saved transactions to simulated_transactions.json")

        # Save balances
        with open("simulated_balances.json", "w") as f:
            json.dump(balances, f, indent=2)
        print("  ✅ Saved balances to simulated_balances.json")

        # Save reports
        with open("simulated_reports.json", "w") as f:
            json.dump(reports, f, indent=2)
        print("  ✅ Saved reports to simulated_reports.json")

        # Save customer balances
        with open("simulated_customer_balances.json", "w") as f:
            json.dump(customer_balances, f, indent=2)
        print("  ✅ Saved customer balances to simulated_customer_balances.json")

        # Save inventory balances
        with open("simulated_inventory_balances.json", "w") as f:
            json.dump(inventory_balances, f, indent=2)
        print("  ✅ Saved inventory balances to simulated_inventory_balances.json")

        # Save summary
        with open("simulated_summary.json", "w") as f:
            json.dump(summary, f, indent=2)
        print("  ✅ Saved summary to simulated_summary.json")


def main():
    """Main function"""
    print("🎯 Odoo Balance Data Simulator")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize simulator
    simulator = OdooBalanceSimulator()

    # Simulate balance data
    results = simulator.simulate_all_balance_data()

    if results:
        print(f"\n📋 Generated Data Files:")
        print(f"  - simulated_transactions.json")
        print(f"  - simulated_balances.json")
        print(f"  - simulated_reports.json")
        print(f"  - simulated_customer_balances.json")
        print(f"  - simulated_inventory_balances.json")
        print(f"  - simulated_summary.json")


if __name__ == "__main__":
    main()
