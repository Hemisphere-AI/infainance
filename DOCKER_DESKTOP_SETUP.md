# Docker Desktop Setup for Zenith Main Group

## Overview

This setup configures the Infainance application to run in Docker Desktop with proper grouping under the "zenith-main" project. All containers will be organized together in Docker Desktop's interface.

## Docker Desktop Grouping

### **Project Configuration**
- **Project Name**: `zenith-main`
- **Group**: `zenith-main`
- **Network**: `zenith-main-network`

### **Container Names**
- `zenith-main-mcp-odoo-server`
- `zenith-main-infainance-backend`
- `zenith-main-infainance-frontend`
- `zenith-main-infainance-frontend-dev` (development mode)

## Quick Start

### **1. Automated Setup**
```bash
./docker-desktop-setup.sh
```

This will:
- Check Docker Desktop is running
- Create environment file
- Update MCP configuration
- Choose deployment mode
- Start services with proper grouping
- Verify service status

### **2. Manual Setup**

#### **Production Mode**
```bash
export COMPOSE_PROJECT_NAME=zenith-main
docker-compose up -d mcp-odoo-server infainance-backend infainance-frontend
```

#### **Development Mode**
```bash
export COMPOSE_PROJECT_NAME=zenith-main
docker-compose --profile dev up -d mcp-odoo-server infainance-backend infainance-frontend-dev
```

#### **MCP Server Only**
```bash
export COMPOSE_PROJECT_NAME=zenith-main
docker-compose up -d mcp-odoo-server
```

## Docker Desktop Interface

### **What You'll See in Docker Desktop**

1. **Containers Tab**
   - All containers grouped under "zenith-main" project
   - Clear naming with "zenith-main-" prefix
   - Status indicators for each service

2. **Images Tab**
   - Built images for backend and frontend
   - MCP Odoo server image

3. **Networks Tab**
   - `zenith-main-network` bridge network
   - All containers connected to this network

4. **Volumes Tab**
   - Any persistent volumes for the application

### **Container Details**

#### **MCP Odoo Server**
- **Name**: `zenith-main-mcp-odoo-server`
- **Image**: `mcp/odoo:latest`
- **Port**: 3001
- **Purpose**: Consistent Odoo queries

#### **Backend API**
- **Name**: `zenith-main-infainance-backend`
- **Image**: Built from `./backend/Dockerfile`
- **Port**: 3002
- **Purpose**: Express.js API server

#### **Frontend (Production)**
- **Name**: `zenith-main-infainance-frontend`
- **Image**: Built from `Dockerfile.frontend`
- **Port**: 80
- **Purpose**: React app with Nginx

#### **Frontend (Development)**
- **Name**: `zenith-main-infainance-frontend-dev`
- **Image**: Built from `Dockerfile.frontend`
- **Port**: 5173
- **Purpose**: Vite dev server with hot reload

## Configuration

### **Environment Variables** (`.env`)
```bash
# Odoo Configuration
ODOO_URL=url
ODOO_DB=db
ODOO_USERNAME=email
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

### **Docker Compose Labels**
```yaml
labels:
  - "com.docker.compose.project=zenith-main"
  - "com.docker.compose.group=zenith-main"
  - "com.docker.compose.service=[service-name]"
```

## Usage

### **Starting Services**
```bash
# Set project name
export COMPOSE_PROJECT_NAME=zenith-main

# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d mcp-odoo-server infainance-backend

# Start development mode
docker-compose --profile dev up -d
```

### **Managing Services**
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### **Docker Desktop Management**
- **Start/Stop**: Use Docker Desktop interface
- **Logs**: Click on container to view logs
- **Terminal**: Access container shell
- **Settings**: Modify container configuration

## Network Configuration

### **Internal Communication**
- **Frontend → Backend**: `http://zenith-main-infainance-backend:3002`
- **Backend → MCP**: `http://zenith-main-mcp-odoo-server:3001`
- **Frontend → MCP**: `http://zenith-main-mcp-odoo-server:3001`

### **External Access**
- **Frontend**: `http://localhost` (production) or `http://localhost:5173` (development)
- **Backend**: `http://localhost:3002`
- **MCP Server**: `http://localhost:3001`

## Development Workflow

### **Hot Reload Development**
```bash
# Start development mode
export COMPOSE_PROJECT_NAME=zenith-main
docker-compose --profile dev up -d

# View development logs
docker-compose logs -f infainance-frontend-dev

# Restart development frontend
docker-compose restart infainance-frontend-dev
```

### **Code Changes**
- **Frontend**: Changes reflected immediately with hot reload
- **Backend**: Requires container restart
- **MCP Server**: Configuration changes require restart

### **Debugging**
```bash
# Access container shell
docker-compose exec [service-name] /bin/sh

# View container processes
docker-compose exec [service-name] ps aux

# Check network connectivity
docker-compose exec [service-name] ping [other-service]
```

## Monitoring

### **Health Checks**
```bash
# MCP server health
curl http://localhost:3001/health

# Backend health
curl http://localhost:3002/health

# Frontend
curl http://localhost/  # Production
curl http://localhost:5173/  # Development
```

### **Docker Desktop Monitoring**
- **Resource Usage**: View in Docker Desktop
- **Logs**: Real-time log viewing
- **Performance**: CPU and memory usage
- **Network**: Network traffic and connections

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
   docker network inspect zenith-main-network
   ```

4. **Build failures**
   ```bash
   # Rebuild without cache
   docker-compose build --no-cache
   
   # Rebuild specific service
   docker-compose build [service-name]
   ```

### **Docker Desktop Debugging**
- **Container Logs**: Use Docker Desktop interface
- **Container Shell**: Access via Docker Desktop
- **Resource Usage**: Monitor in Docker Desktop
- **Network**: Inspect network connections

## Production Considerations

### **Security**
- Use environment variables for secrets
- Enable SSL/TLS in production
- Configure firewall rules
- Regular security updates

### **Performance**
- Configure resource limits in Docker Desktop
- Use production-grade images
- Enable caching
- Monitor resource usage

### **Monitoring**
- Set up health checks
- Configure logging
- Monitor performance metrics
- Set up alerts

## Files Created

### **Docker Configuration**
- `docker-compose.yml` - Complete application stack with zenith-main grouping
- `backend/Dockerfile` - Backend container
- `Dockerfile.frontend` - Frontend container
- `nginx.conf` - Nginx configuration

### **Setup Scripts**
- `docker-desktop-setup.sh` - Docker Desktop specific setup
- `docker-setup.sh` - General Docker setup

### **Configuration**
- `mcp-config/odoo_config.json` - MCP server config
- `mcp-config/claude_desktop_config.json` - Claude Desktop integration

### **Documentation**
- `DOCKER_DESKTOP_SETUP.md` - This documentation
- `FULL_DOCKER_SETUP.md` - Complete Docker setup
- `MCP_DOCKER_SETUP.md` - MCP server documentation

## Next Steps

1. **Run the setup script** to start the zenith-main group
2. **Open Docker Desktop** to see the organized containers
3. **Test the application** URLs
4. **Configure your environment** variables
5. **Monitor performance** in Docker Desktop
6. **Set up development workflow** with hot reload

The Docker Desktop setup provides a clean, organized interface for managing the Infainance application with proper grouping under the "zenith-main" project.
