#!/bin/bash

# MCP Odoo Server Setup Script
# This script sets up the MCP Odoo server in a Docker container

echo "🚀 Setting up MCP Odoo Server"
echo "=============================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.mcp .env
    echo "⚠️  Please edit .env file with your actual Odoo credentials"
    echo "   - ODOO_URL: Your Odoo instance URL"
    echo "   - ODOO_DB: Your database name"
    echo "   - ODOO_USERNAME: Your username"
    echo "   - ODOO_PASSWORD: Your API key"
    echo ""
    echo "Press Enter when you've updated the .env file..."
    read
fi

# Update MCP config with environment variables
echo "🔧 Updating MCP configuration..."
if [ -f .env ]; then
    source .env
    # Update odoo_config.json with actual values
    if [ -n "$ODOO_URL" ] && [ -n "$ODOO_DB" ] && [ -n "$ODOO_USERNAME" ] && [ -n "$ODOO_PASSWORD" ]; then
        cat > mcp-config/odoo_config.json << EOF
{
  "url": "$ODOO_URL",
  "db": "$ODOO_DB",
  "username": "$ODOO_USERNAME",
  "password": "$ODOO_PASSWORD",
  "timeout": 30,
  "verify_ssl": true
}
EOF
        echo "✅ MCP configuration updated"
    else
        echo "⚠️  Please update .env file with your Odoo credentials"
        exit 1
    fi
fi

# Build and start the MCP server
echo "🐳 Building and starting MCP Odoo server..."
docker-compose up -d mcp-odoo-server

# Wait for the server to be ready
echo "⏳ Waiting for MCP server to be ready..."
sleep 10

# Check if the server is running
if docker-compose ps mcp-odoo-server | grep -q "Up"; then
    echo "✅ MCP Odoo server is running!"
    echo ""
    echo "📊 Server Status:"
    docker-compose ps mcp-odoo-server
    echo ""
    echo "🔗 MCP server is available at: http://localhost:3001"
    echo "📋 Resources available:"
    echo "   - odoo://models (list models)"
    echo "   - odoo://model/{model} (model info)"
    echo "   - odoo://search/{model}/{domain} (search records)"
    echo ""
    echo "🛠️  To use with Claude Desktop, add this to your config:"
    echo "   $(pwd)/mcp-config/claude_desktop_config.json"
else
    echo "❌ Failed to start MCP server"
    echo "📋 Check logs with: docker-compose logs mcp-odoo-server"
    exit 1
fi

echo ""
echo "✅ MCP Odoo server setup complete!"
echo ""
echo "💡 Next steps:"
echo "   1. Test the server: curl http://localhost:3001/health"
echo "   2. Use with Claude Desktop (see claude_desktop_config.json)"
echo "   3. Integrate with your application"
echo ""
echo "🔧 Management commands:"
echo "   - Start: docker-compose up -d"
echo "   - Stop: docker-compose down"
echo "   - Logs: docker-compose logs mcp-odoo-server"
echo "   - Restart: docker-compose restart mcp-odoo-server"
