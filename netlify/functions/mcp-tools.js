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

    // Mock MCP tools for now
    const tools = [
      { name: 'search_records', description: 'Search Odoo records' },
      { name: 'get_record', description: 'Get specific Odoo record' },
      { name: 'list_models', description: 'List available Odoo models' },
      { name: 'execute_method', description: 'Execute Odoo method' }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        tools,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Failed to list MCP tools:', error);
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
