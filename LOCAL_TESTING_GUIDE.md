# 🧪 **Local Testing Guide for Netlify Functions**

## 🎯 **Problem Solved**

The error `Failed to parse URL from your_odoo_url_here/xmlrpc/2/common` indicates that the Odoo URL is still set to a placeholder value. This guide helps you test locally before deploying.

## 🚀 **Step 1: Set Up Test Configuration**

### **1.1 Update Test Configuration**
Edit `test-config.js` and replace the placeholder values:

```javascript
module.exports = {
  // REPLACE THESE WITH YOUR REAL ODOO VALUES
  ODOO_URL: 'https://your-actual-odoo-instance.com',  // ← Change this
  ODOO_DB: 'your-actual-database-name',             // ← Change this  
  ODOO_USERNAME: 'your-actual-username',            // ← Change this
  ODOO_API_KEY: 'your-actual-api-key',              // ← Change this
  
  // Keep these as they are for testing
  VITE_SUPABASE_URL: 'https://your-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'your-supabase-anon-key',
  VITE_OPENAI_KEY: 'your-openai-key',
  NODE_ENV: 'development',
  NETLIFY: 'true'
};
```

### **1.2 Example Real Configuration**
```javascript
module.exports = {
  ODOO_URL: 'https://mycompany.odoo.com',
  ODOO_DB: 'mycompany_production',
  ODOO_USERNAME: 'admin',
  ODOO_API_KEY: 'my-secret-api-key-123',
  // ... other config
};
```

## 🧪 **Step 2: Test Locally**

### **2.1 Run Local Test**
```bash
cd /Users/thomasschijf/Documents/GitHub/infainance
node test-netlify-function.js
```

### **2.2 Expected Output (Success)**
```
🧪 Starting Netlify Function test...
📦 Function handler loaded successfully
🚀 Calling function handler...
✅ Function executed successfully
📊 Result: {
  "statusCode": 200,
  "body": "{\"success\":true,\"data\":[...]}"
}
🎉 Test PASSED - Function returned 200
```

### **2.3 Expected Output (URL Error)**
```
🧪 Starting Netlify Function test...
📦 Function handler loaded successfully
🚀 Calling function handler...
💥 Test FAILED with error: Invalid Odoo URL: your_odoo_url_here/xmlrpc/2/object. Please set a real Odoo URL in your environment variables.
```

## 🔧 **Step 3: Fix Common Issues**

### **3.1 Invalid URL Error**
**Error**: `Invalid Odoo URL: your_odoo_url_here/xmlrpc/2/object`

**Fix**: Update `test-config.js` with real Odoo URL:
```javascript
ODOO_URL: 'https://your-real-odoo-instance.com'  // No trailing slash
```

### **3.2 Authentication Error**
**Error**: `Odoo authentication failed: 401 Unauthorized`

**Fix**: Check your credentials in `test-config.js`:
```javascript
ODOO_DB: 'your-real-database-name',      // Must match Odoo database
ODOO_USERNAME: 'your-real-username',    // Must be valid Odoo user
ODOO_API_KEY: 'your-real-api-key'       // Must be valid API key
```

### **3.3 Network Error**
**Error**: `Failed to fetch` or `Connection refused`

**Fix**: 
1. Check if Odoo URL is accessible: `curl https://your-odoo-instance.com`
2. Verify Odoo instance is running
3. Check firewall/network settings

## 📊 **Step 4: Test Results Analysis**

### **4.1 Successful Test**
```
✅ Function executed successfully
📊 Result: {
  "statusCode": 200,
  "body": "{\"success\":true,\"count\":5,\"records\":[...]}"
}
🎉 Test PASSED - Function returned 200
```

**Meaning**: Your Odoo configuration is correct and the function works locally.

### **4.2 Failed Test**
```
💥 Test FAILED with error: [specific error message]
```

**Meaning**: There's an issue with your configuration or Odoo instance.

## 🚀 **Step 5: Deploy After Successful Test**

### **5.1 Update Production Environment**
After local test passes, update your Netlify environment variables:

```bash
# Set real Odoo values in Netlify
netlify env:set ODOO_URL "https://your-real-odoo-instance.com"
netlify env:set ODOO_DB "your-real-database-name"
netlify env:set ODOO_USERNAME "your-real-username"
netlify env:set ODOO_API_KEY "your-real-api-key"
```

### **5.2 Deploy to Production**
```bash
git add .
git commit -m "Fix Odoo URL configuration"
git push origin main
```

## 🔍 **Step 6: Verify Production Deployment**

### **6.1 Check Production Logs**
1. Go to Netlify Dashboard
2. Navigate to Functions → NetlifyOdooAiAgent
3. Check the logs for:
   - ✅ `Using fetch-based Odoo API calls`
   - ✅ `Odoo authentication successful, UID: [number]`
   - ✅ `Search response received`

### **6.2 Test Production API**
```bash
curl -X POST "https://getzenith.ai/.netlify/functions/NetlifyOdooAiAgent" \
  -H "Content-Type: application/json" \
  -d '{
    "checkDescription": "Find all invoices",
    "checkTitle": "Invoice Check",
    "organizationId": "your-organization-id"
  }'
```

## 🎯 **Quick Fix Commands**

### **Fix URL Issue**
```bash
# 1. Update test config
nano test-config.js

# 2. Test locally
node test-netlify-function.js

# 3. If successful, update Netlify
netlify env:set ODOO_URL "https://your-real-odoo-instance.com"
netlify env:set ODOO_DB "your-real-database-name"
netlify env:set ODOO_USERNAME "your-real-username"
netlify env:set ODOO_API_KEY "your-real-api-key"

# 4. Deploy
git add . && git commit -m "Fix Odoo configuration" && git push origin main
```

## 🎉 **Success Indicators**

- ✅ **Local test passes** - No URL or authentication errors
- ✅ **Real Odoo data** - Actual records returned
- ✅ **Production works** - No more placeholder URL errors
- ✅ **Fast responses** - Under 8 seconds

## 🚨 **Common Issues & Solutions**

| Issue | Error Message | Solution |
|-------|---------------|----------|
| Placeholder URL | `your_odoo_url_here` | Update `test-config.js` with real URL |
| Invalid URL | `Invalid URL format` | Check URL format (no trailing slash) |
| Auth Failed | `401 Unauthorized` | Verify credentials in `test-config.js` |
| Network Error | `Failed to fetch` | Check Odoo instance accessibility |

**The key is to test locally first, then deploy with confidence!** 🚀
