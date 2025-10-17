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
    const { userId: queryUserId } = queryStringParameters || {}
    
    // Parse request body to get userId if not in query params
    let requestBody = {}
    try {
      requestBody = JSON.parse(body || '{}')
    } catch (e) {
      console.error('Error parsing request body:', e)
    }
    
    const { userId: bodyUserId } = requestBody
    const userId = queryUserId || bodyUserId
    
    // Extract organizationId from path like /api/organization-checks/123/checks
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

        // Check if user has access to this organization
        const { data: userAccess, error: accessError } = await supabase
          .from('organization_users')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
          .single()

        if (accessError || !userAccess) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'User does not have access to this organization'
            })
          }
        }

        // Get organization checks
        const { data, error } = await supabase
          .from('checks')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })

        if (error) throw error

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            checks: data || []
          })
        }

      case 'POST':
        const { name, description } = requestBody
        
        if (!userId || !organizationId || !name) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'userId, organizationId, and name are required'
            })
          }
        }

        // Check if user has access to this organization
        const { data: userAccessPost, error: accessErrorPost } = await supabase
          .from('organization_users')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
          .single()

        if (accessErrorPost || !userAccessPost) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'User does not have access to this organization'
            })
          }
        }

        // Create check
        const { data: checkData, error: checkError } = await supabase
          .from('checks')
          .insert([{
            organization_id: organizationId,
            name,
            description: description || '',
            status: 'active'
          }])
          .select()
          .single()

        if (checkError) throw checkError

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            check: checkData
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
    console.error('Error in organization-checks function:', error)
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
