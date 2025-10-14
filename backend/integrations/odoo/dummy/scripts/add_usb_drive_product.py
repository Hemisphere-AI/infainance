#!/usr/bin/env python3
"""
Add USB Drive Product to Odoo
This script adds a USB Drive product to your Odoo system
"""

import json
import xmlrpc.client
import os
from pathlib import Path


class OdooUSBDriveAdder:
    """Odoo USB Drive product adder"""

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

    def add_usb_drive_product(self):
        """Add USB Drive product"""
        print("\n💾 Adding USB Drive product...")

        usb_products = [
            {
                "name": "USB Drive 32GB",
                "type": "consu",
                "list_price": 25.99,
                "description": "32GB USB 3.0 Flash Drive - High Speed Data Transfer",
                "categ_id": 1,  # Default category
                "sale_ok": True,
                "purchase_ok": True,
            },
            {
                "name": "USB Drive 64GB",
                "type": "consu",
                "list_price": 45.99,
                "description": "64GB USB 3.0 Flash Drive - High Speed Data Transfer",
                "categ_id": 1,  # Default category
                "sale_ok": True,
                "purchase_ok": True,
            },
            {
                "name": "USB Drive 128GB",
                "type": "consu",
                "list_price": 89.99,
                "description": "128GB USB 3.0 Flash Drive - High Speed Data Transfer",
                "categ_id": 1,  # Default category
                "sale_ok": True,
                "purchase_ok": True,
            },
            {
                "name": "USB-C Drive 256GB",
                "type": "consu",
                "list_price": 149.99,
                "description": "256GB USB-C Flash Drive - Ultra High Speed Data Transfer",
                "categ_id": 1,  # Default category
                "sale_ok": True,
                "purchase_ok": True,
            },
        ]

        created_products = []
        for product in usb_products:
            try:
                product_id = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    "product.product",
                    "create",
                    [product],
                )
                created_products.append(product_id)
                print(f"  ✅ Created USB Drive: {product['name']} (ID: {product_id})")
                print(f"      Price: ${product['list_price']}")
                print(f"      Description: {product['description']}")
            except Exception as e:
                print(f"  ❌ Failed to create USB Drive {product['name']}: {e}")

        return created_products

    def add_more_products(self):
        """Add more sample products"""
        print("\n📦 Adding more sample products...")

        products = [
            {
                "name": "Wireless Mouse",
                "type": "consu",
                "list_price": 29.99,
                "description": "Wireless Optical Mouse - Ergonomic Design",
                "categ_id": 1,
                "sale_ok": True,
                "purchase_ok": True,
            },
            {
                "name": "Wireless Keyboard",
                "type": "consu",
                "list_price": 59.99,
                "description": "Wireless Mechanical Keyboard - Backlit Keys",
                "categ_id": 1,
                "sale_ok": True,
                "purchase_ok": True,
            },
            {
                "name": "Monitor 24 inch",
                "type": "consu",
                "list_price": 199.99,
                "description": "24 inch LED Monitor - Full HD 1920x1080",
                "categ_id": 1,
                "sale_ok": True,
                "purchase_ok": True,
            },
            {
                "name": "Webcam HD",
                "type": "consu",
                "list_price": 79.99,
                "description": "HD Webcam 1080p - Built-in Microphone",
                "categ_id": 1,
                "sale_ok": True,
                "purchase_ok": True,
            },
        ]

        created_products = []
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
                created_products.append(product_id)
                print(f"  ✅ Created product: {product['name']} (ID: {product_id})")
            except Exception as e:
                print(f"  ❌ Failed to create product {product['name']}: {e}")

        return created_products

    def add_all_products(self):
        """Add all products"""
        print("🛍️ Adding Products to Odoo")
        print("=" * 40)
        print(f"Odoo URL: {self.url}")
        print(f"Database: {self.db}")

        if not self.uid:
            print("❌ Authentication failed. Cannot proceed.")
            return

        # Test connection
        if not self.test_connection():
            return

        # Add USB Drive products
        usb_products = self.add_usb_drive_product()

        # Add more products
        other_products = self.add_more_products()

        print("\n✅ Products addition completed!")
        print("\n📊 Summary:")
        print(f"  - {len(usb_products)} USB Drive products created")
        print(f"  - {len(other_products)} Other products created")
        print(f"  - Total: {len(usb_products) + len(other_products)} products")

        print("\n🔧 Next Steps:")
        print("1. Check your Odoo products page to see the new products")
        print("2. Look for the USB Drive products in your inventory")
        print("3. Use the MCP tools to query product data")

        return {
            "usb_products": usb_products,
            "other_products": other_products,
            "total_products": len(usb_products) + len(other_products),
        }


def main():
    """Main function"""
    print("🎯 Odoo USB Drive Product Adder")
    print("=" * 40)

    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return

    # Initialize adder
    adder = OdooUSBDriveAdder()

    # Add products
    results = adder.add_all_products()

    if results:
        print(f"\n📋 Created Products:")
        print(f"  USB Drives: {results['usb_products']}")
        print(f"  Other Products: {results['other_products']}")
        print(f"  Total Products: {results['total_products']}")


if __name__ == "__main__":
    main()
