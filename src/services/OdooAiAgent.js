/* eslint-env node */
import OpenAI from 'openai';

/**
 * Odoo AI Agent Service
 * Single source of truth for AI-driven Odoo queries and analysis
 * Works in both backend and Netlify environments
 */
export class OdooAiAgent {
  constructor(customConfig = null) {
    this.openai = null;
    this.mcpClient = null;
    this.consistentService = null;
    this.availableModels = [];
    this.availableFields = {};
    this.customConfig = customConfig;
  }

  async initialize() {
    try {
      // Initialize OpenAI
      const apiKey = process.env.VITE_OPENAI_KEY;
      if (!apiKey || apiKey === 'your_openai_api_key_here') {
        throw new Error('OpenAI API key not configured');
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      });

      // Initialize MCP services based on environment
      await this.initializeMCPServices();

      // Load available models and fields for AI context
      await this.loadOdooMetadata();

      console.log('🤖 Odoo AI Agent initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Odoo AI Agent:', error);
      return false;
    }
  }

  async initializeMCPServices() {
    try {
      // For Netlify Functions, we'll use direct Odoo API calls instead of MCP services
      // since the backend services were removed in the simplified architecture
      
      if (this.customConfig) {
        console.log('🔧 Using organization-specific Odoo configuration:', {
          url: this.customConfig.url,
          db: this.customConfig.db,
          hasApiKey: !!this.customConfig.apiKey,
          username: this.customConfig.username
        });
        
        // Initialize direct Odoo connection
        this.odooConfig = this.customConfig;
        console.log('✅ Initialized with organization-specific Odoo config');
        return;
      } else {
        console.log('⚠️ No custom config provided, using environment variables as fallback');
        // Fallback to environment variables if no custom config
        this.odooConfig = {
          url: process.env.ODOO_URL,
          db: process.env.ODOO_DB,
          username: process.env.ODOO_USERNAME,
          apiKey: process.env.ODOO_API_KEY
        };
        console.log('✅ Initialized with environment variables');
      }
    } catch (error) {
      console.error('❌ Odoo configuration initialization failed:', error);
      throw error;
    }
  }

  async loadOdooMetadata() {
    try {
      // For simplified architecture, we'll load basic Odoo models
      // This can be enhanced later with direct Odoo API calls
      if (this.odooConfig) {
        console.log('📋 Loading Odoo metadata for organization:', this.odooConfig.db);
        
        // Basic accounting models that are commonly used
        this.availableModels = [
          'account.move',
          'account.move.line', 
          'account.account',
          'res.partner',
          'product.product',
          'sale.order',
          'purchase.order'
        ];
        
        console.log('✅ Loaded basic Odoo models for AI context');
      } else {
        console.log('⚠️ No Odoo configuration available for metadata loading');
      }

      console.log(`📊 Loaded ${this.availableModels.length} Odoo models for AI context`);
    } catch (error) {
      console.error('⚠️ Failed to load Odoo metadata:', error);
    }
  }

  /**
   * Execute an AI-driven check based on description
   */
  async executeCheck(checkDescription, checkTitle = 'Custom Check', acceptanceCriteria = '') {
    const startTime = Date.now(); // Start timing
    
    try {
      console.log(`🎯 ODOO STEP 1: Starting check: ${checkTitle}`);
      console.log(`📝 ODOO STEP 1: Description: ${checkDescription}`);
      console.log(`📋 ODOO STEP 1: Acceptance Criteria: ${acceptanceCriteria}`);

      // Generate Odoo query using LLM
      console.log('🤖 ODOO STEP 2: Calling LLM for query generation...');
      const queryPlan = await this.analyzeCheckDescription(checkDescription, checkTitle);
      console.log('🧠 ODOO STEP 2: LLM Generated Query:', JSON.stringify(queryPlan, null, 2));

      // Execute query using direct Odoo API calls
      console.log('🔍 ODOO STEP 3: Executing query with organization-specific Odoo config...');
      const queryResult = await this.executeOdooQuery(queryPlan);
      console.log('📊 ODOO STEP 3: Query result:', `${queryResult.count} records found`);
      console.log('📋 ODOO STEP 3: Data preview:', queryResult.data?.slice(0, 2) || 'No data');

      // Generate LLM analysis of the results
      console.log('🧠 ODOO STEP 4: Generating LLM analysis...');
      const analysisResult = await this.analyzeResults(checkDescription, checkTitle, queryResult, acceptanceCriteria);
      console.log('📝 ODOO STEP 4: LLM Analysis:', analysisResult.analysis);

      // Calculate total execution time
      const totalDuration = Date.now() - startTime;

      // Return result with proper LLM analysis
      const result = {
        success: true,
        query: queryPlan,
        queryPlan: queryPlan, // Add queryPlan field for backend compatibility
        count: queryResult.count,
        data: queryResult.records || [],
        records: queryResult.records || [], // Use records from consistent service
        llmAnalysis: analysisResult.analysis,
        tokensUsed: analysisResult.tokensUsed || 0,
        duration: totalDuration, // Use actual measured duration
        timestamp: new Date()
      };
      
      console.log('✅ ODOO STEP 5: Final result:', {
        success: result.success,
        count: result.count,
        dataLength: result.data?.length || 0,
        recordsLength: result.records?.length || 0,
        hasLlmAnalysis: !!result.llmAnalysis,
        hasQuery: !!result.query,
        hasQueryPlan: !!result.queryPlan,
        recordsPreview: result.records?.slice(0, 2) || 'No records'
      });
      
      return result;

    } catch (error) {
      const totalDuration = Date.now() - startTime; // Calculate duration even on error
      console.error('❌ ODOO - Check failed:', error.message);
      return {
        success: false,
        error: error.message,
        count: 0,
        data: [],
        duration: totalDuration,
        timestamp: new Date()
      };
    }
  }

  /**
   * Analyze check description to determine Odoo query parameters
   */
  async analyzeCheckDescription(description) {
    const systemPrompt = `You are an expert Odoo ERP analyst. Generate an Odoo query based on the check description.

## OUTPUT FORMAT - ALWAYS OUTPUT THIS EXACT JSON FORMAT:

{
  "model": ...,
  "domain": [
    ["...", ...]
  ],
  "fields": ["...", ...],
  "limit": 1000,
  "order": "id asc"
}

## Critical Rules:
- Domain must be array of triplets ONLY: [field, operator, value]
- NO OR operators ("|") - use simple AND filters only

Return ONLY the JSON object, no other text.`;

    const userMessage = `Generate an Odoo query based on this check description: ${description}`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0,
      top_p: 1,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    
    try {
      // Remove markdown code blocks if present
      let jsonContent = content;
      if (content.startsWith('```json')) {
        jsonContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        jsonContent = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const queryPlan = JSON.parse(jsonContent);
      console.log('🤖 AI Query Plan:', queryPlan);
      
      // Validate query plan against consistency playbook
      const validation = this.validateQueryPlan(queryPlan);
      if (!validation.isValid) {
        throw new Error(`Invalid query plan: ${validation.errors.join(', ')}`);
      }
      
      return queryPlan;
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', content);
      console.error('❌ Parse error:', parseError.message);
      throw new Error('AI returned invalid query plan');
    }
  }

  /**
   * Execute Odoo query using organization-specific configuration
   */
  async executeOdooQuery(queryPlan) {
    try {
      if (!this.odooConfig) {
        throw new Error('No Odoo configuration available');
      }

      console.log('🔧 Executing query with Odoo config:', {
        url: this.odooConfig.url,
        db: this.odooConfig.db,
        model: queryPlan.model
      });

      // Import xmlrpc for Odoo API calls
      const xmlrpc = await import('xmlrpc');
      
      // Create Odoo XML-RPC client with timeout settings
      const client = xmlrpc.createClient({
        host: this.odooConfig.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        port: this.odooConfig.url.includes('https') ? 443 : 80,
        path: '/xmlrpc/2/object',
        basic_auth: {
          user: this.odooConfig.username,
          pass: this.odooConfig.apiKey
        },
        timeout: 5000, // 5 second timeout
        headers: {
          'Connection': 'keep-alive',
          'User-Agent': 'Netlify-Function/1.0'
        }
      });

      // Authenticate with Odoo (with timeout)
      const uid = await this.authenticateOdooWithTimeout(client);
      if (!uid) {
        throw new Error('Failed to authenticate with Odoo');
      }

      console.log('✅ Authenticated with Odoo, UID:', uid);

      // Execute search and read (with timeout)
      const searchResult = await this.searchOdooRecordsWithTimeout(client, uid, queryPlan);
      console.log('📊 Search result:', searchResult?.length || 0, 'records');

      return {
        success: true,
        count: searchResult?.length || 0,
        records: searchResult || [],
        data: searchResult || []
      };

    } catch (error) {
      console.error('❌ Failed to execute Odoo query:', error);
      
      // Return a more informative error for timeouts
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        console.log('⚠️ Odoo timeout - returning fallback response');
        // Return a fallback response instead of complete failure
        return {
          success: true,
          count: 0,
          records: [],
          data: [],
          warning: 'Odoo connection timeout - results may be incomplete',
          error: 'Connection timeout - please check your Odoo instance'
        };
      }
      
      return {
        success: false,
        count: 0,
        records: [],
        data: [],
        error: error.message
      };
    }
  }

  /**
   * Authenticate with Odoo (with timeout)
   */
  async authenticateOdooWithTimeout(client) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Odoo authentication timeout'));
      }, 3000); // 3 second timeout for auth

      client.methodCall('authenticate', [
        this.odooConfig.db,
        this.odooConfig.username,
        this.odooConfig.apiKey,
        {}
      ], (error, uid) => {
        clearTimeout(timeout);
        if (error) {
          console.error('❌ Odoo authentication failed:', error);
          reject(error);
        } else {
          console.log('✅ Odoo authentication successful, UID:', uid);
          resolve(uid);
        }
      });
    });
  }

  /**
   * Authenticate with Odoo (legacy method)
   */
  async authenticateOdoo(client) {
    return this.authenticateOdooWithTimeout(client);
  }

  /**
   * Search and read records from Odoo (with timeout)
   */
  async searchOdooRecordsWithTimeout(client, uid, queryPlan) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Odoo search timeout'));
      }, 5000); // 5 second timeout for search

      // First, search for record IDs
      client.methodCall('execute_kw', [
        this.odooConfig.db,
        uid,
        this.odooConfig.apiKey,
        queryPlan.model,
        'search',
        [queryPlan.domain || []],
        { limit: Math.min(queryPlan.limit || 50, 50) } // Limit to 50 records max
      ], (error, recordIds) => {
        if (error) {
          clearTimeout(timeout);
          console.error('❌ Odoo search failed:', error);
          reject(error);
          return;
        }

        console.log('🔍 Found record IDs:', recordIds?.length || 0);

        if (!recordIds || recordIds.length === 0) {
          clearTimeout(timeout);
          console.log('📭 No records found');
          resolve([]);
          return;
        }

        // Then, read the records (with a new timeout)
        const readTimeout = setTimeout(() => {
          reject(new Error('Odoo read timeout'));
        }, 3000); // 3 second timeout for read

        client.methodCall('execute_kw', [
          this.odooConfig.db,
          uid,
          this.odooConfig.apiKey,
          queryPlan.model,
          'read',
          [recordIds],
          { fields: queryPlan.fields || [] }
        ], (readError, records) => {
          clearTimeout(timeout);
          clearTimeout(readTimeout);
          if (readError) {
            console.error('❌ Odoo read failed:', readError);
            reject(readError);
          } else {
            console.log('📋 Read records:', records?.length || 0);
            resolve(records || []);
          }
        });
      });
    });
  }

  /**
   * Search and read records from Odoo (legacy method)
   */
  async searchOdooRecords(client, uid, queryPlan) {
    return this.searchOdooRecordsWithTimeout(client, uid, queryPlan);
  }

  /**
   * Validate query plan against consistency playbook
   */
  validateQueryPlan(queryPlan) {
    const errors = [];

    // Check required fields
    if (!queryPlan.model) {
      errors.push('Missing model');
    }

    if (!Array.isArray(queryPlan.domain)) {
      errors.push('Domain must be an array of triplets');
    } else {
      // Validate domain format
      queryPlan.domain.forEach((filter, index) => {
        if (!Array.isArray(filter) || filter.length !== 3) {
          errors.push(`Domain filter ${index} must be [field, operator, value]`);
        }
      });
    }

    if (!Array.isArray(queryPlan.fields)) {
      errors.push('Fields must be an array');
    }

    if (queryPlan.limit && (typeof queryPlan.limit !== 'number' || queryPlan.limit <= 0 || queryPlan.limit > 1000)) {
      errors.push('Limit must be a positive number <= 1000');
    }

    if (queryPlan.order && typeof queryPlan.order !== 'string') {
      errors.push('Order must be a string');
    }

    // Additional validation can be added here for specific business rules
    // This keeps the core service generic and flexible

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Use LLM with conclude tool to analyze results and determine status
   */
  async analyzeResults(description, title, queryResult, acceptanceCriteria = '') {
    console.log('🔍 ODOO LLM ANALYSIS INPUT:');
    console.log('📋 Description:', description);
    console.log('📋 Title:', title);
    console.log('📊 Model:', queryResult.model);
    console.log('📊 QueryResult:', JSON.stringify(queryResult, null, 2));
    console.log('📋 Acceptance Criteria:', acceptanceCriteria);

    // Check if this is a connection error
    if (queryResult.error) {
      const analysis = `Connection error: ${queryResult.error}. Please check your Odoo configuration and credentials.`;
      console.log('✅ ODOO LLM ANALYSIS OUTPUT (ERROR):', analysis);
      
      return {
        success: false,
        analysis,
        tokensUsed: 0,
        error: queryResult.error
      };
    }

    try {
      const count = Number(queryResult?.count || 0);
      const records = queryResult?.records || [];
      
      // Create a detailed analysis of the results
      const analysisData = {
        checkTitle: title,
        checkDescription: description,
        queryModel: queryResult.model,
        recordCount: count,
        records: records.slice(0, 5), // Show first 5 records for context
        acceptanceCriteria: acceptanceCriteria || 'No acceptance criteria defined'
      };

      const systemPrompt = `You are an expert bookkeeping analyst. Your task is to analyze check results and determine the status based on the acceptance criteria.

## Your Task:
1. Analyze the check results and acceptance criteria
2. Compare the analysis with the acceptance criteria
3. Use the 'conclude' tool to provide your final assessment

## Status Determination Rules:
- **passed**: The analysis confirms the acceptance criteria (e.g., "9 records found" matches "There are 9 records found")
- **failed**: The analysis contradicts the acceptance criteria (e.g., found 5 but expected 9)
- **unknown**: The analysis is inconclusive or insufficient data
- **warning**: The analysis partially meets criteria but has concerns

## Important:
- You MUST use the 'conclude' tool to provide your final answer
- Compare the actual results with the acceptance criteria
- Be precise in your status determination

## Conclude Tool Usage:
When using the conclude tool, you MUST determine the status based on the analysis:
- **passed**: The check meets all acceptance criteria
- **failed**: The check does not meet the acceptance criteria or critical issues were found
- **unknown**: The analysis is inconclusive or insufficient data was available
- **warning**: The check partially meets criteria but has concerns or minor issues

The status will automatically update the check's visual indicator:
- passed = blue checkmark
- failed = red cross  
- unknown = yellow question mark (orange)
- warning = orange warning icon
- open = blue open box (unchecked default)`;

      const userMessage = `Check Analysis Data:
${JSON.stringify(analysisData, null, 2)}

Please analyze these results and use the 'conclude' tool to determine the status based on the acceptance criteria.`;

      // Define tools inline for analysis
      const tools = [
        {
          type: "function",
          function: {
            name: "conclude",
            description: "Conclude the analysis with a final status determination",
            parameters: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  enum: ["passed", "failed", "unknown", "warning"],
                  description: "The final status of the check"
                },
                reasoning: {
                  type: "string",
                  description: "Detailed reasoning for the status determination"
                },
                summary: {
                  type: "string", 
                  description: "Brief summary of the analysis"
                }
              },
              required: ["status", "reasoning", "summary"]
            }
          }
        }
      ];
      
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
            analysis: args.reasoning,
            status: args.status,
            summary: args.summary,
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
}
