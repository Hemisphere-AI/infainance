/* eslint-env node */
/**
 * Backend API Server for Google Service Account Authentication
 * This handles the service account credentials securely on the server side
 */

import express from 'express'
import cors from 'cors'
// import { google } from 'googleapis' // Disabled - Google Sheets API endpoints are disabled
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '../.env' })

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:3000',
    'https://getzenith.ai',
    'https://www.getzenith.ai'
  ], // Add your frontend URLs
  credentials: true
}))
app.use(express.json())

// Initialize MCP Odoo Client once
let mcpOdooClientInstance = null
let initializationPromise = null

// Initialize Checks Runner once - DISABLED
// let checksRunnerInstance = null
// let checksRunnerPromise = null

async function getMCPOdooClient() {
  if (!mcpOdooClientInstance) {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        const MCPOdooClient = (await import('./services/mcpOdooClient.js')).default
        const instance = new MCPOdooClient()
        const initialized = await instance.initialize()
        if (!initialized) {
          throw new Error('Failed to initialize MCP Odoo Client')
        }
        return instance
      })()
    }
    mcpOdooClientInstance = await initializationPromise
  }
  return mcpOdooClientInstance
}

// async function getChecksRunner() {
//   if (!checksRunnerInstance) {
//     if (!checksRunnerPromise) {
//       checksRunnerPromise = (async () => {
//         const ChecksRunner = (await import('./checks_runner.js')).default
//         const instance = new ChecksRunner()
//         const initialized = await instance.initialize()
//         if (!initialized) {
//           throw new Error('Failed to initialize Checks Runner')
//         }
//         return instance
//       })()
//     }
//     checksRunnerInstance = await checksRunnerPromise
//   }
//   return checksRunnerInstance
// }

// Initialize Odoo AI Agent once
let odooAiAgentInstance = null
let odooAiAgentPromise = null

async function getOdooAiAgent(customConfig = null) {
  // If custom config is provided, create a new instance with that config
  if (customConfig) {
        const { BackendOdooAiAgent } = await import('./services/BackendOdooAiAgent.js')
        const instance = new BackendOdooAiAgent(customConfig)
    const initialized = await instance.initialize()
    if (!initialized) {
      throw new Error('Failed to initialize Odoo AI Agent with custom config')
    }
    return instance
  }
  
  // Use cached instance for default configuration
  if (!odooAiAgentInstance) {
    if (!odooAiAgentPromise) {
      odooAiAgentPromise = (async () => {
        const { BackendOdooAiAgent } = await import('./services/BackendOdooAiAgent.js')
        const instance = new BackendOdooAiAgent()
        const initialized = await instance.initialize()
        if (!initialized) {
          throw new Error('Failed to initialize Odoo AI Agent')
        }
        return instance
      })()
    }
    odooAiAgentInstance = await odooAiAgentPromise
  }
  return odooAiAgentInstance
}

// Initialize Organization Service once
let organizationServiceInstance = null
let organizationServicePromise = null

async function getOrganizationService() {
  if (!organizationServiceInstance) {
    if (!organizationServicePromise) {
      organizationServicePromise = (async () => {
        const OrganizationService = (await import('./services/organizationService.js')).default
        return new OrganizationService()
      })()
    }
    organizationServiceInstance = await organizationServicePromise
  }
  return organizationServiceInstance
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend API server is running' })
})

// Test route
app.get('/test', (req, res) => {
  console.log('🧪 Test route called')
  res.json({ message: 'Test route working' })
})

// MCP Odoo Integration endpoints
app.get('/api/odoo/config', async (req, res) => {
  try {
    const { organizationId } = req.query;
    
    // If organizationId is provided, try to get organization-specific config
    if (organizationId) {
      try {
        const orgService = await getOrganizationService();
        const result = await orgService.getOrganizationIntegrations(organizationId, 'system'); // Use system user for config lookup
        
        if (result.success && result.integrations) {
          const odooIntegration = result.integrations.find(integration => 
            integration.integration_name === 'odoo' && integration.is_active
          );
          
          if (odooIntegration) {
            const config = {
              url: odooIntegration.odoo_url || process.env.ODOO_URL,
              db: odooIntegration.odoo_db || process.env.ODOO_DB,
              apiKey: odooIntegration.api_key || process.env.ODOO_API_KEY,
              username: odooIntegration.odoo_username || process.env.ODOO_USERNAME
            };
            return res.json(config);
          }
        }
      } catch (orgError) {
        console.warn('Failed to get organization-specific Odoo config, falling back to environment:', orgError.message);
      }
    }
    
    // Fallback to environment variables
    const config = {
      url: process.env.ODOO_URL,
      db: process.env.ODOO_DB,
      apiKey: process.env.ODOO_API_KEY,
      username: process.env.ODOO_USERNAME
    }
    res.json(config)
  } catch (error) {
    console.error('Error getting Odoo config:', error)
    res.status(500).json({ error: 'Failed to get Odoo configuration' })
  }
})

app.get('/api/odoo/test', async (req, res) => {
  try {
    // Test Odoo connection using the MCP client
    const mcpClient = await getMCPOdooClient()
    
    if (mcpClient && mcpClient.initialized) {
      // Test by listing models
      const modelsResult = await mcpClient.listModels()
      res.json({ 
        success: true, 
        message: 'Odoo MCP connection successful',
        modelsCount: modelsResult.models ? modelsResult.models.length : 0
      })
    } else {
      res.status(500).json({ success: false, error: 'Failed to connect to Odoo' })
    }
  } catch (error) {
    console.error('Odoo MCP connection test failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/odoo/execute', async (req, res) => {
  try {
    const { queries } = req.body
    
    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Queries array is required' 
      })
    }
    
    // Get the shared MCP Odoo Client instance
    const mcpClient = await getMCPOdooClient()
    
    // Execute queries using the MCP client
    const results = []
    for (const query of queries) {
      try {
        const result = await mcpClient.searchRecords(
          query.table,
          query.filters || [],
          query.fields || [],
          query.limit || 100
        )
        results.push({
          query_name: query.query_name,
          data: result.records || [],
          count: result.count || 0,
          success: result.success
        })
      } catch (error) {
        results.push({
          query_name: query.query_name,
          data: [],
          count: 0,
          success: false,
          error: error.message
        })
      }
    }
    
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('MCP query execution failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to connect to Odoo. Please check your configuration.' 
    })
  }
})

// MCP-specific endpoints
app.get('/api/mcp/resources', async (req, res) => {
  try {
    const mcpClient = await getMCPOdooClient()
    const resources = await mcpClient.listResources()
    res.json({
      success: true,
      resources,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to list MCP resources:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/mcp/tools', async (req, res) => {
  try {
    const mcpClient = await getMCPOdooClient()
    const tools = await mcpClient.listTools()
    res.json({
      success: true,
      tools,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to list MCP tools:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/mcp/models', async (req, res) => {
  try {
    const mcpClient = await getMCPOdooClient()
    const result = await mcpClient.listModels()
    res.json(result)
  } catch (error) {
    console.error('Failed to list models:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/mcp/models/accounting', async (req, res) => {
  try {
    const mcpClient = await getMCPOdooClient()
    const result = await mcpClient.listAccountingModels()
    res.json(result)
  } catch (error) {
    console.error('Failed to list accounting models:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/mcp/model/:modelName', async (req, res) => {
  try {
    const { modelName } = req.params
    const mcpClient = await getMCPOdooClient()
    const result = await mcpClient.getModelInfo(modelName)
    res.json(result)
  } catch (error) {
    console.error(`Failed to get model info for ${req.params.modelName}:`, error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.post('/api/mcp/search', async (req, res) => {
  try {
    const { model, domain = [], fields = [], limit = 100 } = req.body
    
    if (!model) {
      return res.status(400).json({ 
        success: false, 
        error: 'Model name is required' 
      })
    }
    
    const mcpClient = await getMCPOdooClient()
    const result = await mcpClient.searchRecords(model, domain, fields, limit)
    res.json(result)
  } catch (error) {
    console.error('MCP search failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/mcp/record/:model/:id', async (req, res) => {
  try {
    const { model, id } = req.params
    const { fields } = req.query
    
    const mcpClient = await getMCPOdooClient()
    const result = await mcpClient.getRecord(model, parseInt(id), fields ? fields.split(',') : [])
    res.json(result)
  } catch (error) {
    console.error(`Failed to get record ${req.params.id} from ${req.params.model}:`, error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// AI-driven Odoo check execution endpoint
app.post('/api/odoo/check', async (req, res) => {
  try {
    const { checkDescription, checkTitle, checkId, organizationId, acceptanceCriteria } = req.body
    
    console.log('🎯 API request:', checkTitle);
    console.log('🔍 Organization ID:', organizationId);
    
    if (!checkDescription) {
      return res.status(400).json({ 
        success: false, 
        error: 'Check description is required' 
      })
    }
    
    // Get organization-specific Odoo configuration if organizationId is provided
    let odooConfig = null;
    if (organizationId) {
      try {
        console.log('🔍 Fetching organization integrations for ID:', organizationId);
        const orgService = await getOrganizationService();
        const result = await orgService.getOrganizationIntegrations(organizationId, 'system');
        
        console.log('📊 Organization integrations result:', {
          success: result.success,
          integrationsCount: result.integrations?.length || 0,
          integrations: result.integrations
        });
        
        if (result.success && result.integrations) {
          const odooIntegration = result.integrations.find(integration => 
            integration.integration_name === 'odoo' && integration.is_active
          );
          
          console.log('🎯 Found Odoo integration:', odooIntegration);
          
          if (odooIntegration) {
            odooConfig = {
              url: odooIntegration.odoo_url || process.env.ODOO_URL,
              db: odooIntegration.odoo_db || process.env.ODOO_DB,
              apiKey: odooIntegration.api_key || process.env.ODOO_API_KEY,
              username: odooIntegration.odoo_username || process.env.ODOO_USERNAME
            };
            console.log('🔧 Using organization-specific Odoo config:', {
              url: odooConfig.url,
              db: odooConfig.db,
              hasApiKey: !!odooConfig.apiKey,
              username: odooConfig.username,
              apiKeyValue: odooConfig.apiKey // Log the actual API key for debugging
            });
          } else {
            console.log('⚠️ No active Odoo integration found for organization');
          }
        } else {
          console.log('❌ Failed to get organization integrations:', result.error);
        }
      } catch (orgError) {
        console.warn('Failed to get organization-specific Odoo config, using default:', orgError.message);
      }
    } else {
      console.log('⚠️ No organizationId provided, using environment variables');
    }
    
    // Get the AI Agent (will use organization-specific config if available)
    const aiAgent = await getOdooAiAgent(odooConfig)
    
    // Execute AI-driven check
    console.log('🚀 FRONTEND CHECK EXECUTION - Starting AI Agent');
    console.log('📝 Check Description:', checkDescription);
    console.log('📝 Check Title:', checkTitle);
    console.log('📝 Acceptance Criteria:', acceptanceCriteria);
    
    const result = await aiAgent.executeCheck(checkDescription, checkTitle, acceptanceCriteria || '')
    
    console.log('🧠 FRONTEND CHECK RESULT:');
    console.log('  ✅ Success:', result?.success);
    console.log('  📊 Count:', result?.count);
    console.log('  📋 Data Length:', result?.data?.length || 0);
    console.log('  🔍 Query:', JSON.stringify(result?.query, null, 2));
    console.log('  ⏰ Timestamp:', result?.timestamp);
    console.log('  ❌ Error:', result?.error);
    
    console.log('✅ API response sent');
    
    // Save results to database if checkId is provided (always save, regardless of success)
    if (checkId) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = process.env.VITE_SUPABASE_URL
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey)
          
          const resultData = {
            check_id: checkId,
            status: result.status || 'unknown',
            executed_at: new Date().toISOString(),
            duration: result.duration || 0,
            success: result.success || false,
            query_plan: result.queryPlan || null,
            record_count: result.count || 0,
            records: result.records || result.data || null,
            llm_analysis: result.llmAnalysis || null,
            tokens_used: result.tokensUsed || null,
            execution_steps: result.steps || null,
            error_message: result.error || null
          }
          
          console.log('💾 BACKEND: Storing result data:', {
            checkId,
            recordCount: result.count,
            hasRecords: !!(result.records || result.data),
            recordsLength: (result.records || result.data)?.length || 0,
            recordsPreview: (result.records || result.data)?.slice(0, 2) || 'No records',
            hasQueryPlan: !!result.queryPlan,
            hasLlmAnalysis: !!result.llmAnalysis,
            queryPlanPreview: result.queryPlan ? { model: result.queryPlan.model, domain: result.queryPlan.domain } : 'No query plan',
            llmAnalysisPreview: result.llmAnalysis ? result.llmAnalysis.substring(0, 100) + '...' : 'No LLM analysis'
          });
          
          console.log('💾 BACKEND: About to insert into database:', {
            checkId: resultData.check_id,
            hasQueryPlan: !!resultData.query_plan,
            hasLlmAnalysis: !!resultData.llm_analysis,
            queryPlanType: typeof resultData.query_plan,
            llmAnalysisType: typeof resultData.llm_analysis,
            queryPlanPreview: resultData.query_plan ? JSON.stringify(resultData.query_plan).substring(0, 100) + '...' : 'null',
            llmAnalysisPreview: resultData.llm_analysis ? resultData.llm_analysis.substring(0, 100) + '...' : 'null'
          });

          const { error: insertError } = await supabase
            .from('checks_results')
            .insert(resultData)
          
          if (insertError) {
            console.error('❌ Failed to save check results:', insertError)
            console.error('Result data:', JSON.stringify(resultData, null, 2))
          } else {
            console.log('✅ Check results saved to database')
            console.log('🧩 Saved check_result status:', resultData.status)
            console.log('💾 Database insert successful - query_plan and llm_analysis should be stored')
            // Also update root check status if we have a status from the agent
            if (result.status) {
              const { error: updateCheckError } = await supabase
                .from('checks')
                .update({ status: result.status, updated_at: new Date().toISOString() })
                .eq('id', checkId)
              if (updateCheckError) {
                console.error('Failed to update root check status:', updateCheckError)
              }
              console.log('📦 Updated root check status:', result.status)
            }
          }
        } else {
          console.warn('⚠️ Supabase configuration missing - results not saved to database')
        }
      } catch (dbError) {
        console.error('Database save error:', dbError)
        // Don't fail the request if database save fails
      }
    } else {
      console.warn('⚠️ No checkId provided - results not saved to database')
    }
    
    res.json({
      success: result.success,
      result: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('AI check execution failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// Get check results for a specific check
app.get('/api/checks/:checkId/results', async (req, res) => {
  try {
    const { checkId } = req.params
    
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database configuration missing' 
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Access check results through the check_id (RLS will handle organization access)
    const { data, error } = await supabase
      .from('checks_results')
      .select('*')
      .eq('check_id', checkId)
      .order('executed_at', { ascending: false })
    
    if (error) {
      console.error('Failed to load check results:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      // If table doesn't exist, return empty results instead of 500 error
      if (error.message && (
        error.message.includes('relation "checks_results" does not exist') ||
        error.message.includes("Could not find the table 'public.checks_results' in the schema cache")
      )) {
        return res.json({
          success: true,
          results: []
        })
      }
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to load check results',
        details: error.message
      })
    }
    
    res.json({
      success: true,
      results: data || []
    })
  } catch (error) {
    console.error('Load check results failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.post('/api/mcp/execute-method', async (req, res) => {
  try {
    const { model, method, args = [], kwargs = {} } = req.body
    
    if (!model || !method) {
      return res.status(400).json({ 
        success: false, 
        error: 'Model and method are required' 
      })
    }
    
    const mcpClient = await getMCPOdooClient()
    const result = await mcpClient.executeMethod(model, method, args, kwargs)
    res.json(result)
  } catch (error) {
    console.error('MCP method execution failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// Checks endpoints for frontend integration
app.get('/api/checks/catalog', async (req, res) => {
  try {
    const ChecksRunner = (await import('./checks_runner.js')).default;
    const runner = new ChecksRunner();
    await runner.initialize();
    await runner.loadChecks();
    
    res.json({
      success: true,
      checks: runner.checks,
      count: runner.checks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to load checks catalog:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/checks/run', async (req, res) => {
  try {
    const { checkKey, checkId } = req.body;
    
    if (!checkKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'checkKey is required' 
      });
    }

    const ChecksRunner = (await import('./checks_runner.js')).default;
    const runner = new ChecksRunner();
    await runner.initialize();
    await runner.loadChecks();
    
    const check = runner.checks.find(c => c.key === checkKey);
    if (!check) {
      return res.status(404).json({ 
        success: false, 
        error: 'Check not found' 
      });
    }

    const result = await runner.runCheck(check);
    
    // Store results in database if checkId is provided
    if (checkId) {
      await runner.storeResultsInDatabase(checkId, result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Failed to run check:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Clear check results for a specific check (to force fresh analysis)
app.delete('/api/checks/:checkId/results', async (req, res) => {
  try {
    const { checkId } = req.params;
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database configuration missing' 
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Delete all results for this check
    const { error } = await supabase
      .from('checks_results')
      .delete()
      .eq('check_id', checkId);
    
    if (error) {
      console.error('Failed to clear check results:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to clear check results',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      message: 'Check results cleared successfully'
    });
  } catch (error) {
    console.error('Clear check results failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


// Initialize Google APIs with service account - DISABLED
// let sheets, drive, auth

// try {
//   console.log('🔧 Initializing Google Service Account...')
//   console.log('Project ID:', process.env.GOOGLE_SA_PROJECT_ID)
//   console.log('Client Email:', process.env.GOOGLE_SA_CLIENT_EMAIL)
  
//   const credentials = {
//     type: 'service_account',
//     project_id: process.env.GOOGLE_SA_PROJECT_ID,
//     private_key_id: process.env.GOOGLE_SA_PRIVATE_KEY_ID,
//     private_key: process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n'),
//     client_email: process.env.GOOGLE_SA_CLIENT_EMAIL,
//     client_id: process.env.GOOGLE_SA_CLIENT_ID,
//     auth_uri: 'https://accounts.google.com/o/oauth2/auth',
//     token_uri: 'https://oauth2.googleapis.com/token',
//     auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
//     client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_SA_CLIENT_EMAIL}`
//   }

//   auth = new google.auth.GoogleAuth({
//     credentials,
//     scopes: [
//       'https://www.googleapis.com/auth/drive',
//       'https://www.googleapis.com/auth/spreadsheets'
//     ]
//   })

//   sheets = google.sheets({ version: 'v4', auth })
//   drive = google.drive({ version: 'v3', auth })

//   console.log('✅ Google Service Account initialized on server')
// } catch (error) {
//   console.error('❌ Failed to initialize Google Service Account:', error)
//   console.error('Error details:', error.message)
//   process.exit(1)
// }

// console.log('⚠️ Google Sheets API endpoints are disabled')

// API Routes
// console.log('🔧 Setting up API routes...')

/**
 * Create a new spreadsheet for a user - DISABLED
 */
// app.post('/api/sheets/create-for-user', async (req, res) => {
//   console.log('📊 POST /api/sheets/create-for-user called')
//   try {
//     const { userId, userEmail, spreadsheetName } = req.body

//     if (!userId || !userEmail) {
//       return res.status(400).json({
//         success: false,
//         error: 'userId and userEmail are required'
//       })
//     }

//     console.log(`📊 Creating spreadsheet for user ${userId} (${userEmail})`)

//     // Create the spreadsheet
//     const createResponse = await sheets.spreadsheets.create({
//       requestBody: {
//         properties: {
//           title: spreadsheetName || 'Zenith Spreadsheet'
//         }
//       }
//     })

//     const spreadsheetId = createResponse.data.spreadsheetId
//     const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

//     console.log(`✅ Created spreadsheet: ${spreadsheetId}`)

//     // Move to the user_spreadsheets folder in Shared Drive
//     await moveToUserFolder(spreadsheetId)

//     // Share with the user
//     await shareWithUser(spreadsheetId, userEmail)

//     res.json({
//       success: true,
//       spreadsheetId,
//       spreadsheetUrl,
//       name: spreadsheetName || 'Zenith Spreadsheet'
//     })
//   } catch (error) {
//     console.error('❌ Error creating spreadsheet:', error)
//     res.status(500).json({
//       success: false,
//       error: error.message
//     })
//   }
// })

/**
 * Read data from spreadsheet - DISABLED
 */
// app.get('/api/sheets/read', async (req, res) => {
//   console.log('📖 GET /api/sheets/read called')
//   try {
//     const { spreadsheetId, range = 'A1:Z1000' } = req.query

//     if (!spreadsheetId) {
//       return res.status(400).json({
//         success: false,
//         error: 'spreadsheetId is required'
//       })
//     }

//     const response = await sheets.spreadsheets.values.get({
//       spreadsheetId,
//       range
//     })

//     res.json({
//       success: true,
//       values: response.data.values || []
//     })
//   } catch (error) {
//     console.error('❌ Error reading spreadsheet:', error)
//     res.status(500).json({
//       success: false,
//       error: error.message
//     })
//   }
// })

/**
 * Write data to spreadsheet - DISABLED
 */
// app.post('/api/sheets/write', async (req, res) => {
//   try {
//     const { spreadsheetId, range, values } = req.body

//     if (!spreadsheetId || !range || !values) {
//       return res.status(400).json({
//         success: false,
//         error: 'spreadsheetId, range, and values are required'
//       })
//     }

//     await sheets.spreadsheets.values.update({
//       spreadsheetId,
//       range,
//       valueInputOption: 'USER_ENTERED',
//       requestBody: {
//         values
//       }
//     })

//     console.log(`✅ Updated spreadsheet ${spreadsheetId} at range ${range}`)
//     res.json({ success: true })
//   } catch (error) {
//     console.error('❌ Error writing to spreadsheet:', error)
//     res.status(500).json({
//       success: false,
//       error: error.message
//     })
//   }
// })

/**
 * Batch update multiple cells - DISABLED
 */
// app.post('/api/sheets/batch-update', async (req, res) => {
//   try {
//     const { spreadsheetId, updates } = req.body

//     if (!spreadsheetId || !updates) {
//       return res.status(400).json({
//         success: false,
//         error: 'spreadsheetId and updates are required'
//       })
//     }

//     const requests = updates.map(update => ({
//       range: indexToA1(update.rowIndex, update.colIndex),
//       values: [[update.value]]
//     }))

//     await sheets.spreadsheets.values.batchUpdate({
//       spreadsheetId,
//       requestBody: {
//         valueInputOption: 'USER_ENTERED',
//         data: requests
//       }
//     })

//     console.log(`✅ Batch updated ${updates.length} cells in spreadsheet ${spreadsheetId}`)
//     res.json({ success: true })
//   } catch (error) {
//     console.error('❌ Error batch updating spreadsheet:', error)
//     res.status(500).json({
//       success: false,
//       error: error.message
//     })
//   }
// })

/**
 * Get spreadsheet metadata - DISABLED
 */
// app.get('/api/sheets/metadata', async (req, res) => {
//   try {
//     const { spreadsheetId } = req.query

//     if (!spreadsheetId) {
//       return res.status(400).json({
//         success: false,
//         error: 'spreadsheetId is required'
//       })
//     }

//     // Try to get real metadata from Google Drive API
//     if (drive) {
//       try {
//         const fileMetadata = await drive.files.get({
//           fileId: spreadsheetId,
//           fields: 'modifiedTime, name, size',
//           supportsAllDrives: true
//         })

//         res.json({
//           success: true,
//           lastModified: fileMetadata.data.modifiedTime,
//           name: fileMetadata.data.name,
//           size: fileMetadata.data.size
//         })
//         return
//       } catch (apiError) {
//         console.error('❌ Google Drive API error:', apiError.message)
//         console.log('🔄 Falling back to mock response...')
//       }
//     }

//     // Fallback to mock response
//     res.json({
//       success: true,
//       lastModified: new Date().toISOString(),
//       name: 'Mock Spreadsheet',
//       size: '1024'
//     })
//   } catch (error) {
//     console.error('❌ Error getting spreadsheet metadata:', error)
//     res.status(500).json({
//       success: false,
//       error: error.message
//     })
//   }
// })

/**
 * Sync from Google Sheets to database - DISABLED
 */
// app.post('/api/sheets/sync-from-google', async (req, res) => {
//   try {
//     const { spreadsheetId, userId, cellsData } = req.body

//     if (!spreadsheetId || !userId || !cellsData) {
//       return res.status(400).json({
//         success: false,
//         error: 'spreadsheetId, userId, and cellsData are required'
//       })
//     }

//     console.log(`🔄 Syncing ${cellsData.length} cells from Google Sheets to database`)
//     console.log(`📊 Spreadsheet: ${spreadsheetId}, User: ${userId}`)
    
//     // TODO: Implement database sync here
//     // This would involve:
//     // 1. Clear existing cells for this spreadsheet
//     // 2. Insert new cells from Google Sheets
//     // 3. Update any metadata
    
//     res.json({ 
//       success: true, 
//       syncedCells: cellsData.length,
//       message: 'Sync completed (mock implementation)'
//     })
//   } catch (error) {
//     console.error('❌ Error syncing from Google Sheets:', error)
//     res.status(500).json({
//       success: false,
//       error: error.message
//     })
//   }
// })

// Helper functions - DISABLED (Google Sheets related)

/**
 * Move spreadsheet to the user_spreadsheets folder - DISABLED
 */
// async function moveToUserFolder(spreadsheetId) {
//   try {
//   const userFolderId = process.env.GOOGLE_USER_SHEETS_FOLDER_ID

//     // Get current parents
//     const file = await drive.files.get({
//       fileId: spreadsheetId,
//       fields: 'parents'
//     })

//     const currentParents = file.data.parents || []

//     // Move to the user folder in Shared Drive
//     await drive.files.update({
//       fileId: spreadsheetId,
//       addParents: userFolderId,
//       removeParents: currentParents.join(','),
//       supportsAllDrives: true
//     })

//     console.log(`✅ Moved spreadsheet ${spreadsheetId} to user folder`)
//   } catch (error) {
//     console.error('❌ Error moving spreadsheet to folder:', error)
//     throw error
//   }
// }

/**
 * Share spreadsheet with user - DISABLED
 */
// async function shareWithUser(spreadsheetId, userEmail) {
//   try {
//     await drive.permissions.create({
//       fileId: spreadsheetId,
//       requestBody: {
//         role: 'writer', // Editor access
//         type: 'user',
//         emailAddress: userEmail
//       },
//       supportsAllDrives: true
//     })

//     console.log(`✅ Shared spreadsheet ${spreadsheetId} with ${userEmail}`)
//   } catch (error) {
//     console.error('❌ Error sharing spreadsheet with user:', error)
//     throw error
//   }
// }

/**
 * Convert row/col indices to A1 notation - DISABLED
 */
// function indexToA1(rowIndex, colIndex) {
//   const colLetter = numberToColumnLetter(colIndex + 1)
//   const rowNumber = rowIndex + 1
//   return `${colLetter}${rowNumber}`
// }

/**
 * Convert column number to letter (1 = A, 2 = B, etc.) - DISABLED
 */
// function numberToColumnLetter(num) {
//   let result = ''
//   while (num > 0) {
//     num--
//     result = String.fromCharCode(65 + (num % 26)) + result
//     num = Math.floor(num / 26)
//   }
//   return result
// }

// Organization Management endpoints
app.get('/api/organizations', async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.getUserOrganizations(userId)

    res.json(result)
  } catch (error) {
    console.error('Failed to get user organizations:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Test endpoint to check database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const orgService = await getOrganizationService()
    
    // Test simple query without RLS
    const { data, error } = await orgService.supabase
      .from('organizations')
      .select('*')
      .limit(1)

    if (error) {
      return res.json({
        success: false,
        error: error.message,
        code: error.code
      })
    }

    res.json({
      success: true,
      message: 'Database connection working',
      data: data
    })
  } catch (error) {
    console.error('Database test failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Temporary mock endpoint for testing frontend
app.get('/api/organizations-mock', async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    // Return mock data for testing
    res.json({
      success: true,
      organizations: [
        {
          id: 'mock-org-1',
          name: 'Test Organization 1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-org-2',
          name: 'Test Organization 2',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    })
  } catch (error) {
    console.error('Mock organizations failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Mock endpoint for organization checks
app.get('/api/organizations/:organizationId/checks-mock', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    // Return mock checks data
    res.json({
      success: true,
      checks: [
        {
          id: 'mock-check-1',
          organization_id: organizationId,
          name: 'Test Check 1',
          description: 'This is a test check',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-check-2',
          organization_id: organizationId,
          name: 'Test Check 2',
          description: 'Another test check',
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    })
  } catch (error) {
    console.error('Mock organization checks failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Mock endpoint for organization integrations
app.get('/api/organizations/:organizationId/integrations-mock', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    // Return mock integrations data
    res.json({
      success: true,
      integrations: [
        {
          id: 'mock-integration-1',
          organization_id: organizationId,
          integration_name: 'odoo',
          api_key: 'mock-api-key-123',
          config: {},
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    })
  } catch (error) {
    console.error('Mock organization integrations failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Mock endpoint for creating organization
app.post('/api/organizations-mock', async (req, res) => {
  try {
    const { userId, name } = req.body

    if (!userId || !name) {
      return res.status(400).json({
        success: false,
        error: 'userId and name are required'
      })
    }

    // Return mock created organization
    res.json({
      success: true,
      organization: {
        id: `mock-org-${Date.now()}`,
        name: name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Mock create organization failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Mock endpoint for creating organization check
app.post('/api/organizations/:organizationId/checks-mock', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId, name, description } = req.body

    if (!userId || !name) {
      return res.status(400).json({
        success: false,
        error: 'userId and name are required'
      })
    }

    // Return mock created check
    res.json({
      success: true,
      check: {
        id: `mock-check-${Date.now()}`,
        organization_id: organizationId,
        name: name,
        description: description || '',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Mock create organization check failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/organizations', async (req, res) => {
  try {
    const { userId, name } = req.body
    
    if (!userId || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and name are required' 
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.createOrganization(userId, name)
    
    res.json(result)
  } catch (error) {
    console.error('Failed to create organization:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.put('/api/organizations/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId, name } = req.body
    
    if (!userId || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and name are required' 
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.updateOrganization(organizationId, name, userId)
    
    res.json(result)
  } catch (error) {
    console.error('Failed to update organization:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.delete('/api/organizations/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.deleteOrganization(organizationId, userId)
    
    res.json(result)
  } catch (error) {
    console.error('Failed to delete organization:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.get('/api/organizations/:organizationId/integrations', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.getOrganizationIntegrations(organizationId, userId)

    res.json(result)
  } catch (error) {
    console.error('Failed to get organization integrations:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/organizations/:organizationId/integrations', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId, integrationName, apiKey, config, odooUrl, odooDb, odooUsername } = req.body
    
    if (!userId || !integrationName || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId, integrationName, and apiKey are required' 
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.upsertOrganizationIntegration(
      organizationId, 
      integrationName, 
      apiKey, 
      config || {}, 
      userId,
      odooUrl,
      odooDb,
      odooUsername
    )
    
    res.json(result)
  } catch (error) {
    console.error('Failed to create/update organization integration:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.delete('/api/organizations/integrations/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params
    const { userId } = req.query
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId is required' 
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.deleteOrganizationIntegration(integrationId, userId)
    
    res.json(result)
  } catch (error) {
    console.error('Failed to delete organization integration:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/organizations/:organizationId/checks', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.getOrganizationChecks(organizationId, userId)

    res.json(result)
  } catch (error) {
    console.error('Failed to get organization checks:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/organizations/:organizationId/checks', async (req, res) => {
  try {
    const { organizationId } = req.params
    const { userId, name, description } = req.body

    if (!userId || !name) {
      return res.status(400).json({
        success: false,
        error: 'userId and name are required'
      })
    }

    const orgService = await getOrganizationService()
    const result = await orgService.createOrganizationCheck(organizationId, name, description, userId)

    res.json(result)
  } catch (error) {
    console.error('Failed to create organization check:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Update organization check
app.put('/api/checks/:checkId', async (req, res) => {
  try {
    const { checkId } = req.params
    const { userId, name, description, status } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const orgService = await getOrganizationService()
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (status !== undefined) updates.status = status

    const result = await orgService.updateOrganizationCheck(checkId, updates, userId)

    res.json(result)
  } catch (error) {
    console.error('Failed to update organization check:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 404 handler
app.use((req, res) => {
  console.log(`🔍 Unhandled route: ${req.method} ${req.originalUrl}`)
  res.status(404).json({
    error: 'API endpoint not found',
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend API server running on port ${PORT}`)
  console.log(`⚠️ Google Sheets API endpoints are DISABLED`)
  console.log(`🔧 Odoo MCP endpoints available at http://localhost:${PORT}/api/odoo/`)
})
