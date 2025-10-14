# Odoo MCP Integration

This folder contains all Odoo-related integration files and scripts.

## 📁 Folder Structure

```
backend/integrations/odoo/
├── config/                    # Configuration files
│   ├── odoo_config.json       # Main Odoo configuration
│   ├── odoo_config.json.example
│   ├── odoo.env.example       # Environment variables template
│   └── claude_desktop_config.json.example
├── scripts/                   # Basic Odoo setup scripts
│   ├── configure_odoo.py      # Interactive configuration
│   ├── test_odoo_mcp.py       # Test connection
│   ├── simple_odoo_test.py    # Simple connection test
│   └── odoo_mcp_example.py    # MCP integration example
├── dummy/                     # Dummy data and scripts
│   ├── scripts/               # Dummy data generation scripts
│   ├── templates/             # Excel/CSV templates
│   ├── data/                  # Generated JSON data files
│   └── exports/               # Export files
├── odoo-mcp-env/              # Python virtual environment
│   ├── bin/                   # Python executables
│   ├── lib/                   # Installed packages
│   └── include/               # Header files
└── docs/                      # Documentation
    ├── ODOO_MCP_INTEGRATION.md
    ├── ODOO_API_KEY_SETUP.md
    └── INTEGRATION_SUMMARY.md
```

## 🚀 Quick Start

### 1. Configure Odoo Connection
```bash
cd backend/integrations/odoo/scripts
python3 configure_odoo.py
```

### 2. Test Connection
```bash
python3 test_odoo_mcp.py
```

### 3. Run Example
```bash
python3 odoo_mcp_example.py
```

## 📊 Dummy Data Scripts

All dummy data generation scripts are located in `dummy/scripts/`:

- **Basic Data**: `add_dummy_data.py`, `real_odoo_data.py`
- **Financial Data**: `add_basic_financial_data.py`, `add_financial_data.py`, `simulate_balance_data.py`
- **Products**: `add_usb_drive_product.py`
- **Accounting**: `create_accounting_entries.py`, `check_journal_entries.py`
- **Assets**: `import_fixed_assets.py`, `create_assets_excel.py`
- **Utilities**: `check_odoo_data.py`

## 📋 Usage Examples

### Generate Financial Data
```bash
cd backend/integrations/odoo/dummy/scripts
python3 simulate_balance_data.py
```

### Add USB Drive Products
```bash
python3 add_usb_drive_product.py
```

### Check Journal Entries
```bash
python3 check_journal_entries.py
```

## 🔧 Configuration

The main configuration file is `config/odoo_config.json`:

```json
{
  "url": "https://your-odoo-instance.com",
  "db": "your-database-name",
  "username": "your-username",
  "password": "your-password-or-api-key"
}
```

## 📚 Documentation

- [ODOO_MCP_INTEGRATION.md](docs/ODOO_MCP_INTEGRATION.md) - Complete integration guide
- [ODOO_API_KEY_SETUP.md](docs/ODOO_API_KEY_SETUP.md) - API key authentication setup
- [INTEGRATION_SUMMARY.md](docs/INTEGRATION_SUMMARY.md) - Integration summary

## 🎯 Next Steps

1. Configure your Odoo connection
2. Test the connection
3. Generate dummy data for testing
4. Use the MCP tools to query your data
5. Integrate with your applications
