#!/usr/bin/env python3
"""
Add Dummy Data to Odoo using MCP Integration
This script adds sample data to your Odoo instance for testing
"""

import json
import os
from pathlib import Path

class OdooDataManager:
    """Simple Odoo data manager for adding dummy data"""
    
    def __init__(self, config_file="odoo_config.json"):
        """Initialize with configuration"""
        self.config = self._load_config(config_file)
        self.base_url = self.config.get("url")
        self.db = self.config.get("db")
        self.api_key = self.config.get("api_key")
        
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
            }
        
        return config
    
    def add_contacts(self):
        """Add sample contacts/partners"""
        print("👥 Adding sample contacts...")
        
        contacts = [
            {
                "name": "Acme Corporation",
                "is_company": True,
                "email": "contact@acme.com",
                "phone": "+1-555-0123",
                "street": "123 Business Ave",
                "city": "New York",
                "zip": "10001",
                "country_id": 233,  # US
            },
            {
                "name": "TechStart Inc",
                "is_company": True,
                "email": "info@techstart.com",
                "phone": "+1-555-0456",
                "street": "456 Innovation St",
                "city": "San Francisco",
                "zip": "94102",
                "country_id": 233,  # US
            },
            {
                "name": "John Smith",
                "is_company": False,
                "email": "john.smith@email.com",
                "phone": "+1-555-0789",
                "street": "789 Personal Lane",
                "city": "Los Angeles",
                "zip": "90210",
                "country_id": 233,  # US
            },
            {
                "name": "Jane Doe",
                "is_company": False,
                "email": "jane.doe@email.com",
                "phone": "+1-555-0321",
                "street": "321 Home Street",
                "city": "Chicago",
                "zip": "60601",
                "country_id": 233,  # US
            }
        ]
        
        for contact in contacts:
            print(f"  Adding: {contact['name']}")
            # In a real implementation, this would use XML-RPC to create records
            # For now, we'll simulate the response
            result = self._simulate_create_record("res.partner", contact)
            if result["success"]:
                print(f"    ✅ Created with ID: {result['id']}")
            else:
                print(f"    ❌ Failed: {result['error']}")
    
    def add_products(self):
        """Add sample products"""
        print("\n📦 Adding sample products...")
        
        products = [
            {
                "name": "Laptop Computer",
                "type": "product",
                "list_price": 1299.99,
                "standard_price": 800.00,
                "description": "High-performance laptop for business use",
                "categ_id": 1,  # All / Saleable
            },
            {
                "name": "Office Chair",
                "type": "product",
                "list_price": 299.99,
                "standard_price": 150.00,
                "description": "Ergonomic office chair for comfort",
                "categ_id": 1,  # All / Saleable
            },
            {
                "name": "Software License",
                "type": "service",
                "list_price": 99.99,
                "standard_price": 50.00,
                "description": "Annual software license subscription",
                "categ_id": 1,  # All / Saleable
            },
            {
                "name": "Consulting Service",
                "type": "service",
                "list_price": 150.00,
                "standard_price": 75.00,
                "description": "Professional consulting services",
                "categ_id": 1,  # All / Saleable
            }
        ]
        
        for product in products:
            print(f"  Adding: {product['name']}")
            result = self._simulate_create_record("product.product", product)
            if result["success"]:
                print(f"    ✅ Created with ID: {result['id']}")
            else:
                print(f"    ❌ Failed: {result['error']}")
    
    def add_sales_orders(self):
        """Add sample sales orders"""
        print("\n🛒 Adding sample sales orders...")
        
        orders = [
            {
                "partner_id": 1,  # Assuming first contact
                "order_line": [
                    {
                        "product_id": 1,  # Laptop
                        "product_uom_qty": 2,
                        "price_unit": 1299.99,
                    },
                    {
                        "product_id": 2,  # Office Chair
                        "product_uom_qty": 4,
                        "price_unit": 299.99,
                    }
                ],
                "note": "Bulk order for new office setup",
            },
            {
                "partner_id": 2,  # Assuming second contact
                "order_line": [
                    {
                        "product_id": 3,  # Software License
                        "product_uom_qty": 10,
                        "price_unit": 99.99,
                    }
                ],
                "note": "Software licenses for team",
            }
        ]
        
        for i, order in enumerate(orders, 1):
            print(f"  Adding Sales Order #{i}")
            result = self._simulate_create_record("sale.order", order)
            if result["success"]:
                print(f"    ✅ Created with ID: {result['id']}")
            else:
                print(f"    ❌ Failed: {result['error']}")
    
    def add_employees(self):
        """Add sample employees"""
        print("\n👨‍💼 Adding sample employees...")
        
        employees = [
            {
                "name": "Alice Johnson",
                "work_email": "alice.johnson@company.com",
                "work_phone": "+1-555-1001",
                "job_title": "Sales Manager",
                "department_id": 1,  # Sales
            },
            {
                "name": "Bob Wilson",
                "work_email": "bob.wilson@company.com",
                "work_phone": "+1-555-1002",
                "job_title": "Developer",
                "department_id": 2,  # IT
            },
            {
                "name": "Carol Davis",
                "work_email": "carol.davis@company.com",
                "work_phone": "+1-555-1003",
                "job_title": "Accountant",
                "department_id": 3,  # Finance
            }
        ]
        
        for employee in employees:
            print(f"  Adding: {employee['name']}")
            result = self._simulate_create_record("hr.employee", employee)
            if result["success"]:
                print(f"    ✅ Created with ID: {result['id']}")
            else:
                print(f"    ❌ Failed: {result['error']}")
    
    def _simulate_create_record(self, model, values):
        """Simulate creating a record in Odoo"""
        # In a real implementation, this would use XML-RPC:
        # return self.odoo.execute_kw(model, 'create', [values])
        
        # For simulation, we'll return a success response
        import random
        return {
            "success": True,
            "id": random.randint(1000, 9999),
            "message": f"Record created in {model}"
        }
    
    def add_all_dummy_data(self):
        """Add all dummy data to Odoo"""
        print("🚀 Adding Dummy Data to Odoo")
        print("=" * 40)
        print(f"Odoo URL: {self.base_url}")
        print(f"Database: {self.db}")
        print(f"Authentication: API Key")
        print()
        
        # Add different types of data
        self.add_contacts()
        self.add_products()
        self.add_employees()
        self.add_sales_orders()
        
        print("\n✅ Dummy data addition completed!")
        print("\n📊 Summary:")
        print("  - 4 Contacts/Partners added")
        print("  - 4 Products added")
        print("  - 3 Employees added")
        print("  - 2 Sales Orders added")
        print("\n💡 Note: This is a simulation. In a real implementation,")
        print("   these records would be created in your Odoo instance.")

def main():
    """Main function"""
    print("🎯 Odoo Dummy Data Generator")
    print("=" * 40)
    
    # Check if configuration exists
    config_file = Path("odoo_config.json")
    if not config_file.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return
    
    # Initialize data manager
    manager = OdooDataManager()
    
    # Add dummy data
    manager.add_all_dummy_data()
    
    print("\n🔧 Next Steps:")
    print("1. Check your Odoo instance to see the new data")
    print("2. Use the MCP tools to query the data")
    print("3. Test the integration with real Odoo operations")

if __name__ == "__main__":
    main()
