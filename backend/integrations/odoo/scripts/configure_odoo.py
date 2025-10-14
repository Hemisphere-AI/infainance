#!/usr/bin/env python3
"""
Configure Odoo Connection
This script helps configure the Odoo MCP server interactively
"""

import json
import os
from pathlib import Path

def create_odoo_config():
    """Create Odoo configuration file"""
    print("🔧 Odoo Configuration Setup")
    print("=" * 40)
    
    # Get Odoo details from user
    print("Please enter your Odoo connection details:")
    url = input("Odoo URL (e.g., https://your-company.odoo.com): ").strip()
    db = input("Database name: ").strip()
    username = input("Username: ").strip()
    password = input("Password or API Key: ").strip()
    
    # Create configuration
    config = {
        "url": url,
        "db": db,
        "username": username,
        "password": password
    }
    
    # Save to config file
    config_path = Path(__file__).parent.parent / "config" / "odoo_config.json"
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"\n✅ Configuration saved to {config_path}")
    print("\n🔧 Next Steps:")
    print("1. Test the connection with: python3 test_odoo_mcp.py")
    print("2. Run the MCP server with your configuration")
    
    return config

if __name__ == "__main__":
    create_odoo_config()