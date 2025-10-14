#!/usr/bin/env python3
"""
Simple Odoo Test
This script tests basic Odoo connection and creates sample data
"""

import json
import xmlrpc.client
import os
from pathlib import Path

def test_odoo_connection():
    """Test Odoo connection and create sample data"""
    print("🔧 Simple Odoo Test")
    print("=" * 40)
    
    # Load configuration
    config_path = Path(__file__).parent.parent / "config" / "odoo_config.json"
    
    if not config_path.exists():
        print("❌ Configuration file not found")
        print("Creating sample configuration...")
        
        # Create sample configuration
        sample_config = {
            "url": "https://your-odoo-instance.com",
            "db": "your-database-name",
            "username": "your-username",
            "password": "your-password-or-api-key"
        }
        
        with open(config_path, 'w') as f:
            json.dump(sample_config, f, indent=2)
        
        print(f"✅ Sample configuration created at {config_path}")
        print("Please edit the configuration file with your actual Odoo details")
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
            
            # Test basic operations
            models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")
            
            # Get user info
            user_info = models.execute_kw(
                db, uid, password,
                'res.users', 'read',
                [uid], {'fields': ['name', 'login', 'email']}
            )
            print(f"✅ User info: {user_info[0]['name']} ({user_info[0]['login']})")
            
            return True
        else:
            print("❌ Authentication failed")
            return False
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_odoo_connection()