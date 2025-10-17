import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration missing')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  try {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed'
        })
      }
    }

    const { organizationId } = event.queryStringParameters || {}

    // If organizationId is provided, try to get organization-specific config
    if (organizationId) {
      try {
        // Get organization integrations
        const { data, error } = await supabase
          .from('organization_integrations')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('integration_name', 'odoo')
          .eq('is_active', true)
          .single()

        if (!error && data) {
          const config = {
            url: data.odoo_url || process.env.ODOO_URL,
            db: data.odoo_db || process.env.ODOO_DB,
            apiKey: data.api_key || process.env.ODOO_API_KEY,
            username: data.odoo_username || process.env.ODOO_USERNAME
          }
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(config)
          }
        }
      } catch (orgError) {
        console.warn('Failed to get organization-specific Odoo config, falling back to environment:', orgError.message)
      }
    }

    // Fallback to environment variables
    const config = {
      url: process.env.ODOO_URL,
      db: process.env.ODOO_DB,
      apiKey: process.env.ODOO_API_KEY,
      username: process.env.ODOO_USERNAME
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(config)
    }
  } catch (error) {
    console.error('Error in odoo-config function:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    }
  }
}
