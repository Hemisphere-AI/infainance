"""
Add Creditor with Debitsaldo (Debit Balance) Test Data
Creates a specific test case for creditors with debit balances to test the system.
"""

import os
import xmlrpc.client
from pathlib import Path
from datetime import datetime, timedelta


class CreditorDebitsaldoCreator:
    def __init__(self) -> None:
        # Load environment variables from project root .env
        env_file = Path("/Users/thomasschijf/Documents/GitHub/infainance/.env")
        if env_file.exists():
            with open(env_file) as f:
                for line in f:
                    if line.strip() and not line.startswith("#") and "=" in line:
                        key, value = line.strip().split("=", 1)
                        os.environ[key] = value

        self.url = os.getenv("ODOO_URL")
        self.db = os.getenv("ODOO_DB")
        self.username = os.getenv("ODOO_USERNAME", "thomas@hemisphere.ai")
        self.password = os.getenv("ODOO_PASSWORD", os.getenv("ODOO_API_KEY"))

        if not all([self.url, self.db, self.password]):
            raise RuntimeError(
                "Missing Odoo configuration in .env. Required: ODOO_URL, ODOO_DB, ODOO_PASSWORD (or ODOO_API_KEY)"
            )

        self.common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
        self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")
        self.uid = None

    def authenticate(self) -> None:
        self.uid = self.common.authenticate(self.db, self.username, self.password, {})
        if not self.uid:
            raise RuntimeError("Authentication failed")
        print(f"✅ Authenticated successfully with UID: {self.uid}")

    def create_creditor_partner(self) -> int:
        """Create a creditor partner (supplier)"""
        country_id = self._get_country_id("NL")
        creditor_data = {
            "name": "Test Creditor BV",
            "email": "finance@testcreditor.nl",
            "phone": "+31 20 123 4567",
            "is_company": True,
            "supplier_rank": 1,
            "customer_rank": 0,
            "street": "Teststraat 123",
            "city": "Amsterdam",
            "zip": "1000 AB",
            "vat": "NL123456789B01",
            "comment": "Test creditor for debitsaldo testing - Created by script",
        }

        # Only add country_id if we found one
        if country_id:
            creditor_data["country_id"] = country_id

        try:
            partner_id = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.partner",
                "create",
                [creditor_data],
            )
            print(
                f"✅ Created creditor partner: {creditor_data['name']} (ID: {partner_id})"
            )
            return partner_id
        except Exception as e:
            print(f"❌ Could not create creditor partner: {e}")
            return None

    def _get_country_id(self, country_code: str) -> int:
        """Get country ID by code"""
        try:
            countries = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.country",
                "search_read",
                [("code", "=", country_code)],
                {"fields": ["id"], "limit": 1},
            )
            return countries[0]["id"] if countries else None
        except:
            return None

    def create_debitsaldo_invoice(self, creditor_id: int) -> int:
        """Create an invoice that will result in a debit balance for the creditor"""
        try:
            # Create a supplier invoice (creditor invoice)
            invoice_data = {
                "partner_id": creditor_id,
                "move_type": "in_invoice",  # Supplier invoice
                "invoice_date": datetime.now().date().isoformat(),
                "ref": f"INV-TEST-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                "invoice_line_ids": [
                    (
                        0,
                        0,
                        {
                            "name": "Test Service - Debitsaldo Creation",
                            "quantity": 1,
                            "price_unit": 1500.00,  # Amount that will create debit balance
                            "account_id": self._get_expense_account_id(),
                        },
                    ),
                ],
            }

            invoice_id = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "create",
                [invoice_data],
            )

            # Post the invoice to make it official
            self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "action_post",
                [invoice_id],
            )

            print(
                f"✅ Created supplier invoice: {invoice_data['ref']} (ID: {invoice_id}) - Amount: €1,500.00"
            )
            return invoice_id

        except Exception as e:
            print(f"❌ Could not create supplier invoice: {e}")
            return None

    def create_credit_note(self, creditor_id: int) -> int:
        """Create a credit note that will result in a debit balance for the creditor"""
        try:
            # Create a supplier credit note (we owe the creditor money)
            credit_data = {
                "partner_id": creditor_id,
                "move_type": "in_refund",  # Supplier credit note
                "invoice_date": datetime.now().date().isoformat(),
                "ref": f"CREDIT-TEST-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                "invoice_line_ids": [
                    (
                        0,
                        0,
                        {
                            "name": "Test Credit - Debitsaldo Creation",
                            "quantity": 1,
                            "price_unit": 500.00,  # This creates a debit balance
                            "account_id": self._get_expense_account_id(),
                        },
                    ),
                ],
            }

            credit_id = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "create",
                [credit_data],
            )

            # Post the credit note
            self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "action_post",
                [credit_id],
            )

            print(
                f"✅ Created supplier credit note: {credit_data['ref']} (ID: {credit_id}) - Amount: €500.00"
            )
            print(f"   This creates a debit balance for the creditor")
            return credit_id

        except Exception as e:
            print(f"❌ Could not create credit note: {e}")
            return None

    def _get_expense_account_id(self) -> int:
        """Get an expense account ID"""
        try:
            accounts = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.account",
                "search_read",
                [("account_type", "=", "expense")],
                {"fields": ["id", "name", "code"], "limit": 1},
            )
            if accounts:
                print(
                    f"   Using expense account: {accounts[0]['name']} ({accounts[0]['code']})"
                )
                return accounts[0]["id"]
        except:
            pass

        # Fallback: get any account
        try:
            accounts = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.account",
                "search_read",
                [],
                {"fields": ["id", "name", "code"], "limit": 1},
            )
            if accounts:
                print(
                    f"   Using fallback account: {accounts[0]['name']} ({accounts[0]['code']})"
                )
                return accounts[0]["id"]
        except:
            pass

        return None

    def _get_bank_journal_id(self) -> int:
        """Get a bank journal ID"""
        try:
            # Try to find a bank journal first
            journals = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.journal",
                "search_read",
                [("type", "=", "bank")],
                {"fields": ["id", "name"], "limit": 1},
            )
            if journals:
                print(f"   Using bank journal: {journals[0]['name']}")
                return journals[0]["id"]
        except:
            pass

        # Try cash journal as fallback
        try:
            journals = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.journal",
                "search_read",
                [("type", "=", "cash")],
                {"fields": ["id", "name"], "limit": 1},
            )
            if journals:
                print(f"   Using cash journal: {journals[0]['name']}")
                return journals[0]["id"]
        except:
            pass

        # Final fallback: get any journal
        try:
            journals = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.journal",
                "search_read",
                [],
                {"fields": ["id", "name"], "limit": 1},
            )
            if journals:
                print(f"   Using fallback journal: {journals[0]['name']}")
                return journals[0]["id"]
        except:
            pass

        return None

    def verify_debitsaldo(self, creditor_id: int) -> dict:
        """Verify that the creditor has a debit balance"""
        try:
            # Get partner balance information
            partner_data = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "res.partner",
                "read",
                [creditor_id],
                {"fields": ["name", "credit", "debit"]},
            )

            if partner_data:
                partner = partner_data[0]
                credit = partner.get("credit", 0.0)
                debit = partner.get("debit", 0.0)
                balance = debit - credit

                print(f"\n📊 Creditor Balance Analysis:")
                print(f"   Partner: {partner['name']}")
                print(f"   Debit: €{debit:,.2f}")
                print(f"   Credit: €{credit:,.2f}")
                print(f"   Balance: €{balance:,.2f}")

                if balance > 0:
                    print(
                        f"   ✅ SUCCESS: Creditor has a DEBIT balance (debitsaldo) of €{balance:,.2f}"
                    )
                elif balance < 0:
                    print(
                        f"   ⚠️  Creditor has a CREDIT balance of €{abs(balance):,.2f}"
                    )
                else:
                    print(f"   ℹ️  Creditor balance is zero")

                return {
                    "partner_name": partner["name"],
                    "debit": debit,
                    "credit": credit,
                    "balance": balance,
                    "has_debitsaldo": balance > 0,
                }

        except Exception as e:
            print(f"❌ Could not verify balance: {e}")

        return {}

    def run(self) -> dict:
        """Run the creditor debitsaldo creation process"""
        print("🚀 Creating Creditor with Debitsaldo Test Data...")
        print("=" * 60)

        self.authenticate()

        # Step 1: Create creditor partner
        print("\n📝 Step 1: Creating creditor partner...")
        creditor_id = self.create_creditor_partner()
        if not creditor_id:
            return {"success": False, "error": "Failed to create creditor partner"}

        # Step 2: Create supplier invoice
        print("\n📄 Step 2: Creating supplier invoice...")
        invoice_id = self.create_debitsaldo_invoice(creditor_id)
        if not invoice_id:
            return {"success": False, "error": "Failed to create supplier invoice"}

        # Step 3: Create credit note
        print("\n💰 Step 3: Creating credit note...")
        credit_id = self.create_credit_note(creditor_id)
        if not credit_id:
            return {"success": False, "error": "Failed to create credit note"}

        # Step 4: Verify debitsaldo
        print("\n🔍 Step 4: Verifying debitsaldo...")
        balance_info = self.verify_debitsaldo(creditor_id)

        result = {
            "success": True,
            "creditor_id": creditor_id,
            "invoice_id": invoice_id,
            "credit_id": credit_id,
            "balance_info": balance_info,
        }

        print("\n" + "=" * 60)
        if balance_info.get("has_debitsaldo"):
            print("🎉 SUCCESS: Creditor with debitsaldo created successfully!")
            print(f"   Creditor: {balance_info['partner_name']}")
            print(f"   Debitsaldo: €{balance_info['balance']:,.2f}")
        else:
            print("⚠️  WARNING: Creditor created but no debitsaldo detected")

        return result


def main() -> None:
    creator = CreditorDebitsaldoCreator()
    result = creator.run()

    if result["success"]:
        print("\n✅ Test data creation completed successfully!")
        print("You can now test queries for 'Crediteuren met een debetsaldo'")
    else:
        print(f"\n❌ Test data creation failed: {result.get('error', 'Unknown error')}")


if __name__ == "__main__":
    main()
