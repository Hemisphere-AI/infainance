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
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const { model, domain = [], fields = [], limit = 100 } = JSON.parse(event.body || '{}');

    if (!model) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Model name is required' 
        })
      };
    }

    // Mock search results for now
    const mockRecords = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: i + 1,
      name: `Mock ${model} Record ${i + 1}`,
      create_date: new Date().toISOString(),
      write_date: new Date().toISOString()
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        records: mockRecords,
        count: mockRecords.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('MCP search failed:', error);
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
