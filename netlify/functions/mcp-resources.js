import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Mock MCP resources for now
    const resources = [
      { name: 'odoo_models', description: 'Available Odoo models' },
      { name: 'odoo_records', description: 'Odoo record data' },
      { name: 'odoo_config', description: 'Odoo configuration' }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        resources,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Failed to list MCP resources:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};
