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
    const { httpMethod, queryStringParameters, body } = event
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
    
    console.log('🔍 Organizations function: queryUserId:', queryUserId, 'bodyUserId:', bodyUserId, 'final userId:', userId)

    switch (httpMethod) {
      case 'GET':
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'userId is required'
            })
          }
        }

        // Get user's organizations
        const { data, error } = await supabase
          .from('organization_users')
          .select(`
            organization_id,
            organizations (
              id,
              name,
              created_at,
              updated_at
            )
          `)
          .eq('user_id', userId)

        if (error) throw error

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            organizations: data?.map(item => item.organizations) || []
          })
        }

      case 'POST':
        const { name } = requestBody
        
        if (!userId || !name) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'userId and name are required'
            })
          }
        }

        // Create organization
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert([{ name }])
          .select()
          .single()

        if (orgError) throw orgError

        // Add user to organization
        const { error: userError } = await supabase
          .from('organization_users')
          .insert([{
            organization_id: orgData.id,
            user_id: userId,
            role: 'owner'
          }])

        if (userError) throw userError

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            organization: orgData
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
    console.error('Error in organizations function:', error)
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
