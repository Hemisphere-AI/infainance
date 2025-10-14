#!/usr/bin/env python3
"""
Create Accounting Entries in Odoo
This script creates sample accounting entries and journal entries
"""

import json
import xmlrpc.client
import os
from pathlib import Path
from datetime import datetime, timedelta
import random


class OdooAccountingEntriesCreator:
    """Odoo accounting entries creator"""

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

    def create_chart_of_accounts(self):
        """Create basic chart of accounts"""
        print("\n📊 Creating chart of accounts...")

        accounts = [
            {
                "name": "Assets",
                "code": "1000",
                "account_type": "asset_receivable",
                "parent_id": False,
            },
            {
                "name": "Current Assets",
                "code": "1100",
                "account_type": "asset_receivable",
                "parent_id": False,
            },
            {
                "name": "Cash",
                "code": "1110",
                "account_type": "asset_cash",
                "parent_id": False,
            },
            {
                "name": "Bank",
                "code": "1120",
                "account_type": "asset_cash",
                "parent_id": False,
            },
            {
                "name": "Accounts Receivable",
                "code": "1200",
                "account_type": "asset_receivable",
                "parent_id": False,
            },
            {
                "name": "Inventory",
                "code": "1300",
                "account_type": "asset_current",
                "parent_id": False,
            },
            {
                "name": "Fixed Assets",
                "code": "1500",
                "account_type": "asset_fixed",
                "parent_id": False,
            },
            {
                "name": "Liabilities",
                "code": "2000",
                "account_type": "liability_payable",
                "parent_id": False,
            },
            {
                "name": "Accounts Payable",
                "code": "2100",
                "account_type": "liability_payable",
                "parent_id": False,
            },
            {
                "name": "Equity",
                "code": "3000",
                "account_type": "equity",
                "parent_id": False,
            },
            {
                "name": "Revenue",
                "code": "4000",
                "account_type": "income",
                "parent_id": False,
            },
            {
                "name": "Sales Revenue",
                "code": "4100",
                "account_type": "income",
                "parent_id": False,
            },
            {
                "name": "Expenses",
                "code": "5000",
                "account_type": "expense",
                "parent_id": False,
            },
            {
                "name": "Cost of Goods Sold",
                "code": "5100",
                "account_type": "expense",
                "parent_id": False,
            },
            {
                "name": "Operating Expenses",
                "code": "5200",
                "account_type": "expense",
                "parent_id": False,
            },
        ]

        account_ids = []
        for account in accounts:
            try:
                account_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.account",
                    "create",
                    [account],
                )
                account_ids.append(account_id)
                print(
                    f"  ✅ Created account: {account['name']} (Code: {account['code']})"
                )
            except Exception as e:
                print(
                    f"  ⚠️  Skipped account (Accounting module may not be available): {account['name']}"
                )

        return account_ids

    def create_journal_entries(self, account_ids):
        """Create sample journal entries"""
        print("\n📝 Creating journal entries...")

        if not account_ids:
            print("  ⚠️  No accounts available for journal entries")
            return []

        # Get some account IDs for different types
        cash_account = account_ids[2] if len(account_ids) > 2 else account_ids[0]
        bank_account = account_ids[3] if len(account_ids) > 3 else account_ids[0]
        revenue_account = account_ids[10] if len(account_ids) > 10 else account_ids[0]
        expense_account = account_ids[12] if len(account_ids) > 12 else account_ids[0]

        journal_entries = []

        # Create sample journal entries for the last 3 months
        base_date = datetime.now() - timedelta(days=90)

        for month in range(3):
            entry_date = base_date + timedelta(days=30 * month)

            # Entry 1: Sales Revenue
            entry1 = {
                "date": entry_date.strftime("%Y-%m-%d"),
                "ref": f"INV-{entry_date.strftime('%Y%m')}-001",
                "move_type": "entry",
                "line_ids": [
                    (
                        0,
                        0,
                        {
                            "account_id": cash_account,
                            "debit": 5000.00,
                            "credit": 0.00,
                            "name": f"Cash received from sales - {entry_date.strftime('%B %Y')}",
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "account_id": revenue_account,
                            "debit": 0.00,
                            "credit": 5000.00,
                            "name": f"Sales revenue - {entry_date.strftime('%B %Y')}",
                        },
                    ),
                ],
            }
            journal_entries.append(entry1)

            # Entry 2: Operating Expenses
            entry2 = {
                "date": entry_date.strftime("%Y-%m-%d"),
                "ref": f"EXP-{entry_date.strftime('%Y%m')}-001",
                "move_type": "entry",
                "line_ids": [
                    (
                        0,
                        0,
                        {
                            "account_id": expense_account,
                            "debit": 2000.00,
                            "credit": 0.00,
                            "name": f"Operating expenses - {entry_date.strftime('%B %Y')}",
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "account_id": bank_account,
                            "debit": 0.00,
                            "credit": 2000.00,
                            "name": f"Bank payment for expenses - {entry_date.strftime('%B %Y')}",
                        },
                    ),
                ],
            }
            journal_entries.append(entry2)

            # Entry 3: Asset Purchase
            entry3 = {
                "date": entry_date.strftime("%Y-%m-%d"),
                "ref": f"AST-{entry_date.strftime('%Y%m')}-001",
                "move_type": "entry",
                "line_ids": [
                    (
                        0,
                        0,
                        {
                            "account_id": account_ids[6],  # Fixed Assets
                            "debit": 1500.00,
                            "credit": 0.00,
                            "name": f"Computer equipment purchase - {entry_date.strftime('%B %Y')}",
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "account_id": bank_account,
                            "debit": 0.00,
                            "credit": 1500.00,
                            "name": f"Bank payment for equipment - {entry_date.strftime('%B %Y')}",
                        },
                    ),
                ],
            }
            journal_entries.append(entry3)

        created_entries = []
        for entry in journal_entries:
            try:
                entry_id = self.models.execute_kw(
                    self.db, self.uid, self.password, "account.move", "create", [entry]
                )

                # Post the entry
                self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.move",
                    "action_post",
                    [entry_id],
                )

                created_entries.append(entry_id)
                print(f"  ✅ Created journal entry: {entry['ref']} (ID: {entry_id})")

            except Exception as e:
                print(
                    f"  ⚠️  Skipped journal entry (Accounting module may not be available): {entry['ref']}"
                )

        return created_entries

    def create_invoices(self, account_ids):
        """Create sample invoices"""
        print("\n🧾 Creating sample invoices...")

        if not account_ids:
            print("  ⚠️  No accounts available for invoices")
            return []

        # Get partners
        try:
            partners = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.partner",
                "search_read",
                [],
                {"fields": ["id", "name"], "limit": 5},
            )
        except:
            partners = []

        if not partners:
            print("  ⚠️  No partners available for invoices")
            return []

        # Get products
        try:
            products = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "product.product",
                "search_read",
                [],
                {"fields": ["id", "name", "list_price"], "limit": 5},
            )
        except:
            products = []

        if not products:
            print("  ⚠️  No products available for invoices")
            return []

        invoices = []
        base_date = datetime.now() - timedelta(days=60)

        for i in range(5):
            invoice_date = base_date + timedelta(days=15 * i)
            partner = random.choice(partners)
            product = random.choice(products)

            invoice = {
                "partner_id": partner["id"],
                "invoice_date": invoice_date.strftime("%Y-%m-%d"),
                "invoice_date_due": (invoice_date + timedelta(days=30)).strftime(
                    "%Y-%m-%d"
                ),
                "move_type": "out_invoice",
                "invoice_line_ids": [
                    (
                        0,
                        0,
                        {
                            "product_id": product["id"],
                            "name": f"Service for {partner['name']}",
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

    def create_all_accounting_entries(self):
        """Create all accounting entries"""
        print("💰 Creating Accounting Entries in Odoo")
        print("=" * 50)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Create chart of accounts
        account_ids = self.create_chart_of_accounts()

        # Create journal entries
        journal_entries = self.create_journal_entries(account_ids)

        # Create invoices
        invoices = self.create_invoices(account_ids)

        print("\n✅ Accounting entries creation completed!")
        print("\n📊 Summary:")
        print(f"  - {len(account_ids)} Accounts created")
        print(f"  - {len(journal_entries)} Journal entries created")
        print(f"  - {len(invoices)} Invoices created")

        print("\n🔧 Next Steps:")
        print("1. Check your Odoo accounting entries page")
        print("2. Review the journal entries and invoices")
        print("3. Use the MCP tools to query accounting data")

        return {
            "accounts": account_ids,
            "journal_entries": journal_entries,
            "invoices": invoices,
        }


def main():
    """Main function"""
    print("🎯 Odoo Accounting Entries Creator")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize creator
    creator = OdooAccountingEntriesCreator()

    # Create accounting entries
    results = creator.create_all_accounting_entries()

    if results:
        print(f"\n📋 Created Data:")
        print(f"  Accounts: {results['accounts']}")
        print(f"  Journal Entries: {results['journal_entries']}")
        print(f"  Invoices: {results['invoices']}")


if __name__ == "__main__":
    main()
