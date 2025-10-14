#!/usr/bin/env python3
"""
Check Journal Entries in Odoo
This script checks for journal entries and accounting moves
"""

import json
import xmlrpc.client
import os
from pathlib import Path


class OdooJournalEntriesChecker:
    """Odoo journal entries checker"""

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

    def check_journal_entries(self):
        """Check for journal entries"""
        print("\n📝 Checking journal entries...")

        try:
            # Try to get journal entries
            entries = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "search_read",
                [],
                {
                    "fields": ["id", "name", "ref", "date", "move_type", "state"],
                    "limit": 20,
                },
            )

            if entries:
                print(f"  Found {len(entries)} journal entries:")
                for entry in entries:
                    print(f"    ID {entry['id']}: {entry.get('name', 'N/A')}")
                    print(f"      Reference: {entry.get('ref', 'N/A')}")
                    print(f"      Date: {entry.get('date', 'N/A')}")
                    print(f"      Type: {entry.get('move_type', 'N/A')}")
                    print(f"      State: {entry.get('state', 'N/A')}")
                    print()
            else:
                print("  No journal entries found")

            return entries

        except Exception as e:
            print(f"  ⚠️  Journal entries not available: {e}")
            return []

    def check_accounting_moves(self):
        """Check for accounting moves"""
        print("\n💰 Checking accounting moves...")

        try:
            # Try different approaches to get accounting data
            moves = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "search_read",
                [],
                {
                    "fields": ["id", "name", "ref", "date", "move_type", "state"],
                    "limit": 10,
                },
            )

            if moves:
                print(f"  Found {len(moves)} accounting moves:")
                for move in moves:
                    print(f"    ID {move['id']}: {move.get('name', 'N/A')}")
                    print(f"      Reference: {move.get('ref', 'N/A')}")
                    print(f"      Date: {move.get('date', 'N/A')}")
                    print(f"      Type: {move.get('move_type', 'N/A')}")
                    print(f"      State: {move.get('state', 'N/A')}")
                    print()
            else:
                print("  No accounting moves found")

            return moves

        except Exception as e:
            print(f"  ⚠️  Accounting moves not available: {e}")
            return []

    def check_recent_entries(self):
        """Check for recent entries"""
        print("\n🕒 Checking recent entries...")

        try:
            # Try to get recent entries from the last 30 days
            from datetime import datetime, timedelta

            recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

            entries = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "search_read",
                [("date", ">=", recent_date)],
                {
                    "fields": ["id", "name", "ref", "date", "move_type", "state"],
                    "limit": 10,
                },
            )

            if entries:
                print(f"  Found {len(entries)} recent entries:")
                for entry in entries:
                    print(f"    ID {entry['id']}: {entry.get('name', 'N/A')}")
                    print(f"      Reference: {entry.get('ref', 'N/A')}")
                    print(f"      Date: {entry.get('date', 'N/A')}")
                    print(f"      Type: {entry.get('move_type', 'N/A')}")
                    print(f"      State: {entry.get('state', 'N/A')}")
                    print()
            else:
                print("  No recent entries found")

            return entries

        except Exception as e:
            print(f"  ⚠️  Recent entries not available: {e}")
            return []

    def check_all_entries(self):
        """Check all accounting entries"""
        print("🔍 Checking Accounting Entries in Odoo")
        print("=" * 50)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Check different types of entries
        journal_entries = self.check_journal_entries()
        accounting_moves = self.check_accounting_moves()
        recent_entries = self.check_recent_entries()

        print("\n📊 Summary:")
        print(f"  - {len(journal_entries)} Journal entries")
        print(f"  - {len(accounting_moves)} Accounting moves")
        print(f"  - {len(recent_entries)} Recent entries")

        if journal_entries or accounting_moves or recent_entries:
            print("\n✅ Found accounting data!")
            print("🔧 Next Steps:")
            print("1. Check your Odoo accounting entries page")
            print("2. Review the entries in your Odoo interface")
            print("3. Use the MCP tools to query specific entries")
        else:
            print("\n⚠️  No accounting entries found")
            print("This might be because:")
            print("1. The Accounting module is not enabled")
            print("2. No entries have been created yet")
            print("3. The entries are in a different module")

        return {
            "journal_entries": journal_entries,
            "accounting_moves": accounting_moves,
            "recent_entries": recent_entries,
        }


def main():
    """Main function"""
    print("🎯 Odoo Journal Entries Checker")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize checker
    checker = OdooJournalEntriesChecker()

    # Check all entries
    results = checker.check_all_entries()

    if results:
        print(f"\n📋 Found Entries:")
        print(f"  Journal Entries: {len(results['journal_entries'])}")
        print(f"  Accounting Moves: {len(results['accounting_moves'])}")
        print(f"  Recent Entries: {len(results['recent_entries'])}")


if __name__ == "__main__":
    main()
