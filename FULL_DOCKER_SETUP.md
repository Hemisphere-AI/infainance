# Complete Infainance Docker Setup

## Overview

This setup provides a complete Docker containerization of the Infainance application stack, including:

- **MCP Odoo Server** - Reliable Odoo queries with consistency playbook
- **Backend API** - Node.js Express server with Odoo integration
- **Frontend Application** - React/Vite application with Nginx
- **Development Mode** - Hot reload for development

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │  MCP Odoo       │
│   (Nginx)       │◄───┤   (Node.js)     │◄───┤  Server         │
│   Port: 80      │    │   Port: 3002    │    │  Port: 3001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### **1. Automated Setup**
```bash
./docker-setup.sh
```

This will:
- Check Docker installation
- Create environment file
- Update MCP configuration
- Choose deployment mode
- Start all services
- Verify service status

### **2. Manual Setup**

#### **Production Mode**
```bash
# Start full production stack
docker-compose up -d mcp-odoo-server infainance-backend infainance-frontend
```

#### **Development Mode**
```bash
# Start with hot reload
docker-compose --profile dev up -d mcp-odoo-server infainance-backend infainance-frontend-dev
```

#### **MCP Server Only**
```bash
# Start only MCP server
docker-compose up -d mcp-odoo-server
```

## Services

### **1. MCP Odoo Server**
- **Image**: `mcp/odoo:latest`
- **Port**: 3001
- **Purpose**: Provides consistent Odoo queries
- **Health**: `curl http://localhost:3001/health`

### **2. Backend API**
- **Build**: `./backend/Dockerfile`
- **Port**: 3002
- **Purpose**: Express.js API server
- **Health**: `curl http://localhost:3002/health`

### **3. Frontend (Production)**
- **Build**: `Dockerfile.frontend`
- **Port**: 80
- **Purpose**: React app with Nginx
- **URL**: `http://localhost`

### **4. Frontend (Development)**
- **Build**: `Dockerfile.frontend`
- **Port**: 5173
- **Purpose**: Vite dev server with hot reload
- **URL**: `http://localhost:5173`

## Configuration

### **Environment Variables** (`.env`)
```bash
# Odoo Configuration
ODOO_URL=https://hemisphere1.odoo.com
ODOO_DB=hemisphere1
ODOO_USERNAME=thomas@hemisphere.ai
ODOO_PASSWORD=your_api_key_here
ODOO_TIMEOUT=30
ODOO_VERIFY_SSL=true

# OpenAI Configuration
VITE_OPENAI_KEY=your_openai_api_key_here

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Application Configuration
NODE_ENV=production
PORT=3002
```

### **MCP Configuration** (`mcp-config/odoo_config.json`)
```json
{
  "url": "https://hemisphere1.odoo.com",
  "db": "hemisphere1",
  "username": "thomas@hemisphere.ai",
  "password": "your_api_key_here",
  "timeout": 30,
  "verify_ssl": true
}
```

## Usage

### **Production Deployment**
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs

# Stop services
docker-compose down
```

### **Development Deployment**
```bash
# Start with hot reload
docker-compose --profile dev up -d

# View dev logs
docker-compose logs infainance-frontend-dev

# Restart dev frontend
docker-compose restart infainance-frontend-dev
```

### **Individual Services**
```bash
# Start only MCP server
docker-compose up -d mcp-odoo-server

# Start backend and MCP
docker-compose up -d mcp-odoo-server infainance-backend

# Start specific service
docker-compose up -d [service-name]
```

## API Endpoints

### **MCP Server** (Port 3001)
```
GET  /health                           # Health check
GET  /odoo://models                    # List models
GET  /odoo://model/{model}             # Model info
GET  /odoo://search/{model}/{domain}   # Search records
```

### **Backend API** (Port 3002)
```
GET  /health                           # Health check
POST /api/odoo/execute                 # Execute Odoo queries
GET  /api/odoo/test                    # Test Odoo connection
```

### **Frontend** (Port 80 or 5173)
```
GET  /                                 # Main application
GET  /api/*                            # Proxied to backend
GET  /mcp/*                            # Proxied to MCP server
```

## Network Configuration

### **Internal Network**
- **Name**: `infainance-network`
- **Type**: Bridge
- **Services**: All containers can communicate

### **Port Mapping**
- **Frontend**: 80 → 80 (production), 5173 → 5173 (development)
- **Backend**: 3002 → 3002
- **MCP Server**: 3001 → 3001

### **Service Communication**
- Frontend → Backend: `http://infainance-backend:3002`
- Backend → MCP: `http://mcp-odoo-server:3001`
- Frontend → MCP: `http://mcp-odoo-server:3001`

## Development

### **Hot Reload Setup**
```bash
# Start development mode
docker-compose --profile dev up -d

# View logs with hot reload
docker-compose logs -f infainance-frontend-dev

# Restart development frontend
docker-compose restart infainance-frontend-dev
```

### **Code Changes**
- **Frontend**: Changes are reflected immediately
- **Backend**: Requires container restart
- **MCP Server**: Configuration changes require restart

### **Debugging**
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs [service-name]

# Follow logs in real-time
docker-compose logs -f [service-name]

# Execute commands in container
docker-compose exec [service-name] /bin/sh
```

## Monitoring

### **Health Checks**
```bash
# Check all services
curl http://localhost:3001/health  # MCP server
curl http://localhost:3002/health  # Backend
curl http://localhost/             # Frontend
```

### **Service Status**
```bash
# Check running containers
docker-compose ps

# Check resource usage
docker stats

# Check logs
docker-compose logs --tail=100
```

## Troubleshooting

### **Common Issues**

1. **Services won't start**
   ```bash
   # Check logs
   docker-compose logs [service-name]
   
   # Check environment variables
   docker-compose exec [service-name] env | grep ODOO
   ```

2. **Port conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep :3001
   netstat -tulpn | grep :3002
   netstat -tulpn | grep :80
   ```

3. **Network issues**
   ```bash
   # Check network
   docker network ls
   docker network inspect infainance-network
   ```

4. **Build failures**
   ```bash
   # Rebuild without cache
   docker-compose build --no-cache
   
   # Rebuild specific service
   docker-compose build [service-name]
   ```

### **Debug Commands**
```bash
# Enter container shell
docker-compose exec [service-name] /bin/sh

# Check container processes
docker-compose exec [service-name] ps aux

# Check network connectivity
docker-compose exec [service-name] ping [other-service]
```

## Files Created

### **Docker Configuration**
- `docker-compose.yml` - Complete application stack
- `backend/Dockerfile` - Backend container
- `Dockerfile.frontend` - Frontend container
- `nginx.conf` - Nginx configuration

### **Setup Scripts**
- `docker-setup.sh` - Automated setup script
- `mcp-setup.sh` - MCP server only setup

### **Configuration**
- `mcp-config/odoo_config.json` - MCP server config
- `mcp-config/claude_desktop_config.json` - Claude Desktop integration

### **Documentation**
- `FULL_DOCKER_SETUP.md` - This documentation
- `MCP_DOCKER_SETUP.md` - MCP server documentation

## Production Considerations

### **Security**
- Use environment variables for secrets
- Enable SSL/TLS in production
- Configure firewall rules
- Regular security updates

### **Performance**
- Configure resource limits
- Use production-grade images
- Enable caching
- Monitor resource usage

### **Monitoring**
- Set up health checks
- Configure logging
- Monitor performance metrics
- Set up alerts

## Next Steps

1. **Test the complete stack** with the setup script
2. **Configure your environment** variables
3. **Deploy to production** with proper security
4. **Monitor performance** and adjust as needed
5. **Set up CI/CD** for automated deployments

The complete Docker setup provides a production-ready, scalable solution for the Infainance application with reliable Odoo integration through the MCP server.
