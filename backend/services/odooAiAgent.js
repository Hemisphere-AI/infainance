/* eslint-env node */
import OpenAI from 'openai';
import MCPOdooClient from './mcpOdooClient.js';

/**
 * Odoo AI Agent Service
 * Handles AI-driven Odoo queries and analysis based on check descriptions
 */
export class OdooAiAgent {
  constructor(customConfig = null) {
    this.openai = null;
    this.mcpClient = null;
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
    const steps = [];
    let finalResult = null;

    try {
      console.log(`🎯 Starting check: ${checkTitle}`);

      // Step 1: AI Analysis of Check Description
      steps.push({
        step: 'analyze',
        status: 'running',
        message: 'Analyzing check description with AI',
        timestamp: new Date()
      });

      const queryPlan = await this.analyzeCheckDescription(checkDescription, checkTitle);
      console.log('📋 Query plan:', queryPlan.model, queryPlan.domain);
      
      steps.push({
        step: 'analyze',
        status: 'completed',
        message: `AI determined: ${queryPlan.model} with domain ${JSON.stringify(queryPlan.domain)}`,
        timestamp: new Date()
      });

      // Step 2: Execute Odoo Query
      steps.push({
        step: 'query',
        status: 'running',
        message: 'Executing Odoo query',
        timestamp: new Date()
      });

      let queryResult;
      let analysisResult;
      try {
        queryResult = await this.mcpClient.searchRecords(
          queryPlan.model,
          queryPlan.domain,
          queryPlan.fields,
          queryPlan.limit || 100
        );

        console.log('📊 Query result:', `${queryResult.count} records found from model: ${queryPlan.model}`);

        steps.push({
          step: 'query',
          status: 'completed',
          message: `Found ${queryResult.count} records`,
          timestamp: new Date()
        });

        // Step 3: AI Analysis of Results
        steps.push({
          step: 'analyze_results',
          status: 'running',
          message: 'Analyzing results with AI',
          timestamp: new Date()
        });

        analysisResult = await this.analyzeResults(checkDescription, checkTitle, queryResult, acceptanceCriteria);
        console.log('✅ Analysis result:', analysisResult.analysis);

        steps.push({
          step: 'analyze_results',
          status: 'completed',
          message: 'AI analysis completed',
          timestamp: new Date()
        });

      } catch (queryError) {
        console.error('❌ Odoo query failed:', queryError.message);
        
        // Check if this is a connection/authentication error
        const isConnectionError = queryError.message.includes('authentication') || 
                                 queryError.message.includes('connection') ||
                                 queryError.message.includes('timeout') ||
                                 queryError.message.includes('network') ||
                                 queryError.message.includes('refused') ||
                                 queryError.message.includes('unauthorized') ||
                                 queryError.message.includes('forbidden');

        steps.push({
          step: 'query',
          status: 'failed',
          message: isConnectionError ? 'Failed to connect to Odoo database' : `Query failed: ${queryError.message}`,
          timestamp: new Date()
        });

        // Return connection error immediately without analysis
        if (isConnectionError) {
          return {
            success: false,
            error: 'Unable to connect to Odoo database. Please check your Odoo configuration and credentials.',
            connectionError: true,
            steps: steps,
            timestamp: new Date().toISOString()
          };
        }

        // For other query errors, still try to analyze
        queryResult = {
          success: false,
          model: queryPlan.model,
          domain: queryPlan.domain,
          records: [],
          count: 0,
          error: queryError.message
        };

        analysisResult = await this.analyzeResults(checkDescription, checkTitle, queryResult, acceptanceCriteria);
        console.log('✅ Analysis result (with error):', analysisResult.analysis);

        steps.push({
          step: 'analyze_results',
          status: 'completed',
          message: 'AI analysis completed with error context',
          timestamp: new Date()
        });
      }

      // Step 4: Complete
      steps.push({
        step: 'complete',
        status: 'completed',
        message: 'Check execution completed',
        timestamp: new Date()
      });

      finalResult = {
        success: true,
        count: queryResult.count,
        duration: Date.now() - steps[0].timestamp.getTime(),
        tokensUsed: analysisResult.tokensUsed || 0,
        llmAnalysis: analysisResult.analysis,
        status: analysisResult.status || 'unknown',
        records: queryResult.records || [],
        queryPlan: queryPlan,
        steps: steps,
        timestamp: new Date().toISOString()
      };

      console.log('🎯 Check completed successfully');

      return finalResult;

    } catch (error) {
      console.error('❌ Check execution failed:', error);
      
      // Add error step
      steps.push({
        step: 'error',
        status: 'failed',
        message: `Error: ${error.message}`,
        timestamp: new Date()
      });

      return {
        success: false,
        error: error.message,
        steps: steps,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze check description to determine Odoo query parameters
   */
  async analyzeCheckDescription(description, title) {

    const systemPrompt = `You are an expert Odoo ERP analyst. Your task is to analyze a bookkeeping check description and determine the appropriate Odoo query parameters.

## Available Odoo Models (most relevant for bookkeeping):
${this.accountingModels?.map(m => `- ${m.model}: ${m.name}`).join('\n') || 'Loading models...'}

## Your Task:
Given a check description, determine:
1. **model**: The Odoo model to query (e.g., 'account.move', 'account.move.line', 'res.partner')
2. **domain**: The search domain as a JavaScript array (e.g., [['state', '=', 'draft']])
3. **fields**: Relevant fields to retrieve (e.g., ['id', 'name', 'amount_total', 'partner_id'])
   - ALWAYS include 'name' field for record identification (shows journal entry numbers like JOURNAL/2025/10/001)
4. **limit**: Maximum records to return (default 100)

## Model Selection Guidelines:
- Use 'account.move' for invoices, bills, and journal entries (the main documents)
- Use 'account.move.line' only when you need to analyze individual accounting line items
- Use 'account.bank.statement.line' for bank transactions
- Use 'res.partner' for customer/vendor information

## IMPORTANT: For creditor-related checks, use 'account.move' to find bills/invoices, NOT 'account.move.line'


## Response Format:
Return ONLY a valid JSON object with this exact structure:
{
  "model": "model_name",
  "domain": [["field", "operator", "value"]],
  "fields": ["field1", "field2", "field3"],
  "limit": 100,
  "reasoning": "Brief explanation of your choices"
}`;

    const userMessage = `Check Title: "${title}"
Check Description: "${description}"

Determine the appropriate Odoo query parameters for this bookkeeping check.
`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.1,
      max_tokens: 1000
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
      return queryPlan;
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', content);
      console.error('❌ Parse error:', parseError.message);
      throw new Error('AI returned invalid query plan');
    }
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
