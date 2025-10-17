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

    const { organizationId } = event.queryStringParameters || {};

    if (!organizationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Organization ID is required' })
      };
    }

    console.log('🔍 Fetching Odoo config for organization:', organizationId);

    // Get organization integrations
    const { data: integrations, error } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_name', 'odoo')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('❌ Error fetching integrations:', error);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'No Odoo integration found for this organization',
          details: error.message 
        })
      };
    }

    if (!integrations) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'No Odoo integration found for this organization' 
        })
      };
    }

    const config = {
      url: integrations.odoo_url,
      db: integrations.odoo_db,
      username: integrations.odoo_username,
      hasApiKey: !!integrations.api_key,
      integrationId: integrations.id,
      isActive: integrations.is_active
    };

    console.log('✅ Odoo config retrieved:', {
      url: config.url,
      db: config.db,
      hasApiKey: config.hasApiKey,
      username: config.username
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(config)
    };

  } catch (error) {
    console.error('Error in odoo-config function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
