# 🔧 **Organization Integration Fix**

## 🎯 **Problem Identified**

The error `Invalid Odoo URL: your_odoo_url_here/xmlrpc/2/object` indicates that the organization integration in your Supabase database still contains placeholder values instead of real Odoo credentials.

## 🔍 **Root Cause**

The application correctly fetches Odoo configuration from the `organization_integrations` table in Supabase, but the database records still contain placeholder values like:
- `odoo_url`: `your_odoo_url_here`
- `odoo_db`: `your-database-name`
- `odoo_username`: `your-username`
- `api_key`: `your-api-key`

## 🚀 **Step 1: Check Current Integration**

Run this command to see what's in your database:

```bash
cd /Users/thomasschijf/Documents/GitHub/infainance
node check-integrations.js
```

This will show you:
- ✅ **Good**: Real Odoo credentials in the database
- ⚠️ **Needs Update**: Placeholder values that need to be replaced

## 🔧 **Step 2: Update Supabase Database**

### **2.1 Access Supabase Dashboard**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Table Editor** → **organization_integrations**

### **2.2 Find Your Organization Record**
Look for records where:
- `integration_name` = `"odoo"`
- `is_active` = `true`
- `organization_id` = your organization ID

### **2.3 Update Placeholder Values**
Replace these placeholder values with your real Odoo credentials:

| Field | Current (Placeholder) | Update To (Real Value) |
|-------|----------------------|------------------------|
| `odoo_url` | `your_odoo_url_here` | `https://your-real-odoo-instance.com` |
| `odoo_db` | `your-database-name` | `your-real-database-name` |
| `odoo_username` | `your-username` | `your-real-username` |
| `api_key` | `your-api-key` | `your-real-api-key` |

### **2.4 Example Real Values**
```sql
-- Example of what your record should look like:
{
  "organization_id": "your-org-id",
  "integration_name": "odoo",
  "odoo_url": "https://mycompany.odoo.com",
  "odoo_db": "mycompany_production",
  "odoo_username": "admin",
  "api_key": "my-secret-api-key-123",
  "is_active": true
}
```

## 🧪 **Step 3: Test After Update**

### **3.1 Check Integration Again**
```bash
node check-integrations.js
```

**Expected output after fix:**
```
📊 Found 1 Odoo integration(s):
Integration 1:
  Organization ID: your-org-id
  Odoo URL: https://mycompany.odoo.com
  Database: mycompany_production
  Username: admin
  Has API Key: Yes
  Active: true
  ✅ Configuration looks good
✅ All integrations look good!
```

### **3.2 Test Netlify Function**
```bash
node test-netlify-function.js
```

**Expected output after fix:**
```
🧪 Starting Netlify Function test...
📦 Function handler loaded successfully
🚀 Calling function handler...
✅ Function executed successfully
🎉 Test PASSED - Function returned 200
```

## 🚀 **Step 4: Deploy to Production**

After successful local testing:

```bash
git add .
git commit -m "Fix organization integration Odoo configuration"
git push origin main
```

## 🔍 **Step 5: Verify Production**

### **5.1 Check Production Logs**
1. Go to Netlify Dashboard
2. Navigate to Functions → NetlifyOdooAiAgent
3. Look for these success messages:
   - ✅ `Using organization-specific Odoo config`
   - ✅ `Odoo authentication successful, UID: [number]`
   - ✅ `Search response received`

### **5.2 Test Production API**
```bash
curl -X POST "https://getzenith.ai/.netlify/functions/NetlifyOdooAiAgent" \
  -H "Content-Type: application/json" \
  -d '{
    "checkDescription": "Find all invoices",
    "checkTitle": "Invoice Check",
    "organizationId": "your-organization-id"
  }'
```

## 🎯 **Quick Fix Summary**

1. **Check**: `node check-integrations.js`
2. **Update**: Supabase → Table Editor → organization_integrations
3. **Test**: `node test-netlify-function.js`
4. **Deploy**: `git push origin main`

## 🚨 **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| `your_odoo_url_here` | Placeholder in database | Update `odoo_url` in Supabase |
| `your-database-name` | Placeholder in database | Update `odoo_db` in Supabase |
| `your-username` | Placeholder in database | Update `odoo_username` in Supabase |
| `your-api-key` | Placeholder in database | Update `api_key` in Supabase |
| No integrations found | Missing record | Create new organization_integrations record |

## 🎉 **Success Indicators**

- ✅ **No placeholder values** in organization_integrations table
- ✅ **Real Odoo credentials** in database
- ✅ **Local test passes** with real data
- ✅ **Production works** without URL errors

**The key is updating the Supabase database with your real Odoo credentials!** 🚀
