/**
 * Test configuration for local Netlify Functions testing
 * This file contains test environment variables
 */

module.exports = {
  // Test Odoo Configuration - REPLACE WITH YOUR REAL VALUES
  ODOO_URL: 'https://your-odoo-instance.com',  // Replace with your actual Odoo URL
  ODOO_DB: 'your-database-name',              // Replace with your actual database name
  ODOO_USERNAME: 'your-username',             // Replace with your actual username
  ODOO_API_KEY: 'your-api-key',               // Replace with your actual API key
  
  // Supabase Configuration
  VITE_SUPABASE_URL: 'https://your-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'your-supabase-anon-key',
  
  // OpenAI Configuration
  VITE_OPENAI_KEY: 'your-openai-key',
  
  // Development
  NODE_ENV: 'development',
  NETLIFY: 'true'
};

/**
 * INSTRUCTIONS:
 * 1. Replace the placeholder values above with your real Odoo credentials
 * 2. Run: node test-netlify-function.js
 * 3. Check the output for any errors
 * 4. If successful, deploy to production
 */
