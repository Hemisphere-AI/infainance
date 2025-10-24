#!/bin/bash

# Railway Deployment Script for MCP Odoo Server
# Run this script after completing Railway login

echo "🚀 Deploying MCP Odoo Server to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Please run: railway login"
    exit 1
fi

echo "✅ Railway CLI ready"

# Create new Railway project
echo "📦 Creating Railway project..."
railway project new --name "mcp-odoo-server"

# Set environment variables
echo "🔧 Setting environment variables..."
railway variables set ODOO_URL="$ODOO_URL"
railway variables set ODOO_DB="$ODOO_DB" 
railway variables set ODOO_USERNAME="$ODOO_USERNAME"
railway variables set ODOO_API_KEY="$ODOO_API_KEY"
railway variables set ODOO_TIMEOUT="30"
railway variables set ODOO_VERIFY_SSL="true"

# Deploy the service
echo "🚀 Deploying MCP Odoo Server..."
railway up --dockerfile Dockerfile.mcp

echo "✅ Deployment initiated!"
echo "📋 Next steps:"
echo "1. Check Railway dashboard for deployment status"
echo "2. Get the service URL from Railway"
echo "3. Update Netlify functions to use the new MCP server URL"
echo "4. Test the integration"
