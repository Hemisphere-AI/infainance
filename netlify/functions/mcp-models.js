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

    // Mock Odoo models
    const models = [
      { model: 'account.move', name: 'Account Move' },
      { model: 'account.move.line', name: 'Account Move Line' },
      { model: 'res.partner', name: 'Partner' },
      { model: 'account.bank.statement.line', name: 'Bank Statement Line' },
      { model: 'account.account', name: 'Account' },
      { model: 'account.journal', name: 'Journal' },
      { model: 'product.product', name: 'Product' },
      { model: 'sale.order', name: 'Sales Order' },
      { model: 'purchase.order', name: 'Purchase Order' }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        models,
        count: models.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Failed to list models:', error);
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
