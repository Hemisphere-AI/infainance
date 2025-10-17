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
    const { httpMethod, path, queryStringParameters, body } = event
    const { userId } = queryStringParameters || {}
    
    // Extract organizationId from path like /api/organization-integrations/123/integrations
    const pathParts = path.split('/')
    const organizationId = pathParts[pathParts.length - 2] // Second to last part

    switch (httpMethod) {
      case 'GET':
        if (!userId || !organizationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'userId and organizationId are required'
            })
          }
        }

        // Get organization integrations
        const { data, error } = await supabase
          .from('organization_integrations')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })

        if (error) {
          // If table doesn't exist, return empty results
          if (error.message && (
            error.message.includes('relation "organization_integrations" does not exist') ||
            error.message.includes("Could not find the table 'public.organization_integrations' in the schema cache")
          )) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                integrations: []
              })
            }
          }
          throw error
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            integrations: data || []
          })
        }

      case 'POST':
        const { integrationName, apiKey, config, odooUrl, odooDb, odooUsername } = JSON.parse(body || '{}')
        
        if (!userId || !organizationId || !integrationName || !apiKey) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'userId, organizationId, integrationName, and apiKey are required'
            })
          }
        }

        // Create or update integration
        const { data: integrationData, error: integrationError } = await supabase
          .from('organization_integrations')
          .upsert([{
            organization_id: organizationId,
            integration_name: integrationName,
            api_key: apiKey,
            config: config || {},
            odoo_url: odooUrl,
            odoo_db: odooDb,
            odoo_username: odooUsername,
            is_active: true
          }], {
            onConflict: 'organization_id,integration_name'
          })
          .select()
          .single()

        if (integrationError) throw integrationError

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            integration: integrationData
          })
        }

      case 'DELETE':
        const integrationId = pathParts[pathParts.length - 1] // Last part
        
        if (!userId || !integrationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'userId and integrationId are required'
            })
          }
        }

        // Delete integration
        const { error: deleteError } = await supabase
          .from('organization_integrations')
          .delete()
          .eq('id', integrationId)

        if (deleteError) throw deleteError

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Integration deleted successfully'
          })
        }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Method not allowed'
          })
        }
    }
  } catch (error) {
    console.error('Error in organization-integrations function:', error)
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
