# Unified Development & Production Setup

This project now uses a unified approach where both development and production use the same Netlify Functions architecture.

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Option 1: Traditional development (Express + Vite)
npm run dev  # Terminal 1: Starts Vite dev server (port 5173)
cd backend && npm start  # Terminal 2: Starts Express server (port 3002)

# Option 2: Netlify Functions development (if you have Netlify CLI set up)
npm run dev:netlify
```

### Production
```bash
# Build and deploy
npm run build
npm run deploy
```

## How It Works

### Development Mode
- **Option 1 - Express + Vite**: 
  - Frontend: `http://localhost:5173` (Vite dev server)
  - Backend: `http://localhost:3002` (Express server)
  - API calls go to Express server
- **Option 2 - Netlify Dev**: 
  - Frontend: `http://localhost:8888` (Vite dev server)
  - Functions: `http://localhost:8888/.netlify/functions/*`
  - Same API as production

### Production Mode
- **Frontend**: Static files served from `/dist`
- **Functions**: Serverless functions on Netlify
- **Same API**: Identical function code

## Key Benefits

1. **Single Codebase**: No more dual backend maintenance
2. **Identical Environments**: Dev and prod use same functions
3. **Easy Deployment**: Just `npm run deploy`
4. **No Server Management**: Serverless functions handle everything
5. **Automatic Scaling**: Netlify handles scaling

## API Configuration

The frontend automatically detects the environment:

```javascript
// src/config/api.js
const isNetlifyDev = window.location.port === '8888';
const API_BASE = isNetlifyDev ? 'http://localhost:8888' : '';
```

This works by detecting the port number:
- **Port 8888**: Netlify Dev (uses localhost:8888 for API calls)
- **Port 5173**: Regular Vite dev (uses localhost:3002 for API calls)
- **Production**: Uses relative URLs (Netlify Functions)

## Migration from Express Server

The old Express server (`/backend/server.js`) is no longer needed for development. All functionality has been moved to Netlify Functions:

- ✅ Organization management
- ✅ Odoo integration
- ✅ MCP services
- ✅ Check execution
- ✅ Database operations

## Troubleshooting

### Functions Not Working in Dev
Make sure you're using `npm run dev:netlify` instead of `npm run dev`.

### Environment Variables
Set up your environment variables in Netlify dashboard or use `.env` file locally.

### CORS Issues
All functions include proper CORS headers for cross-origin requests.

## Next Steps

1. Test the unified setup: `npm run dev:netlify`
2. Verify all API endpoints work
3. Deploy to production: `npm run deploy`
4. Remove old Express server files (optional cleanup)
