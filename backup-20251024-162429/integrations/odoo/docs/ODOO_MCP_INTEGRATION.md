# Odoo MCP Integration Guide

This guide explains how to integrate the Odoo MCP (Model Context Protocol) server with your project.

## What is Odoo MCP?

The Odoo MCP server allows AI assistants to interact with Odoo ERP systems through a standardized protocol. It provides tools for:

- **execute_method**: Execute custom methods on Odoo models
- **search_employee**: Search for employees by name
- **search_holidays**: Search for holidays within date ranges
- **Resources**: Access Odoo models, records, and search results via URI patterns

## Installation

### 1. Virtual Environment Setup

```bash
# Create virtual environment
python3 -m venv odoo-mcp-env

# Activate virtual environment
source odoo-mcp-env/bin/activate

# Install odoo-mcp package
pip install odoo-mcp
```

### 2. Configuration

#### Option A: Configuration File

Create `odoo_config.json`:

```json
{
  "url": "https://your-odoo-instance.com",
  "db": "your-database-name",
  "username": "your-username",
  "password": "your-password-or-api-key"
}
```

#### Option B: Environment Variables

Set these environment variables:

```bash
export ODOO_URL="https://your-odoo-instance.com"
export ODOO_DB="your-database-name"
export ODOO_USERNAME="your-username"
export ODOO_PASSWORD="your-password-or-api-key"
export ODOO_TIMEOUT="30"
export ODOO_VERIFY_SSL="true"
```

### 3. Quick Setup

Run the setup script:

```bash
# Make sure virtual environment is activated
source odoo-mcp-env/bin/activate

# Run setup script
python3 setup_odoo_mcp.py
```

## Usage Options

### Option 1: Direct Python Integration

Use the MCP server directly in your Python code:

```python
from odoo_mcp.server import OdooMCPServer

# Initialize server
server = OdooMCPServer()

# Use MCP tools
result = server.execute_method(
    model="res.partner",
    method="search",
    args=[[["is_company", "=", True]]]
)
```

### Option 2: Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "odoo": {
      "command": "python3",
      "args": ["-m", "odoo_mcp"],
      "env": {
        "ODOO_URL": "https://your-odoo-instance.com",
        "ODOO_DB": "your-database-name",
        "ODOO_USERNAME": "your-username",
        "ODOO_PASSWORD": "your-password-or-api-key"
      }
    }
  }
}
```

### Option 3: Docker Integration

```json
{
  "mcpServers": {
    "odoo": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "ODOO_URL",
        "-e", "ODOO_DB", 
        "-e", "ODOO_USERNAME",
        "-e", "ODOO_PASSWORD",
        "mcp/odoo"
      ],
      "env": {
        "ODOO_URL": "https://your-odoo-instance.com",
        "ODOO_DB": "your-database-name",
        "ODOO_USERNAME": "your-username",
        "ODOO_PASSWORD": "your-password-or-api-key"
      }
    }
  }
}
```

## Available Tools

### execute_method
Execute custom methods on Odoo models.

**Parameters:**
- `model` (string): Model name (e.g., 'res.partner')
- `method` (string): Method name to execute
- `args` (optional array): Positional arguments
- `kwargs` (optional object): Keyword arguments

**Example:**
```python
result = execute_method(
    model="res.partner",
    method="search_read",
    args=[[["is_company", "=", True]], ["name", "email"]]
)
```

### search_employee
Search for employees by name.

**Parameters:**
- `name` (string): Name or part of name to search
- `limit` (optional number): Maximum results (default 20)

**Example:**
```python
employees = search_employee(name="John", limit=10)
```

### search_holidays
Search for holidays within date range.

**Parameters:**
- `start_date` (string): Start date in YYYY-MM-DD format
- `end_date` (string): End date in YYYY-MM-DD format
- `employee_id` (optional number): Employee ID filter

**Example:**
```python
holidays = search_holidays(
    start_date="2024-01-01",
    end_date="2024-12-31",
    employee_id=123
)
```

## Available Resources

### odoo://models
Lists all available models in the Odoo system.

### odoo://model/{model_name}
Get information about a specific model.

**Example:** `odoo://model/res.partner`

### odoo://record/{model_name}/{record_id}
Get a specific record by ID.

**Example:** `odoo://record/res.partner/1`

### odoo://search/{model_name}/{domain}
Search for records matching a domain.

**Example:** `odoo://search/res.partner/[["is_company","=",true]]`

## Domain Formatting

When using domain parameters, use these formats:

### List Format
```json
[["field", "operator", value], ...]
```

### Object Format
```json
{"conditions": [{"field": "...", "operator": "...", "value": "..."}]}
```

### Examples
```json
// List format
[["is_company", "=", true]]

// Object format
{"conditions": [{"field": "date_order", "operator": ">=", "value": "2024-03-01"}]}

// Multiple conditions
[["date_order", ">=", "2024-03-01"], ["date_order", "<=", "2024-03-31"]]
```

## Testing the Integration

### 1. Test Connection
```bash
source odoo-mcp-env/bin/activate
python3 -c "from odoo_mcp.server import OdooMCPServer; print('✅ Odoo MCP installed successfully')"
```

### 2. Test with MCP Dev Tools
```bash
source odoo-mcp-env/bin/activate
mcp dev odoo_mcp/server.py
```

### 3. Test with Setup Script
```bash
source odoo-mcp-env/bin/activate
python3 setup_odoo_mcp.py
```

## Security Considerations

1. **Never commit credentials**: Add `odoo_config.json` to `.gitignore`
2. **Use API keys**: Prefer API keys over passwords when possible
3. **Environment variables**: Use environment variables for production
4. **SSL verification**: Keep `ODOO_VERIFY_SSL=true` for security

## Troubleshooting

### Common Issues

1. **Connection timeout**: Increase `ODOO_TIMEOUT` value
2. **SSL errors**: Check `ODOO_VERIFY_SSL` setting
3. **Authentication failed**: Verify credentials and database name
4. **Module not found**: Ensure virtual environment is activated

### Debug Mode

Set environment variable for debug logging:
```bash
export ODOO_DEBUG=true
```

## Next Steps

1. Configure your Odoo connection details
2. Test the connection using the setup script
3. Choose your integration method (Python, Claude Desktop, or Docker)
4. Start using the MCP tools in your application

For more information, visit the [Odoo MCP GitHub repository](https://github.com/tuanle96/mcp-odoo).

