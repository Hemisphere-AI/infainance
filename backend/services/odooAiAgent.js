/* eslint-env node */
import OpenAI from 'openai';
import MCPOdooClient from './mcpOdooClient.js';

/**
 * Odoo AI Agent Service
 * Handles AI-driven Odoo queries and analysis based on check descriptions
 */
export class OdooAiAgent {
  constructor() {
    this.openai = null;
    this.mcpClient = null;
    this.availableModels = [];
    this.availableFields = {};
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

      // Initialize MCP Odoo Client
      this.mcpClient = new MCPOdooClient();
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
  async executeCheck(checkDescription, checkTitle = 'Custom Check') {
    const steps = [];
    let finalResult = null;

    try {
      // Step 1: AI Analysis of Check Description
      steps.push({
        step: 'analyze',
        status: 'running',
        message: 'Analyzing check description with AI',
        timestamp: new Date()
      });

      const queryPlan = await this.analyzeCheckDescription(checkDescription, checkTitle);
      
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

      const queryResult = await this.mcpClient.searchRecords(
        queryPlan.model,
        queryPlan.domain,
        queryPlan.fields,
        queryPlan.limit || 100
      );

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

      const analysisResult = await this.analyzeResults(checkDescription, checkTitle, queryResult);

      steps.push({
        step: 'analyze_results',
        status: 'completed',
        message: 'AI analysis completed',
        timestamp: new Date()
      });

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
        records: queryResult.records || [],
        queryPlan: queryPlan,
        steps: steps,
        timestamp: new Date().toISOString()
      };

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
4. **limit**: Maximum records to return (default 100)

## Examples:
- "Creditors with debit balances" → model: 'account.move.line', domain: [['account_type', '=', 'liability_payable'], ['balance', '<', 0]]
- "Draft vendor bills" → model: 'account.move', domain: [['state', '=', 'draft'], ['move_type', '=', 'in_invoice']]
- "Unreconciled bank statements" → model: 'account.bank.statement.line', domain: [['is_reconciled', '=', false]]

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

Determine the appropriate Odoo query parameters for this bookkeeping check.`;

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
   * Analyze query results with AI
   */
  async analyzeResults(description, title, queryResult) {
    const systemPrompt = `You are an expert Odoo bookkeeping analyst. Answer the check question directly based on the provided data. Give a brief, practical response in 1-2 sentences.`;

    const userMessage = `Check: ${description}
Records found: ${queryResult.count}
${queryResult.error ? `Error: ${queryResult.error}` : ''}
${queryResult.records && queryResult.records.length > 0 ? 
  `Data: ${JSON.stringify(queryResult.records.slice(0, 2), null, 2)}` : 
  'No records found'}

Answer the check question based on this data.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.1,
      max_tokens: 150 // Very short responses
    });

    return {
      success: true,
      analysis: response.choices[0].message.content,
      tokensUsed: response.usage?.total_tokens || 0
    };
  }
}
