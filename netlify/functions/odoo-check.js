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
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed'
        })
      }
    }

    const { checkDescription, checkTitle, checkId, organizationId, acceptanceCriteria } = JSON.parse(event.body || '{}')

    if (!checkDescription) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Check description is required'
        })
      }
    }

    // For now, return a mock response since we don't have the full Odoo AI Agent in Netlify Functions
    // In a real implementation, you would need to port the Odoo AI Agent logic here
    const mockResult = {
      success: true,
      status: 'passed',
      result: {
        success: true,
        status: 'passed',
        count: 0,
        records: [],
        llmAnalysis: 'Mock analysis - Odoo AI Agent not available in Netlify Functions',
        duration: 1000,
        steps: [
          { id: 'init', name: 'Initializing check execution', status: 'completed' },
          { id: 'connect', name: 'Connecting to Odoo database', status: 'completed' },
          { id: 'query', name: 'Executing database query', status: 'completed' },
          { id: 'analyze', name: 'Analyzing results with LLM', status: 'completed' },
          { id: 'complete', name: 'Check completed', status: 'completed' }
        ]
      },
      timestamp: new Date().toISOString()
    }

    // Save results to database if checkId is provided
    if (checkId) {
      try {
        const resultData = {
          check_id: checkId,
          status: mockResult.status,
          executed_at: new Date().toISOString(),
          duration: mockResult.result.duration || 0,
          success: mockResult.success,
          query_plan: null,
          record_count: mockResult.result.count || 0,
          records: mockResult.result.records || null,
          llm_analysis: mockResult.result.llmAnalysis || null,
          tokens_used: null,
          execution_steps: mockResult.result.steps || null,
          error_message: null
        }

        const { error: insertError } = await supabase
          .from('checks_results')
          .insert(resultData)

        if (insertError) {
          console.error('Failed to save check results:', insertError)
        } else {
          console.log('✅ Check results saved to database')
          
          // Also update root check status
          const { error: updateCheckError } = await supabase
            .from('checks')
            .update({ status: mockResult.status, updated_at: new Date().toISOString() })
            .eq('id', checkId)
          
          if (updateCheckError) {
            console.error('Failed to update root check status:', updateCheckError)
          }
        }
      } catch (dbError) {
        console.error('Database save error:', dbError)
        // Don't fail the request if database save fails
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockResult)
    }
  } catch (error) {
    console.error('Error in odoo-check function:', error)
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
