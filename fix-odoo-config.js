#!/usr/bin/env node

/**
 * Quick Odoo Configuration Fix
 * This script helps you update the test configuration with real Odoo values
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Odoo Configuration Fix');
console.log('==========================');
console.log('');
console.log('You need to replace the placeholder Odoo URL with your real Odoo instance URL.');
console.log('');
console.log('Current error: "Invalid Odoo URL: your_odoo_url_here/xmlrpc/2/object"');
console.log('');
console.log('📝 To fix this, you need to:');
console.log('');
console.log('1. Edit test-config.js and replace these values:');
console.log('   ODOO_URL: "https://your-actual-odoo-instance.com"');
console.log('   ODOO_DB: "your-actual-database-name"');
console.log('   ODOO_USERNAME: "your-actual-username"');
console.log('   ODOO_API_KEY: "your-actual-api-key"');
console.log('');
console.log('2. Example real configuration:');
console.log('   ODOO_URL: "https://mycompany.odoo.com"');
console.log('   ODOO_DB: "mycompany_production"');
console.log('   ODOO_USERNAME: "admin"');
console.log('   ODOO_API_KEY: "my-secret-api-key-123"');
console.log('');
console.log('3. After updating, test locally:');
console.log('   node test-netlify-function.js');
console.log('');
console.log('4. If test passes, update Netlify environment:');
console.log('   netlify env:set ODOO_URL "https://your-real-odoo-instance.com"');
console.log('   netlify env:set ODOO_DB "your-real-database-name"');
console.log('   netlify env:set ODOO_USERNAME "your-real-username"');
console.log('   netlify env:set ODOO_API_KEY "your-real-api-key"');
console.log('');
console.log('5. Deploy to production:');
console.log('   git add . && git commit -m "Fix Odoo configuration" && git push origin main');
console.log('');
console.log('❓ Do you have your Odoo credentials ready?');
console.log('   - Odoo instance URL (e.g., https://mycompany.odoo.com)');
console.log('   - Database name');
console.log('   - Username');
console.log('   - API key');
console.log('');
console.log('If yes, edit test-config.js and run the test!');
