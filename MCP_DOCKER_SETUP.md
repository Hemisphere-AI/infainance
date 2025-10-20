# MCP Odoo Server Docker Setup

## Overview

This setup provides a Docker container for the MCP Odoo server, following the MCP server recommendations for reliable Odoo queries.

## Quick Start

### 1. **Run the Setup Script**
```bash
./mcp-setup.sh
```

This will:
- Check Docker installation
- Create environment file
- Update MCP configuration
- Build and start the MCP server
- Verify the server is running

### 2. **Manual Setup**

If you prefer manual setup:

```bash
# 1. Create environment file
cp .env.mcp .env
# Edit .env with your actual Odoo credentials

# 2. Update MCP config
# Edit mcp-config/odoo_config.json with your credentials

# 3. Start the server
docker-compose up -d mcp-odoo-server

# 4. Check status
docker-compose ps mcp-odoo-server
```

## Configuration

### **Environment Variables** (`.env`)
```bash
ODOO_URL=url
ODOO_DB=db
ODOO_USERNAME=user_email
ODOO_PASSWORD=your_api_key_here
ODOO_TIMEOUT=30
ODOO_VERIFY_SSL=true
```

### **MCP Configuration** (`mcp-config/odoo_config.json`)
```json
{
  "url": "url",
  "db": "db", 
  "username": "user_email",
  "password": "your_api_key_here",
  "timeout": 30,
  "verify_ssl": true
}
```

### **Claude Desktop Integration** (`mcp-config/claude_desktop_config.json`)
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
        "ODOO_URL": "url",
        "ODOO_DB": "hemisphere1",
        "ODOO_USERNAME": "user_email",
        "ODOO_PASSWORD": "your_api_key_here"
      }
    }
  }
}
```

## Usage

### **1. Direct HTTP Access**
```bash
# Health check
curl http://localhost:3001/health

# List models
curl http://localhost:3001/odoo://models

# Get model info
curl http://localhost:3001/odoo://model/account.move

# Search records
curl "http://localhost:3001/odoo://search/account.move/[%5B%5B%22move_type%22,%22=%22,%22in_invoice%22%5D%5D"
```

### **2. Claude Desktop Integration**

Add to your Claude Desktop configuration:
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
        "ODOO_URL": "url",
        "ODOO_DB": "db",
        "ODOO_USERNAME": "user_email",
        "ODOO_PASSWORD": "your_api_key_here"
      }
    }
  }
}
```

### **3. Application Integration**

Use the MCP server in your application:
```javascript
// Example: Query moves with consistent format
const response = await fetch('http://localhost:3001/odoo://search/account.move/[[%22line_ids.account_id.code%22,%22in%22,[%22480500%22,%22481000%22,%22482000%22,%22483000%22,%22484000%22]],%5B%22move_type%22,%22=%22,%22in_invoice%22%5D,%5B%22state%22,%22=%22,%22posted%22%5D]');

const data = await response.json();
console.log(`Found ${data.length} records`);
```

## Management Commands

### **Docker Compose Commands**
```bash
# Start the server
docker-compose up -d mcp-odoo-server

# Stop the server
docker-compose down

# View logs
docker-compose logs mcp-odoo-server

# Restart the server
docker-compose restart mcp-odoo-server

# Check status
docker-compose ps mcp-odoo-server
```

### **Docker Commands**
```bash
# Build the image
docker build -f Dockerfile.mcp -t mcp/odoo .

# Run the container
docker run -d \
  --name mcp-odoo-server \
  -p 3001:3001 \
  -e ODOO_URL=url \
  -e ODOO_DB=db \
  -e ODOO_USERNAME=user_email \
  -e ODOO_PASSWORD=your_api_key_here \
  mcp/odoo

# Check container status
docker ps | grep mcp-odoo-server

# View logs
docker logs mcp-odoo-server

# Stop and remove
docker stop mcp-odoo-server
docker rm mcp-odoo-server
```

## Resources Available

### **MCP Resources (Read-only)**
- `odoo://models` - List all available models
- `odoo://model/{model}` - Get model fields and schema
- `odoo://record/{model}/{id}` - Get specific record
- `odoo://search/{model}/{domain}` - Search with domain

### **MCP Tools (Actions)**
- `execute_method` - Execute custom methods
- `search_employee` - Search employees by name
- `search_holidays` - Search holidays in date range

## Consistency Playbook

The MCP server implements the consistency playbook for reliable queries:

### **Canonical Query Format**
```javascript
{
  "model": "account.move",
  "domain": [
    ["line_ids.account_id.code","in",["480500","481000","482000","483000","484000"]],
    ["move_type","=","in_invoice"],
    ["state","=","posted"]
  ],
  "fields": ["id","name","move_type","date","partner_id","line_ids"],
  "limit": 1000,
  "order": "id asc"
}
```

### **Key Benefits**
- ✅ Consistent results every time
- ✅ Proper field selection
- ✅ State=posted prevents draft flickering
- ✅ Stable ordering (id asc)
- ✅ Validation prevents invalid queries

## Troubleshooting

### **Common Issues**

1. **Server won't start**
   ```bash
   # Check logs
   docker-compose logs mcp-odoo-server
   
   # Check environment variables
   docker-compose exec mcp-odoo-server env | grep ODOO
   ```

2. **Connection refused**
   ```bash
   # Check if container is running
   docker-compose ps mcp-odoo-server
   
   # Check port binding
   docker-compose port mcp-odoo-server 3001
   ```

3. **Authentication failed**
   ```bash
   # Verify credentials in .env
   cat .env | grep ODOO
   
   # Test connection manually
   curl -X POST https://hemisphere1.odoo.com/xmlrpc/2/common \
     -H "Content-Type: text/xml" \
     -d '<?xml version="1.0"?><methodCall><methodName>authenticate</methodName><params><param><value><string>hemisphere1</string></value></param><param><value><string>thomas@hemisphere.ai</string></value></param><param><value><string>your_api_key</string></value></param></params></methodCall>'
   ```

### **Debug Mode**
```bash
# Run with debug logging
docker-compose up mcp-odoo-server

# Check container logs
docker logs -f mcp-odoo-server
```

## Files Created

- `docker-compose.yml` - Docker Compose configuration
- `Dockerfile.mcp` - Docker image definition
- `mcp-config/odoo_config.json` - MCP server configuration
- `mcp-config/claude_desktop_config.json` - Claude Desktop integration
- `mcp-setup.sh` - Setup script
- `MCP_DOCKER_SETUP.md` - This documentation

## Next Steps

1. **Test the MCP server** with the setup script
2. **Configure Claude Desktop** with the provided config
3. **Integrate with your application** using the HTTP API
4. **Monitor performance** and adjust configuration as needed

The MCP server provides a reliable, consistent interface to Odoo that follows the recommended patterns for stable queries.
