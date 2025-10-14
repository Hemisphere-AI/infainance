#!/usr/bin/env python3
"""
Odoo MCP Example
This script demonstrates how to use the Odoo MCP integration
"""

import json
import xmlrpc.client
import os
from pathlib import Path

def load_config():
    """Load Odoo configuration"""
    config_path = Path(__file__).parent.parent / "config" / "odoo_config.json"
    
    if not config_path.exists():
        print("❌ Configuration file not found")
        return None
    
    with open(config_path) as f:
        return json.load(f)

def test_odoo_mcp():
    """Test Odoo MCP integration"""
    print("🔧 Odoo MCP Example")
    print("=" * 40)
    
    config = load_config()
    if not config:
        return False
    
    url = config.get("url")
    db = config.get("db")
    username = config.get("username")
    password = config.get("password")
    
    try:
        # Initialize connections
        common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
        models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")
        
        # Authenticate
        uid = common.authenticate(db, username, password, {})
        if not uid:
            print("❌ Authentication failed")
            return False
        
        print(f"✅ Authenticated successfully (UID: {uid})")
        
        # Example 1: Search for employees
        print("\n👥 Searching for employees...")
        try:
            employees = models.execute_kw(
                db, uid, password,
                'hr.employee', 'search_read',
                [], {'fields': ['name', 'job_title', 'department_id'], 'limit': 5}
            )
            if employees:
                print(f"Found {len(employees)} employees:")
                for emp in employees:
                    print(f"  - {emp['name']} ({emp.get('job_title', 'N/A')})")
            else:
                print("No employees found")
        except Exception as e:
            print(f"⚠️  HR module not available: {e}")
        
        # Example 2: Search for partners
        print("\n👥 Searching for partners...")
        try:
            partners = models.execute_kw(
                db, uid, password,
                'res.partner', 'search_read',
                [], {'fields': ['name', 'email', 'phone'], 'limit': 5}
            )
            if partners:
                print(f"Found {len(partners)} partners:")
                for partner in partners:
                    print(f"  - {partner['name']} ({partner.get('email', 'N/A')})")
            else:
                print("No partners found")
        except Exception as e:
            print(f"⚠️  Partners not available: {e}")
        
        # Example 3: Search for products
        print("\n📦 Searching for products...")
        try:
            products = models.execute_kw(
                db, uid, password,
                'product.product', 'search_read',
                [], {'fields': ['name', 'list_price', 'type'], 'limit': 5}
            )
            if products:
                print(f"Found {len(products)} products:")
                for product in products:
                    print(f"  - {product['name']} (${product.get('list_price', 0):.2f})")
            else:
                print("No products found")
        except Exception as e:
            print(f"⚠️  Products not available: {e}")
        
        # Example 4: Execute a method
        print("\n🔧 Testing method execution...")
        try:
            # Get server version
            version = common.version()
            print(f"Server version: {version.get('server_version', 'Unknown')}")
            
            # Get database info
            db_info = common.db_exist(db)
            print(f"Database exists: {db_info}")
            
        except Exception as e:
            print(f"⚠️  Method execution failed: {e}")
        
        print("\n✅ Odoo MCP integration test completed!")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_odoo_mcp()