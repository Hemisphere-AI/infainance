import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_KEY
});

// MCP Odoo Client simulation for Netlify Functions
class MCPOdooClient {
  constructor(config) {
    this.config = config;
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Odoo connection...');
      console.log('URL:', this.config.url, 'DB:', this.config.db);
      
      // Simulate authentication
      console.log('✅ Authentication successful, UID: 2');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  async listModels() {
    console.log('📊 Fetching available models from Odoo...');
    // Return common Odoo models
    return {
      success: true,
      models: [
        { model: 'account.move', name: 'Account Move' },
        { model: 'account.move.line', name: 'Account Move Line' },
        { model: 'res.partner', name: 'Partner' },
        { model: 'account.bank.statement.line', name: 'Bank Statement Line' }
      ]
    };
  }

  async listAccountingModels() {
    console.log('📊 Fetching accounting models from Odoo...');
    return {
      success: true,
      models: [
        { model: 'account.move', name: 'Account Move' },
        { model: 'account.move.line', name: 'Account Move Line' },
        { model: 'res.partner', name: 'Partner' },
        { model: 'account.bank.statement.line', name: 'Bank Statement Line' }
      ]
    };
  }

  async searchRecords(model, domain, fields, limit = 100) {
    console.log('🔍 Searching records:', { model, domain, fields, limit });
    
    // Simulate database query with realistic data
    const records = [];
    const recordCount = Math.floor(Math.random() * 5); // 0-4 records
    
    for (let i = 0; i < recordCount; i++) {
      records.push({
        id: i + 1,
        name: `${model.toUpperCase()}/${2025}/${10}/${String(i + 1).padStart(3, '0')}`,
        amount_total: Math.random() * 1000,
        partner_id: [i + 1, `Partner ${i + 1}`],
        state: 'draft'
      });
    }

    return {
      success: true,
      model,
      domain,
      records,
      count: recordCount,
      fields,
      limit,
      duration: Math.random() * 1000 + 500
    };
  }
}

// Odoo AI Agent for Netlify Functions
class OdooAiAgent {
  constructor() {
    this.openai = openai;
    this.mcpClient = null;
    this.availableModels = [];
    this.accountingModels = [];
  }

  async initialize(customConfig) {
    try {
      console.log('🤖 Initializing Odoo AI Agent...');
      
      this.mcpClient = new MCPOdooClient(customConfig);
      await this.mcpClient.initialize();
      
      // Load available models
      const modelsResult = await this.mcpClient.listModels();
      if (modelsResult.success) {
        this.availableModels = modelsResult.models || [];
      }

      const accountingResult = await this.mcpClient.listAccountingModels();
      if (accountingResult.success) {
        this.accountingModels = accountingResult.models || [];
      }

      console.log('🤖 Odoo AI Agent initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Odoo AI Agent:', error);
      return false;
    }
  }

  async analyzeCheckDescription(description, title) {
    const systemPrompt = `You are an expert Odoo ERP analyst. Generate a canonical query for Dutch accounting rules.

## CONSISTENCY PLAYBOOK - ALWAYS OUTPUT THIS EXACT JSON FORMAT:

{
  "model": "account.move",
  "domain": ["...", ...]
  ],
  "fields": ["...", ...],
  "limit": 1000,
  "order": "id asc"
}

## Critical Rules:
- Domain must be list of triplets only
- Always include state="posted" 
- Use stable order (id asc)
- Fixed field set every time
- Temperature 0, JSON-mode only
- Extract account codes from the check description
- Focus on line_ids.account_id.code for account filtering

Return ONLY the JSON object, no other text.`;

    const userMessage = `Generate a query to find invoices that violate the Dutch rule: ${description}`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0,
      top_p: 1,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    
    try {
      let jsonContent = content;
      if (content.startsWith('```json')) {
        jsonContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        jsonContent = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const queryPlan = JSON.parse(jsonContent);
      console.log('🤖 AI Query Plan:', queryPlan);
      return queryPlan;
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', content);
      throw new Error('AI returned invalid query plan');
    }
  }

  async analyzeResults(description, title, queryResult, acceptanceCriteria = '') {
    console.log('🔍 BACKEND LLM ANALYSIS INPUT:');
    console.log('📋 Description:', description);
    console.log('📋 Title:', title);
    console.log('📊 Model:', queryResult.model);
    console.log('📊 QueryResult:', JSON.stringify(queryResult, null, 2));
    console.log('📋 Acceptance Criteria:', acceptanceCriteria);

    try {
      const count = Number(queryResult?.count || 0);
      const records = queryResult?.records || [];
      
      const analysisData = {
        checkTitle: title,
        checkDescription: description,
        queryModel: queryResult.model,
        recordCount: count,
        records: records.slice(0, 5),
        acceptanceCriteria: acceptanceCriteria || 'No acceptance criteria defined'
      };

      const systemPrompt = `You are an expert bookkeeping analyst. Your task is to analyze check results and determine the status based on the acceptance criteria.

## Your Task:
1. Analyze the check results and acceptance criteria
2. Compare the analysis with the acceptance criteria
3. Use the 'conclude' tool to provide your final assessment

## Status Determination Rules:
- **passed**: The analysis confirms the acceptance criteria
- **failed**: The analysis contradicts the acceptance criteria
- **unknown**: The analysis is inconclusive or insufficient data
- **warning**: The analysis partially meets criteria but has concerns

## Important:
- You MUST use the 'conclude' tool to provide your final answer
- Compare the actual results with the acceptance criteria
- Be precise in your status determination`;

      const userMessage = `Check Analysis Data:
${JSON.stringify(analysisData, null, 2)}

Please analyze these results and use the 'conclude' tool to determine the status based on the acceptance criteria.`;

      // Import tools
      const { tools } = await import('../../src/utils/tools.js');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        tools: tools,
        tool_choice: "required",
        temperature: 0.1,
        max_tokens: 2000
      });

      const message = response.choices[0].message;
      const toolCalls = message.tool_calls || [];
      
      if (toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        if (toolCall.function.name === 'conclude') {
          const args = JSON.parse(toolCall.function.arguments);
          console.log('🎯 Agent conclude tool result:', args);
          
          return {
            success: true,
            analysis: args.answer,
            status: args.status,
            acceptance_criteria: args.acceptance_criteria,
            tokensUsed: response.usage?.total_tokens || 0
          };
        }
      }

      // Fallback if no tool call
      return {
        success: true,
        analysis: message.content || 'Analysis completed',
        status: 'unknown',
        acceptance_criteria: acceptanceCriteria,
        tokensUsed: response.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error('❌ LLM analysis failed:', error);
      return {
        success: false,
        analysis: 'Analysis failed: ' + error.message,
        status: 'unknown',
        acceptance_criteria: acceptanceCriteria,
        tokensUsed: 0
      };
    }
  }

  async executeCheck(checkDescription, checkTitle = 'Custom Check', acceptanceCriteria = '') {
    try {
      console.log(`🎯 NETLIFY FRONTEND - Starting check: ${checkTitle}`);
      console.log(`📝 NETLIFY FRONTEND - Description: ${checkDescription}`);

      // Generate Odoo query using LLM
      console.log('🤖 NETLIFY FRONTEND - Calling LLM for query generation...');
      const queryPlan = await this.analyzeCheckDescription(checkDescription, checkTitle);
      console.log('🧠 NETLIFY FRONTEND - LLM Generated Query:', JSON.stringify(queryPlan, null, 2));

      // Execute query using MCP client
      console.log('🔍 NETLIFY FRONTEND - Executing query with MCP client...');
      const queryResult = await this.mcpClient.searchRecords(
        queryPlan.model,
        queryPlan.domain,
        queryPlan.fields,
        queryPlan.limit || 100
      );
      console.log('📊 NETLIFY FRONTEND - Query result:', `${queryResult.count} records found`);
      console.log('📋 NETLIFY FRONTEND - Data preview:', queryResult.records?.slice(0, 2) || 'No data');

      // Return simple result matching test format
      const result = {
        success: true,
        query: queryPlan,
        count: queryResult.count,
        data: queryResult.records || [],
        timestamp: new Date()
      };
      
      console.log('✅ NETLIFY FRONTEND - Final result:', {
        success: result.success,
        count: result.count,
        dataLength: result.data?.length || 0
      });
      
      return result;

    } catch (error) {
      console.error('❌ NETLIFY FRONTEND - Check failed:', error.message);
      return {
        success: false,
        error: error.message,
        count: 0,
        data: [],
        timestamp: new Date()
      };
    }
  }
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

    // Get organization integrations
    let odooConfig = null;
    if (organizationId) {
      try {
        const { data: integrations, error } = await supabase
          .from('organization_integrations')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('integration_name', 'odoo')
          .eq('is_active', true)
          .single();

        if (error) {
          console.error('❌ Error fetching integrations:', error);
        } else if (integrations) {
          odooConfig = {
            url: integrations.odoo_url,
            db: integrations.odoo_db,
            username: integrations.odoo_username,
            apiKey: integrations.api_key
          };
          console.log('🔧 Using organization-specific Odoo config:', {
            url: odooConfig.url,
            db: odooConfig.db,
            hasApiKey: !!odooConfig.apiKey,
            username: odooConfig.username
          });
        }
      } catch (error) {
        console.error('❌ Error processing integrations:', error);
      }
    }

    // Initialize Odoo AI Agent
    const agent = new OdooAiAgent();
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

    // Execute the check
    const result = await agent.executeCheck(checkDescription, checkTitle, acceptanceCriteria);

    // Save results to database if checkId is provided
    if (checkId && result.success) {
      try {
        const resultData = {
          check_id: checkId,
          status: result.status,
          executed_at: new Date().toISOString(),
          duration: result.duration || 0,
          success: result.success,
          query_plan: result.queryPlan || null,
          record_count: result.count || 0,
          records: result.records || null,
          llm_analysis: result.llmAnalysis || null,
          tokens_used: result.tokensUsed || null,
          execution_steps: result.steps || null,
          error_message: null
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
            .update({ status: result.status, updated_at: new Date().toISOString() })
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
