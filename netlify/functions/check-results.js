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
    const { httpMethod, path } = event
    
    // Extract checkId from path like /api/check-results/123
    const pathParts = path.split('/')
    const checkId = pathParts[pathParts.length - 1]

    switch (httpMethod) {
      case 'GET':
        if (!checkId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'checkId is required'
            })
          }
        }

        // Get check results
        const { data, error } = await supabase
          .from('checks_results')
          .select('*')
          .eq('check_id', checkId)
          .order('executed_at', { ascending: false })

        if (error) {
          // If table doesn't exist, return empty results
          if (error.message && (
            error.message.includes('relation "checks_results" does not exist') ||
            error.message.includes("Could not find the table 'public.checks_results' in the schema cache")
          )) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                results: []
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
            results: data || []
          })
        }

      case 'DELETE':
        if (!checkId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'checkId is required'
            })
          }
        }

        // Delete check results
        const { error: deleteError } = await supabase
          .from('checks_results')
          .delete()
          .eq('check_id', checkId)

        if (deleteError) throw deleteError

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Check results cleared successfully'
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
    console.error('Error in check-results function:', error)
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
