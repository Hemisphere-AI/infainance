# Netlify Deployment Guide for Docker-based App

## 🚀 **Deployment Strategy**

Your app has 3 components:
1. **Frontend** (React/Vite) → Netlify Static Site
2. **Backend API** → Netlify Functions (already configured)
3. **MCP Odoo Server** → External service or Netlify Functions

## 📋 **Pre-Deployment Checklist**

### 1. Environment Variables Setup
You'll need these environment variables in Netlify:

```bash
# OpenAI Configuration
VITE_OPENAI_KEY=your_openai_api_key_here

# Supabase Configuration  
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth (if using)
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret

# Odoo Configuration (for Netlify Functions)
ODOO_URL=your_odoo_url
ODOO_DB=your_odoo_database
ODOO_USERNAME=your_odoo_username
ODOO_API_KEY=your_odoo_api_key

# Supabase Service Role (for backend functions)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Build Configuration
Your `netlify.toml` is already configured correctly for:
- ✅ Build command: `npm run build`
- ✅ Publish directory: `dist`
- ✅ Functions directory: `netlify/functions`
- ✅ API redirects configured

## 🚀 **Deployment Steps**

### Step 1: Prepare Your Repository

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for Netlify deployment"
git push origin main
```

### Step 2: Deploy to Netlify

#### Option A: Connect GitHub Repository (Recommended)

1. **Go to [netlify.com](https://netlify.com)**
2. **Click "New site from Git"**
3. **Connect your GitHub account**
4. **Select your `infainance` repository**
5. **Configure build settings:**
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`

#### Option B: Manual Deploy

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Drag and drop the `dist` folder to Netlify**

### Step 3: Configure Environment Variables

1. **Go to Site Settings → Environment Variables**
2. **Add all the environment variables listed above**
3. **Make sure to use the exact variable names**

### Step 4: Handle MCP Odoo Server

Since Netlify doesn't support Docker containers, you have two options:

#### Option A: Convert MCP Server to Netlify Function
Create a new Netlify function for the MCP server functionality.

#### Option B: Deploy MCP Server Separately
Deploy the MCP server to a service that supports Docker (like Railway, Render, or DigitalOcean).

## 🔧 **MCP Server Deployment Options**

### Option 1: Railway (Recommended for Docker)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy MCP server
railway up --dockerfile Dockerfile.mcp
```

### Option 2: Render
1. Connect your GitHub repo to Render
2. Select "Web Service"
3. Use `Dockerfile.mcp` as the Dockerfile
4. Set environment variables

### Option 3: DigitalOcean App Platform
1. Create a new app in DigitalOcean
2. Connect your GitHub repo
3. Select the MCP server directory
4. Use `Dockerfile.mcp`

## 🎯 **Quick Start Deployment**

### For Staging:
```bash
# Push to staging branch
git checkout staging
git merge main
git push origin staging
```

### For Production:
```bash
# Push to main branch  
git checkout main
git push origin main
```

## 🔍 **Post-Deployment Verification**

1. **Check Netlify Functions:**
   - Go to Functions tab in Netlify dashboard
   - Verify all functions are deployed

2. **Test API Endpoints:**
   ```bash
   # Test a Netlify function
   curl https://your-site.netlify.app/.netlify/functions/organizations
   ```

3. **Check Environment Variables:**
   - Go to Site Settings → Environment Variables
   - Verify all variables are set

4. **Test Frontend:**
   - Visit your Netlify URL
   - Check browser console for errors
   - Test the main functionality

## 🚨 **Common Issues & Solutions**

### Issue 1: Functions Not Working
**Solution:** Check that environment variables are set correctly in Netlify dashboard.

### Issue 2: Build Fails
**Solution:** Check build logs in Netlify dashboard for specific errors.

### Issue 3: MCP Server Connection
**Solution:** Make sure MCP server is deployed and accessible from Netlify functions.

## 📊 **Monitoring & Maintenance**

1. **Netlify Analytics:** Monitor site performance
2. **Function Logs:** Check function execution logs
3. **Environment Variables:** Keep them updated and secure

## 🔄 **Continuous Deployment**

Once set up, your deployment will be automatic:
- **Push to `staging`** → Deploys to staging environment
- **Push to `main`** → Deploys to production

## 🎉 **Success!**

Your app should now be live on Netlify with:
- ✅ Frontend deployed as static site
- ✅ Backend API as Netlify Functions  
- ✅ MCP server deployed separately
- ✅ All environment variables configured
- ✅ Automatic deployments from Git
