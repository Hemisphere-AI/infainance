# Railway GitHub Deployment Guide

## 🚀 **Deployment Steps (Since Railway is Connected to GitHub)**

### **Step 1: Configure Service in Railway Dashboard**

1. **Go to your Railway project dashboard**
2. **Click "New Service" → "GitHub Repo"**
3. **Select your `infainance` repository**
4. **Configure the service:**

#### **Service Configuration:**
- **Service Name:** `mcp-odoo-server`
- **Root Directory:** `/` (root of repository)
- **Dockerfile Path:** `Dockerfile.mcp`
- **Port:** `3001` (automatically detected)

### **Step 2: Set Environment Variables**

In Railway dashboard → Variables tab, add these environment variables:

```bash
ODOO_URL=your_odoo_url_here
ODOO_DB=your_odoo_database_here
ODOO_USERNAME=your_odoo_username_here
ODOO_API_KEY=your_odoo_api_key_here
ODOO_TIMEOUT=30
ODOO_VERIFY_SSL=true
```

### **Step 3: Configure Deployment Settings**

#### **Deployment Configuration:**
- **Branch:** `main` (or `staging`)
- **Auto-deploy:** ✅ Enable
- **Build Command:** (leave empty - uses Dockerfile)
- **Start Command:** (leave empty - uses Dockerfile CMD)

### **Step 4: Deploy**

1. **Click "Deploy"** in Railway dashboard
2. **Monitor the deployment logs**
3. **Wait for deployment to complete**

### **Step 5: Get Service URL**

After successful deployment:
1. **Go to your service dashboard**
2. **Copy the generated URL** (e.g., `https://mcp-odoo-server-production-xxxx.up.railway.app`)
3. **Test the health endpoint:** `https://your-url/health`

## 🔧 **Post-Deployment Configuration**

### **Step 1: Update Netlify Environment Variables**

In Netlify dashboard → Site Settings → Environment Variables:

```bash
MCP_SERVER_URL=https://your-railway-url.up.railway.app
```

### **Step 2: Update Netlify Functions**

The Netlify functions should automatically use the `MCP_SERVER_URL` environment variable.

### **Step 3: Test the Integration**

1. **Test MCP Server:**
   ```bash
   curl https://your-railway-url.up.railway.app/health
   ```

2. **Test Netlify Function:**
   ```bash
   curl https://your-netlify-site.netlify.app/.netlify/functions/NetlifyOdooAiAgent
   ```

## 🔍 **Monitoring and Logs**

### **Railway Dashboard:**
- **Logs:** View real-time logs
- **Metrics:** Monitor CPU, memory, network
- **Deployments:** View deployment history

### **Health Checks:**
- **Health endpoint:** `/health`
- **Status:** Should return `{"status": "healthy"}`

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **Build Fails:**
   - Check Railway logs for build errors
   - Verify Dockerfile.mcp is correct
   - Ensure all dependencies are in requirements

2. **Service Won't Start:**
   - Check environment variables are set
   - Verify Odoo credentials are correct
   - Check service logs for errors

3. **Health Check Fails:**
   - Verify the `/health` endpoint is working
   - Check if the service is actually running
   - Review Railway logs for errors

### **Debug Commands:**
```bash
# View logs
railway logs

# Check service status
railway status

# View environment variables
railway variables
```

## 📊 **Expected Results**

✅ **Railway service deployed successfully**
✅ **Health endpoint responding**
✅ **MCP server accessible from Netlify**
✅ **Full integration working**

## 🔄 **Updates**

### **Automatic Updates:**
- Railway will automatically redeploy when you push to the configured branch
- No manual intervention needed

### **Manual Updates:**
- Push changes to your repository
- Railway will detect changes and redeploy automatically

## 🎯 **Success Indicators**

1. **Railway service shows "Running" status**
2. **Health endpoint returns 200 OK**
3. **Netlify functions can connect to Railway service**
4. **Full application works end-to-end**

## 📋 **Next Steps After Deployment**

1. **Get the Railway service URL**
2. **Update Netlify environment variables**
3. **Test the complete integration**
4. **Monitor performance and logs**
