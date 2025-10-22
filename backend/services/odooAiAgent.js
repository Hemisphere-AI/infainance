/* eslint-env node */
import OpenAI from 'openai';
import MCPOdooClient from './mcpOdooClient.js';
import MCPOdooConsistentService from './mcpOdooConsistentService.js';

/**
 * Odoo AI Agent Service
 * Handles AI-driven Odoo queries and analysis based on check descriptions
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

      // Initialize MCP Odoo Client with custom config if provided
      this.mcpClient = new MCPOdooClient(this.customConfig);
      await this.mcpClient.initialize();

      // Initialize Consistent Service for reliable queries
      this.consistentService = new MCPOdooConsistentService(this.customConfig);
      await this.consistentService.initialize();

      // Load available models and fields for AI context
      await this.loadOdooMetadata();

      console.log('🤖 Odoo AI Agent initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Odoo AI Agent:', error);
      return false;
    }
  }

  async loadOdooMetadata() {
    try {
      // Get all available models
      const modelsResult = await this.mcpClient.listModels();
      if (modelsResult.success) {
        this.availableModels = modelsResult.models || [];
      }

      // Get accounting-specific models for better context
      const accountingResult = await this.mcpClient.listAccountingModels();
      if (accountingResult.success) {
        this.accountingModels = accountingResult.models || [];
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
    try {
      console.log(`🎯 FRONTEND AGENT - Starting check: ${checkTitle}`);
      console.log(`📝 FRONTEND AGENT - Description: ${checkDescription}`);

      // Generate Odoo query using LLM
      console.log('🤖 FRONTEND AGENT - Calling LLM for query generation...');
      const queryPlan = await this.analyzeCheckDescription(checkDescription, checkTitle);
      console.log('🧠 FRONTEND AGENT - LLM Generated Query:', JSON.stringify(queryPlan, null, 2));

      // Execute query using consistent service
      console.log('🔍 FRONTEND AGENT - Executing query with consistent service...');
      const queryResult = await this.consistentService.executeValidatedQuery(queryPlan);
      console.log('📊 FRONTEND AGENT - Query result:', `${queryResult.count} records found`);
      console.log('📋 FRONTEND AGENT - Data preview:', queryResult.data?.slice(0, 2) || 'No data');

      // Return simple result matching test format
      const result = {
        success: true,
        query: queryPlan,
        count: queryResult.count,
        data: queryResult.data || [],
        timestamp: new Date()
      };
      
      console.log('✅ FRONTEND AGENT - Final result:', {
        success: result.success,
        count: result.count,
        dataLength: result.data?.length || 0
      });
      
      return result;

    } catch (error) {
      console.error('❌ FRONTEND AGENT - Check failed:', error.message);
      return {
        success: false,
        error: error.message,
        count: 0,
        data: [],
        timestamp: new Date()
      };
    }
  }

  /**
   * Analyze check description to determine Odoo query parameters
   */
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

    // Check for consistency playbook compliance
    if (queryPlan.model === 'account.move' && queryPlan.domain) {
      const hasStatePosted = queryPlan.domain.some(filter => 
        filter[0] === 'state' && filter[1] === '=' && filter[2] === 'posted'
      );
      if (!hasStatePosted) {
        errors.push('Missing state=posted filter for account.move queries');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Use LLM with conclude tool to analyze results and determine status
   */
  async analyzeResults(description, title, queryResult, acceptanceCriteria = '') {
    console.log('🔍 BACKEND LLM ANALYSIS INPUT:');
    console.log('📋 Description:', description);
    console.log('📋 Title:', title);
    console.log('📊 Model:', queryResult.model);
    console.log('📊 QueryResult:', JSON.stringify(queryResult, null, 2));
    console.log('📋 Acceptance Criteria:', acceptanceCriteria);

    // Check if this is a connection error
    if (queryResult.error) {
      const analysis = `Connection error: ${queryResult.error}. Please check your Odoo configuration and credentials.`;
      console.log('✅ BACKEND LLM ANALYSIS OUTPUT (ERROR):', analysis);
      
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

      // Import tools only
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
}
