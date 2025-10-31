import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// OpenAI is initialized in OdooAiAgent class

// Import core Odoo AI Agent
import { OdooAiAgent as CoreOdooAiAgent } from '../../src/services/OdooAiAgent.js';

// Netlify Odoo AI Agent Wrapper - Uses core implementation
class NetlifyOdooAiAgent extends CoreOdooAiAgent {
  constructor() {
    super();
  }

  // All methods are inherited from CoreOdooAiAgent
  // This class serves as a Netlify-specific wrapper
}

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

    const { checkDescription, checkTitle, checkId, organizationId, acceptanceCriteria } = JSON.parse(event.body);

    if (!checkDescription || !checkTitle) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    console.log('🎯 API request:', checkTitle);
    console.log('🔍 Organization ID:', organizationId);
    console.log('🔍 Organization ID type:', typeof organizationId);
    console.log('🔍 Organization ID length:', organizationId?.length);
    console.log('🔍 Organization ID trimmed:', organizationId?.trim());

    // Get organization integrations
    let odooConfig = null;
    if (organizationId) {
      try {
        console.log('🔍 About to query Supabase with:');
        console.log('   organization_id:', organizationId);
        console.log('   integration_name: odoo');
        console.log('   is_active: true');
        
        const { data: integrations, error } = await supabase
          .from('organization_integrations')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('integration_name', 'odoo')
          .eq('is_active', true)
          .single();

        console.log('🔍 Supabase query completed');
        console.log('   Error:', error);
        console.log('   Integrations:', integrations);
        
        if (error) {
          console.error('❌ Error fetching integrations:', error);
          console.error('🔍 Organization ID that failed:', organizationId);
          console.error('🔍 Expected organization ID:', '9a4880df-ba32-4291-bd72-2b13dad95f20');
        } else if (integrations) {
          // UNIFIED CONFIGURATION HANDLING
          // Priority: config field > separate fields > error
          
          let configSource = 'none';
          
          if (integrations.config && Object.keys(integrations.config).length > 0) {
            // Use config JSON field (preferred)
            odooConfig = {
              url: integrations.config.url,
              db: integrations.config.db,
              username: integrations.config.username,
              apiKey: integrations.api_key
            };
            configSource = 'config field';
          } else if (integrations.odoo_url && integrations.odoo_db && integrations.odoo_username) {
            // Use separate fields (legacy)
            odooConfig = {
              url: integrations.odoo_url,
              db: integrations.odoo_db,
              username: integrations.odoo_username,
              apiKey: integrations.api_key
            };
            configSource = 'separate fields';
          } else {
            // No configuration found
            console.error('❌ No Odoo configuration found in organization integration');
            console.error('   Config field:', integrations.config);
            console.error('   Separate fields:', {
              odoo_url: integrations.odoo_url,
              odoo_db: integrations.odoo_db,
              odoo_username: integrations.odoo_username
            });
            throw new Error('No Odoo configuration found in organization integration');
          }
          
          console.log(`🔧 Using organization-specific Odoo config (source: ${configSource}):`, {
            url: odooConfig.url,
            db: odooConfig.db,
            hasApiKey: !!odooConfig.apiKey,
            username: odooConfig.username
          });
        } else {
          console.warn('⚠️  No integration found for organization ID:', organizationId);
          console.warn('🔍 Expected organization ID:', '9a4880df-ba32-4291-bd72-2b13dad95f20');
        }
      } catch (error) {
        console.error('❌ Error processing integrations:', error);
      }
    }

    // Initialize Netlify Odoo AI Agent with core implementation
    const agent = new NetlifyOdooAiAgent();
    const initialized = await agent.initialize(odooConfig);

    if (!initialized) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to initialize Odoo AI Agent'
        })
      };
    }

    // Execute the check with REAL ODOO CONNECTION
    const result = await agent.executeCheck(checkDescription, checkTitle, acceptanceCriteria);

    // Save results to database if checkId is provided
    if (checkId && result.success) {
      try {
        const resultData = {
          check_id: checkId,
          status: result.status || 'unknown',
          executed_at: new Date().toISOString(),
          duration: result.duration || 0,
          success: result.success,
          query_plan: result.queryPlan || null,
          record_count: result.count || 0,
          records: result.records || null,
          llm_analysis: result.llmAnalysis || null,
          tokens_used: result.tokensUsed || null,
          execution_steps: result.steps || null,
          error_message: result.error || null
        };

        const { error: insertError } = await supabase
          .from('checks_results')
          .insert(resultData);

        if (insertError) {
          console.error('Failed to save check results:', insertError);
        } else {
          console.log('✅ Check results saved to database');
          
          // Also update root check status
          const { error: updateCheckError } = await supabase
            .from('checks')
            .update({ status: result.status || 'unknown', updated_at: new Date().toISOString() })
            .eq('id', checkId);
          
          if (updateCheckError) {
            console.error('Failed to update check status:', updateCheckError);
          } else {
            console.log('✅ Check status updated in database');
          }
        }
      } catch (dbError) {
        console.error('Database save error:', dbError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: result.success,
        result: result,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error in odoo-check function:', error);
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
