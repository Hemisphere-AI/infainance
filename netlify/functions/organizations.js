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
    
    // Extract organizationId from path if present (e.g., /api/organizations/123)
    const pathParts = path.split('/')
    const organizationId = pathParts[pathParts.length - 1] !== 'organizations' ? pathParts[pathParts.length - 1] : null
    
    // Parse request body to get userId if not in query params
    let requestBody = {}
    try {
      requestBody = JSON.parse(body || '{}')
    } catch (e) {
      console.error('Error parsing request body:', e)
    }
    
    const { userId: bodyUserId } = requestBody
    const userId = queryUserId || bodyUserId
    

    switch (httpMethod) {
      case 'GET': {
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
      }

      case 'POST': {
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
      }

      case 'PUT': {
        const { organizationId: putOrgId, name } = requestBody
        const putOrganizationId = organizationId || putOrgId
        
        if (!userId || !putOrganizationId || !name) {
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
        const { data: userAccess, error: accessError } = await supabase
          .from('organization_users')
          .select('role')
          .eq('organization_id', putOrganizationId)
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

        // Update organization
        const { data: updateData, error: updateError } = await supabase
          .from('organizations')
          .update({ name })
          .eq('id', putOrganizationId)
          .select()
          .single()

        if (updateError) throw updateError

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            organization: updateData
          })
        }
      }

      case 'DELETE': {
        const { organizationId: deleteOrgId } = requestBody
        const deleteOrganizationId = organizationId || deleteOrgId
        
        if (!userId || !deleteOrganizationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'userId and organizationId are required'
            })
          }
        }

        // Check if user has access to this organization and is owner
        const { data: deleteUserAccess, error: deleteAccessError } = await supabase
          .from('organization_users')
          .select('role')
          .eq('organization_id', deleteOrganizationId)
          .eq('user_id', userId)
          .single()

        if (deleteAccessError || !deleteUserAccess) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'User does not have access to this organization'
            })
          }
        }

        // Only owners can delete organizations
        if (deleteUserAccess.role !== 'owner') {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Only organization owners can delete organizations'
            })
          }
        }

        // Delete organization (cascade will handle organization_users)
        const { error: deleteError } = await supabase
          .from('organizations')
          .delete()
          .eq('id', deleteOrganizationId)

        if (deleteError) throw deleteError

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Organization deleted successfully'
          })
        }
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
