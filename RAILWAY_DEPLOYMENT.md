# Railway Deployment Guide for MCP Odoo Server

## 🚀 **Quick Deployment Steps**

### **Step 1: Complete Railway Login (Manual)**
```bash
# You need to run this manually in your terminal
railway login
```
- This will open a browser for authentication
- Complete the login process
- Return to terminal when done

### **Step 2: Set Environment Variables (Manual)**
Before deploying, set these environment variables in your shell:
```bash
export ODOO_URL="your_odoo_url_here"
export ODOO_DB="your_odoo_database_here"
export ODOO_USERNAME="your_odoo_username_here"
export ODOO_API_KEY="your_odoo_api_key_here"
```

### **Step 3: Run Deployment Script**
```bash
# Run the automated deployment script
./railway-deploy.sh
```

## 🔧 **Manual Deployment (Alternative)**

If the script doesn't work, follow these manual steps:

### **1. Create Railway Project**
```bash
railway project new --name "mcp-odoo-server"
```

### **2. Set Environment Variables**
```bash
railway variables set ODOO_URL="$ODOO_URL"
railway variables set ODOO_DB="$ODOO_DB"
railway variables set ODOO_USERNAME="$ODOO_USERNAME"
railway variables set ODOO_API_KEY="$ODOO_API_KEY"
railway variables set ODOO_TIMEOUT="30"
railway variables set ODOO_VERIFY_SSL="true"
```

### **3. Deploy Service**
```bash
railway up --dockerfile Dockerfile.mcp
```

## 📋 **Post-Deployment Steps**

### **1. Get Service URL**
After deployment, Railway will provide a URL like:
```
https://mcp-odoo-server-production-xxxx.up.railway.app
```

### **2. Update Netlify Functions**
Update your Netlify functions to use the new MCP server URL:

In `netlify/functions/NetlifyOdooAiAgent.js`:
```javascript
// Update the MCP server URL
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://your-railway-url.up.railway.app';
```

### **3. Set Netlify Environment Variables**
In Netlify dashboard → Site Settings → Environment Variables:
```bash
MCP_SERVER_URL=https://your-railway-url.up.railway.app
```

## 🔍 **Testing the Deployment**

### **1. Test MCP Server**
```bash
curl https://your-railway-url.up.railway.app/health
```

### **2. Test Netlify Functions**
```bash
curl https://your-netlify-site.netlify.app/.netlify/functions/NetlifyOdooAiAgent
```

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **Railway Login Fails**
   - Make sure you have a Railway account
   - Try `railway logout` then `railway login` again

2. **Environment Variables Not Set**
   - Check Railway dashboard → Variables tab
   - Make sure all required variables are set

3. **Deployment Fails**
   - Check Railway logs: `railway logs`
   - Verify Dockerfile.mcp exists and is correct

4. **MCP Server Not Responding**
   - Check Railway service status
   - Verify environment variables are correct
   - Test with curl: `curl https://your-url/health`

## 📊 **Monitoring**

### **Railway Dashboard**
- Go to Railway dashboard
- Select your project
- Monitor logs and metrics
- Check service health

### **Logs**
```bash
# View real-time logs
railway logs

# View specific service logs
railway logs --service mcp-odoo-server
```

## 🎯 **Success Indicators**

✅ **Railway deployment successful**
✅ **MCP server responding to health checks**
✅ **Netlify functions can connect to MCP server**
✅ **Full application working end-to-end**

## 🔄 **Updates and Maintenance**

### **Redeploy After Changes**
```bash
# After making changes to the MCP server
railway up --dockerfile Dockerfile.mcp
```

### **Update Environment Variables**
```bash
# Update a variable
railway variables set ODOO_URL="new_url"
```

### **Scale Service**
```bash
# Scale to multiple instances
railway scale 2
```
