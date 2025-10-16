/* eslint-env node */
import OpenAI from 'openai';

/**
 * LLM ERP Service
 * Handles all ERP/Odoo-specific LLM operations and analysis
 */
export class LLMErpService {
  constructor(user = null) {
    this.user = user; // Store user information for token tracking
  }

  /**
   * Analyze Odoo check results using LLM
   * This method processes Odoo check data and provides intelligent insights
   */
  async analyzeOdooCheck(checkData, checkResults) {
    try {
      // Use environment API key (works in both browser and Node.js)
      const apiKeyToUse = typeof import.meta !== 'undefined' && import.meta.env 
        ? import.meta.env.VITE_OPENAI_KEY 
        : process.env.VITE_OPENAI_KEY;

      // Check if API key is properly configured
      if (!apiKeyToUse || apiKeyToUse === 'your_openai_api_key_here') {
        throw new Error('OpenAI API key not configured.');
      }

      // Create OpenAI client with the appropriate API key
      const openaiClient = new OpenAI({
        apiKey: apiKeyToUse,
        dangerouslyAllowBrowser: true
      });

      // Build analysis message
      const analysisMessage = `Check: ${checkData.description}
Records found: ${checkResults.count}
${checkResults.error ? `Error: ${checkResults.error}` : ''}
${checkResults.records && checkResults.records.length > 0 ? 
  `Data: ${JSON.stringify(checkResults.records.slice(0, 2), null, 2)}` : 
  'No records found'}

Answer the check question based on this data.`;

      // Build conversation messages with Odoo-specific system prompt
      const odooSystemPrompt = `You are an expert Odoo bookkeeping analyst. Answer the check question directly based on the provided data. Give a brief, practical response in 1-2 sentences.`;

      const messages = [
        {
          role: "system",
          content: odooSystemPrompt
        },
        {
          role: "user",
          content: analysisMessage
        }
      ];

      // Get LLM analysis
      let response = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        temperature: 0.1, // Lower temperature for more consistent analysis
        max_tokens: 150 // Very short responses
      });

      return {
        success: true,
        analysis: response.choices[0].message.content,
        tokensUsed: response.usage?.total_tokens || 0,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Odoo check analysis error:', error);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
