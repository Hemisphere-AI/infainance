"""
Comprehensive Dummy Ingest Script
Creates a full set of sample data across all major Odoo tables for a new organization:
- Partners (customers, suppliers)
- Products
- Invoices (customer/supplier)
- Sales Orders
- Purchase Orders
- Assets
- Journal Entries
All entries are posted to ensure they are visible in Odoo.
"""

import os
import xmlrpc.client
from pathlib import Path
from datetime import datetime, timedelta


class OdooDummyIngest:
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

    def _create_partners(self) -> list[int]:
        """Create customers and suppliers"""
        partners = []
        # Customers
        customers = [
            {"name": "Acme Corp", "email": "contact@acme.com", "is_company": True},
            {"name": "TechStart BV", "email": "info@techstart.nl", "is_company": True},
            {"name": "John Smith", "email": "john@example.com", "is_company": False},
        ]
        for customer in customers:
            try:
                partner_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "res.partner",
                    "create",
                    [customer],
                )
                partners.append(partner_id)
            except Exception as e:
                print(f"⚠️ Could not create customer {customer['name']}: {e}")

        # Suppliers
        suppliers = [
            {
                "name": "Office Supplies Ltd",
                "email": "orders@officesupplies.com",
                "is_company": True,
                "supplier_rank": 1,
            },
            {
                "name": "IT Equipment Co",
                "email": "sales@itequipment.com",
                "is_company": True,
                "supplier_rank": 1,
            },
        ]
        for supplier in suppliers:
            try:
                partner_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "res.partner",
                    "create",
                    [supplier],
                )
                partners.append(partner_id)
            except Exception as e:
                print(f"⚠️ Could not create supplier {supplier['name']}: {e}")

        return partners

    def _create_products(self) -> list[int]:
        """Create products"""
        products = []
        product_data = [
            {
                "name": "Consulting Service",
                "list_price": 100.0,
                "standard_price": 0.0,
                "type": "service",
            },
            {
                "name": "Software License",
                "list_price": 500.0,
                "standard_price": 0.0,
                "type": "service",
            },
            {
                "name": "Technical Support",
                "list_price": 150.0,
                "standard_price": 0.0,
                "type": "service",
            },
            {
                "name": "Training Session",
                "list_price": 300.0,
                "standard_price": 0.0,
                "type": "service",
            },
        ]
        for product in product_data:
            try:
                product_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "product.product",
                    "create",
                    [product],
                )
                products.append(product_id)
            except Exception as e:
                print(f"⚠️ Could not create product {product['name']}: {e}")
        return products

    def _create_sales_orders(
        self, customers: list[int], products: list[int]
    ) -> list[int]:
        """Create sales orders"""
        orders = []
        if not customers or not products:
            return orders

        try:
            # Sales Order 1
            order_data = {
                "partner_id": customers[0],
                "order_line": [
                    (
                        0,
                        0,
                        {
                            "product_id": products[0],
                            "product_uom_qty": 2,
                            "price_unit": 100.0,
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "product_id": products[2],
                            "product_uom_qty": 10,
                            "price_unit": 100.0,
                        },
                    ),
                ],
            }
            order_id = self.models.execute_kw(
                self.db, self.uid, self.password, "sale.order", "create", [order_data]
            )
            # Confirm the order
            self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "sale.order",
                "action_confirm",
                [order_id],
            )
            orders.append(order_id)
        except Exception as e:
            print(f"⚠️ Could not create sales order: {e}")

        return orders

    def _create_purchase_orders(
        self, suppliers: list[int], products: list[int]
    ) -> list[int]:
        """Create purchase orders"""
        orders = []
        if not suppliers or not products:
            return orders

        try:
            # Purchase Order 1
            order_data = {
                "partner_id": suppliers[0],
                "order_line": [
                    (
                        0,
                        0,
                        {
                            "product_id": products[1],
                            "product_qty": 1,
                            "price_unit": 500.0,
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "product_id": products[2],
                            "product_qty": 5,
                            "price_unit": 300.0,
                        },
                    ),
                ],
            }
            order_id = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "purchase.order",
                "create",
                [order_data],
            )
            # Confirm the order
            self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "purchase.order",
                "button_confirm",
                [order_id],
            )
            orders.append(order_id)
        except Exception as e:
            print(f"⚠️ Could not create purchase order: {e}")

        return orders

    def _create_invoices(
        self, customers: list[int], suppliers: list[int], products: list[int]
    ) -> list[int]:
        """Create customer and supplier invoices"""
        invoices = []
        if not customers or not products:
            return invoices

        try:
            # Customer Invoice 1
            invoice_data = {
                "partner_id": customers[0],
                "move_type": "out_invoice",
                "invoice_line_ids": [
                    (
                        0,
                        0,
                        {"product_id": products[0], "quantity": 1, "price_unit": 100.0},
                    ),
                    (
                        0,
                        0,
                        {"product_id": products[2], "quantity": 5, "price_unit": 150.0},
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
            # Post the invoice
            self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "action_post",
                [invoice_id],
            )
            invoices.append(invoice_id)
        except Exception as e:
            print(f"⚠️ Could not create customer invoice: {e}")

        try:
            # Customer Invoice 2
            invoice_data = {
                "partner_id": customers[1] if len(customers) > 1 else customers[0],
                "move_type": "out_invoice",
                "invoice_line_ids": [
                    (
                        0,
                        0,
                        {"product_id": products[1], "quantity": 3, "price_unit": 500.0},
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
            # Post the invoice
            self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.move",
                "action_post",
                [invoice_id],
            )
            invoices.append(invoice_id)
        except Exception as e:
            print(f"⚠️ Could not create customer invoice 2: {e}")

        if suppliers and products:
            try:
                # Supplier Invoice
                invoice_data = {
                    "partner_id": suppliers[0],
                    "move_type": "in_invoice",
                    "invoice_line_ids": [
                        (
                            0,
                            0,
                            {
                                "product_id": products[1],
                                "quantity": 1,
                                "price_unit": 500.0,
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
                # Post the invoice
                self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.move",
                    "action_post",
                    [invoice_id],
                )
                invoices.append(invoice_id)
            except Exception as e:
                print(f"⚠️ Could not create supplier invoice: {e}")

        return invoices

    def _create_credit_notes(
        self, customers: list[int], suppliers: list[int], products: list[int]
    ) -> list[int]:
        """Create customer and supplier credit notes"""
        credit_notes = []
        if not customers or not products:
            return credit_notes

        try:
            # Customer Credit Note
            credit_data = {
                "partner_id": customers[0],
                "move_type": "out_refund",
                "invoice_line_ids": [
                    (
                        0,
                        0,
                        {"product_id": products[0], "quantity": 1, "price_unit": 100.0},
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
            credit_notes.append(credit_id)
        except Exception as e:
            print(f"⚠️ Could not create customer credit note: {e}")

        if suppliers and products:
            try:
                # Supplier Credit Note
                credit_data = {
                    "partner_id": suppliers[0],
                    "move_type": "in_refund",
                    "invoice_line_ids": [
                        (
                            0,
                            0,
                            {
                                "product_id": products[1],
                                "quantity": 1,
                                "price_unit": 500.0,
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
                credit_notes.append(credit_id)
            except Exception as e:
                print(f"⚠️ Could not create supplier credit note: {e}")

        return credit_notes

    def _create_payments(
        self, customers: list[int], suppliers: list[int], invoices: list[int]
    ) -> list[int]:
        """Create customer and supplier payments"""
        payments = []
        if not customers or not invoices:
            return payments

        try:
            # Customer Payment
            payment_data = {
                "partner_id": customers[0],
                "payment_type": "inbound",
                "partner_type": "customer",
                "amount": 500.0,
            }
            payment_id = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.payment",
                "create",
                [payment_data],
            )
            # Post the payment
            self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.payment",
                "action_post",
                [payment_id],
            )
            payments.append(payment_id)
        except Exception as e:
            print(f"⚠️ Could not create customer payment: {e}")

        if suppliers:
            try:
                # Supplier Payment
                payment_data = {
                    "partner_id": suppliers[0],
                    "payment_type": "outbound",
                    "partner_type": "supplier",
                    "amount": 300.0,
                }
                payment_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.payment",
                    "create",
                    [payment_data],
                )
                # Post the payment
                self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "account.payment",
                    "action_post",
                    [payment_id],
                )
                payments.append(payment_id)
            except Exception as e:
                print(f"⚠️ Could not create supplier payment: {e}")

        return payments

    def _create_assets(self) -> list[int]:
        """Create fixed assets"""
        assets = []
        asset_data = [
            {
                "name": "Office Computer",
                "original_value": 1200.0,
                "method": "linear",
                "method_number": 3,
            },
            {
                "name": "Office Furniture",
                "original_value": 800.0,
                "method": "linear",
                "method_number": 5,
            },
        ]
        for asset in asset_data:
            try:
                asset_id = self.models.execute_kw(
                    self.db, self.uid, self.password, "account.asset", "create", [asset]
                )
                assets.append(asset_id)
            except Exception as e:
                print(f"⚠️ Could not create asset {asset['name']}: {e}")
        return assets

    def _create_journal_entries(self) -> list[int]:
        """Create journal entries"""
        entries = []
        try:
            # Get journal
            journals = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.journal",
                "search_read",
                [],
                {"fields": ["name", "type"], "limit": 1},
            )
            if not journals:
                return entries

            journal_id = journals[0]["id"]

            # Get accounts
            accounts = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "account.account",
                "search_read",
                [],
                {"fields": ["name", "code"], "limit": 10},
            )
            if len(accounts) < 2:
                return entries

            # Create journal entry
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            entry_data = {
                "name": f"JOURNAL/{datetime.now().strftime('%Y/%m')}/{timestamp}",
                "date": datetime.now().date().isoformat(),
                "journal_id": journal_id,
                "ref": f"Dummy journal entry {timestamp}",
                "line_ids": [
                    (
                        0,
                        0,
                        {
                            "account_id": accounts[0]["id"],
                            "name": "Debit entry",
                            "debit": 500.0,
                            "credit": 0.0,
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "account_id": accounts[1]["id"],
                            "name": "Credit entry",
                            "debit": 0.0,
                            "credit": 500.0,
                        },
                    ),
                ],
            }
            entry_id = self.models.execute_kw(
                self.db, self.uid, self.password, "account.move", "create", [entry_data]
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
            entries.append(entry_id)
        except Exception as e:
            print(f"⚠️ Could not create journal entry: {e}")

        return entries

    def run(self) -> dict:
        """Run comprehensive dummy data creation"""
        print("🚀 Starting comprehensive dummy data creation...")

        self.authenticate()

        # Create all data types
        partners = self._create_partners()
        print(f"✅ Created {len(partners)} partners")

        products = self._create_products()
        print(f"✅ Created {len(products)} products")

        customers = [p for p in partners if p]  # Filter out None values
        suppliers = [p for p in partners if p]  # Same for now

        sales_orders = self._create_sales_orders(customers, products)
        print(f"✅ Created {len(sales_orders)} sales orders")

        purchase_orders = self._create_purchase_orders(suppliers, products)
        print(f"✅ Created {len(purchase_orders)} purchase orders")

        invoices = self._create_invoices(customers, suppliers, products)
        print(f"✅ Created {len(invoices)} invoices")

        credit_notes = self._create_credit_notes(customers, suppliers, products)
        print(f"✅ Created {len(credit_notes)} credit notes")

        payments = self._create_payments(customers, suppliers, invoices)
        print(f"✅ Created {len(payments)} payments")

        assets = self._create_assets()
        print(f"✅ Created {len(assets)} assets")

        journal_entries = self._create_journal_entries()
        print(f"✅ Created {len(journal_entries)} journal entries")

        return {
            "partners": partners,
            "products": products,
            "sales_orders": sales_orders,
            "purchase_orders": purchase_orders,
            "invoices": invoices,
            "credit_notes": credit_notes,
            "payments": payments,
            "assets": assets,
            "journal_entries": journal_entries,
        }


def main() -> None:
    ingest = OdooDummyIngest()
    result = ingest.run()

    print("\n🎉 Comprehensive dummy data creation complete!")
    print("All entries should be visible in Odoo:")
    print(f"- {len(result['partners'])} partners (customers/suppliers)")
    print(f"- {len(result['products'])} products")
    print(f"- {len(result['sales_orders'])} sales orders")
    print(f"- {len(result['purchase_orders'])} purchase orders")
    print(f"- {len(result['invoices'])} invoices")
    print(f"- {len(result['credit_notes'])} credit notes")
    print(f"- {len(result['payments'])} payments")
    print(f"- {len(result['assets'])} assets")
    print(f"- {len(result['journal_entries'])} journal entries")


if __name__ == "__main__":
    main()
