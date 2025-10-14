#!/usr/bin/env python3
"""
Test Odoo MCP Connection
This script tests the Odoo MCP server connection
"""

import json
import xmlrpc.client
import os
from pathlib import Path

def test_odoo_connection():
    """Test Odoo connection"""
    print("🔧 Testing Odoo MCP Connection")
    print("=" * 40)
    
    # Load configuration
    config_path = Path(__file__).parent.parent / "config" / "odoo_config.json"
    
    if not config_path.exists():
        print("❌ Configuration file not found")
        print("Run: python3 configure_odoo.py to set up your Odoo connection")
        return False
    
    with open(config_path) as f:
        config = json.load(f)
    
    url = config.get("url")
    db = config.get("db")
    username = config.get("username")
    password = config.get("password")
    
    print(f"Odoo URL: {url}")
    print(f"Database: {db}")
    print(f"Username: {username}")
    
    try:
        # Test connection
        common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
        version = common.version()
        print(f"✅ Connected to Odoo {version.get('server_version', 'Unknown')}")
        
        # Test authentication
        uid = common.authenticate(db, username, password, {})
        if uid:
            print(f"✅ Authentication successful (UID: {uid})")
            return True
        else:
            print("❌ Authentication failed")
            return False
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_odoo_connection()