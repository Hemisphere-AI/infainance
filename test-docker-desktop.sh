#!/bin/bash

# Test Docker Desktop Setup for Zenith Main Group
# This script tests the Docker Desktop setup and verifies all services are running

echo "🧪 Testing Zenith Main Group in Docker Desktop"
echo "============================================="

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker Desktop is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker Desktop is running"

# Set project name
export COMPOSE_PROJECT_NAME=zenith-main

# Check if services are running
echo ""
echo "📊 Checking Zenith Main Group Status:"
echo "===================================="

# Check MCP server
if docker-compose ps mcp-odoo-server | grep -q "Up"; then
    echo "✅ MCP Odoo server: Running (zenith-main-mcp-odoo-server)"
    MCP_STATUS="UP"
else
    echo "❌ MCP Odoo server: Not running"
    MCP_STATUS="DOWN"
fi

# Check backend
if docker-compose ps infainance-backend | grep -q "Up"; then
    echo "✅ Backend API: Running (zenith-main-infainance-backend)"
    BACKEND_STATUS="UP"
else
    echo "❌ Backend API: Not running"
    BACKEND_STATUS="DOWN"
fi

# Check frontend
if docker-compose ps infainance-frontend | grep -q "Up"; then
    echo "✅ Frontend: Running (zenith-main-infainance-frontend)"
    FRONTEND_STATUS="UP"
    FRONTEND_PORT="80"
elif docker-compose ps infainance-frontend-dev | grep -q "Up"; then
    echo "✅ Frontend (Dev): Running (zenith-main-infainance-frontend-dev)"
    FRONTEND_STATUS="UP"
    FRONTEND_PORT="5173"
else
    echo "❌ Frontend: Not running"
    FRONTEND_STATUS="DOWN"
fi

echo ""
echo "🌐 Testing Application URLs:"
echo "============================"

# Test MCP server
if [ "$MCP_STATUS" = "UP" ]; then
    echo "🔧 Testing MCP Server (http://localhost:3001/health)..."
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "✅ MCP Server: Responding"
    else
        echo "❌ MCP Server: Not responding"
    fi
else
    echo "⏭️  Skipping MCP Server test (not running)"
fi

# Test backend
if [ "$BACKEND_STATUS" = "UP" ]; then
    echo "🔧 Testing Backend API (http://localhost:3002/health)..."
    if curl -s http://localhost:3002/health > /dev/null; then
        echo "✅ Backend API: Responding"
    else
        echo "❌ Backend API: Not responding"
    fi
else
    echo "⏭️  Skipping Backend API test (not running)"
fi

# Test frontend
if [ "$FRONTEND_STATUS" = "UP" ]; then
    if [ "$FRONTEND_PORT" = "80" ]; then
        echo "🔧 Testing Frontend (http://localhost)..."
        if curl -s http://localhost/ > /dev/null; then
            echo "✅ Frontend: Responding"
        else
            echo "❌ Frontend: Not responding"
        fi
    elif [ "$FRONTEND_PORT" = "5173" ]; then
        echo "🔧 Testing Frontend Dev (http://localhost:5173)..."
        if curl -s http://localhost:5173/ > /dev/null; then
            echo "✅ Frontend Dev: Responding"
        else
            echo "❌ Frontend Dev: Not responding"
        fi
    fi
else
    echo "⏭️  Skipping Frontend test (not running)"
fi

echo ""
echo "🐳 Docker Desktop Information:"
echo "=============================="
echo "📦 Project Name: zenith-main"
echo "📦 Group: zenith-main"
echo "📦 Network: zenith-main-network"
echo ""
echo "🔍 In Docker Desktop, you should see:"
echo "   - zenith-main-mcp-odoo-server"
echo "   - zenith-main-infainance-backend"
echo "   - zenith-main-infainance-frontend (or -dev)"
echo "   - zenith-main-network"

echo ""
echo "📊 Summary:"
echo "==========="
if [ "$MCP_STATUS" = "UP" ] && [ "$BACKEND_STATUS" = "UP" ] && [ "$FRONTEND_STATUS" = "UP" ]; then
    echo "✅ All services are running successfully!"
    echo "🎉 Zenith Main group is fully operational"
else
    echo "⚠️  Some services are not running:"
    if [ "$MCP_STATUS" = "DOWN" ]; then
        echo "   - MCP Odoo server"
    fi
    if [ "$BACKEND_STATUS" = "DOWN" ]; then
        echo "   - Backend API"
    fi
    if [ "$FRONTEND_STATUS" = "DOWN" ]; then
        echo "   - Frontend"
    fi
    echo ""
    echo "💡 To start services:"
    echo "   ./docker-desktop-setup.sh"
fi

echo ""
echo "🔧 Management Commands:"
echo "======================"
echo "docker-compose ps                                    # Check status"
echo "docker-compose logs [service]                        # View logs"
echo "docker-compose restart [service]                     # Restart service"
echo "docker-compose down                                  # Stop all services"
echo "docker-compose up -d                                 # Start all services"

echo ""
echo "✅ Test completed!"
