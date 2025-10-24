# Odoo API Key Authentication Setup

## 🔐 **Why Use API Keys?**

API key authentication is **more secure** than username/password because:
- ✅ **No password exposure** in logs or configuration files
- ✅ **Revocable** - you can disable API keys without changing passwords
- ✅ **Scoped permissions** - API keys can have limited access
- ✅ **Better for automation** - designed for programmatic access

## 🚀 **How to Get Your Odoo API Key**

### **Step 1: Access Odoo Developer Mode**
1. Log into your Odoo instance: `https://hemisphere1.odoo.com/`
2. Go to **Settings** → **General Settings**
3. Enable **Developer Mode** (if not already enabled)

### **Step 2: Create API Key**
1. Go to **Settings** → **Users & Companies** → **Users**
2. Click on your user account (`thomas@hemisphere.ai`)
3. Go to the **API Keys** tab
4. Click **Create API Key**
5. Give it a name (e.g., "MCP Integration")
6. Set appropriate permissions
7. **Copy the generated API key** (you won't see it again!)

### **Step 3: Configure Your Integration**

#### **Option A: Configuration File**
Update `odoo_config.json`:
```json
{
  "url": "https://hemisphere1.odoo.com/",
  "db": "hemisphere1",
  "api_key": "your-actual-api-key-here"
}
```

#### **Option B: Environment Variables**
Update your `.env` file:
```bash
ODOO_URL=https://hemisphere1.odoo.com/
ODOO_DB=hemisphere1
ODOO_API_KEY=your-actual-api-key-here
```

## 🔧 **Updated Configuration Files**

### **odoo_config.json** (API Key Method)
```json
{
  "url": "https://hemisphere1.odoo.com/",
  "db": "hemisphere1",
  "api_key": "your-odoo-api-key-here"
}
```

### **odoo.env** (Environment Variables)
```bash
# Odoo MCP Configuration - API Key Authentication
ODOO_URL=https://hemisphere1.odoo.com/
ODOO_DB=hemisphere1
ODOO_API_KEY=your-odoo-api-key-here
ODOO_TIMEOUT=30
ODOO_VERIFY_SSL=true
```

## 🧪 **Testing Your API Key**

### **Test Configuration**
```bash
# Activate virtual environment
source odoo-mcp-env/bin/activate

# Test with API key
python3 odoo_mcp_example.py
```

### **Expected Output**
```
Testing connection to: https://hemisphere1.odoo.com/
Database: hemisphere1
Authentication: API Key (recommended)
```

## 🔒 **Security Best Practices**

### **1. API Key Management**
- ✅ **Store securely** - Never commit API keys to git
- ✅ **Use environment variables** for production
- ✅ **Rotate regularly** - Create new keys periodically
- ✅ **Monitor usage** - Check API key access logs

### **2. Permissions**
- ✅ **Minimal permissions** - Only grant necessary access
- ✅ **Read-only when possible** - Use read-only keys for queries
- ✅ **Time-limited** - Set expiration dates if supported

### **3. Configuration Security**
- ✅ **Environment variables** - Use `.env` files (already in `.gitignore`)
- ✅ **Configuration files** - Keep `odoo_config.json` secure
- ✅ **No hardcoding** - Never put API keys in source code

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **"Invalid API Key"**
   - Check if the API key is correct
   - Verify the key hasn't expired
   - Ensure the key has proper permissions

2. **"Access Denied"**
   - Check API key permissions
   - Verify database name is correct
   - Ensure user has access to the database

3. **"Connection Timeout"**
   - Increase `ODOO_TIMEOUT` value
   - Check network connectivity
   - Verify Odoo instance is accessible

### **Debug Mode:**
```bash
export ODOO_DEBUG=true
python3 odoo_mcp_example.py
```

## 📚 **Migration from Username/Password**

If you're currently using username/password authentication:

1. **Create API Key** in Odoo
2. **Update Configuration**:
   ```json
   {
     "url": "https://hemisphere1.odoo.com/",
     "db": "hemisphere1",
     "api_key": "your-new-api-key"
   }
   ```
3. **Remove Username/Password** from configuration
4. **Test Connection** to ensure it works
5. **Revoke Old Credentials** if desired

## 🎯 **Next Steps**

1. **Get your API key** from Odoo
2. **Update configuration** with the API key
3. **Test the connection** using the example scripts
4. **Start using** the Odoo MCP integration!

---

**🔐 API key authentication is the recommended and most secure method for Odoo MCP integration!**
