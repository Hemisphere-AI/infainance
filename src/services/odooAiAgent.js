// Odoo AI Agent Service
// Processes Odoo MCP data using AI tools to provide intelligent analysis

import OpenAI from 'openai';
import { odooTools, ODOO_ANALYSIS_PROMPT } from '../utils/odooTools.js';

export class OdooAiAgent {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_KEY;
    this.openai = new OpenAI({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async analyzeOdooData(mcpResult) {
    try {
      console.log('🤖 AI Agent analyzing Odoo data:', mcpResult);

      // Build conversation messages
      const messages = [
        {
          role: "system",
          content: ODOO_ANALYSIS_PROMPT
        },
        {
          role: "user",
          content: `Please analyze this Odoo data and provide intelligent insights:

Description: ${mcpResult.description}
Routes: ${JSON.stringify(mcpResult.routes, null, 2)}
Summary: ${mcpResult.summary}

Use the available tools to analyze the data and provide recommendations.`
        }
      ];

      // Call OpenAI with tools
      let response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: odooTools,
        tool_choice: "auto",
        temperature: 0.1
      });

      // Handle tool calls
      let finalResponse = response;
      let iterationCount = 0;
      const maxIterations = 10;

      while (response.choices[0]?.message?.tool_calls?.length > 0 && iterationCount < maxIterations) {
        iterationCount++;
        const toolCalls = response.choices[0].message.tool_calls;
        
        console.log(`🔧 AI Agent tool call ${iterationCount}:`, toolCalls.map(call => ({
          id: call.id,
          function: call.function.name,
          arguments: call.function.arguments
        })));

        // Add assistant message to conversation
        messages.push(response.choices[0].message);

        // Execute tool calls
        for (const call of toolCalls) {
          const toolArgs = JSON.parse(call.function.arguments);
          const result = await this.executeOdooTool(call.function.name, toolArgs, mcpResult);
          
          console.log(`✅ Tool ${call.function.name} result:`, result);

          // Add tool result to conversation
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });
        }

        // Get next response
        response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          tools: odooTools,
          tool_choice: "auto",
          temperature: 0.1
        });

        finalResponse = response;
      }

      // Return the final response
      const aiAnalysis = finalResponse.choices[0]?.message?.content || "No analysis generated";
      
      return {
        success: true,
        mcpResult,
        aiAnalysis,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ AI Agent analysis failed:', error);
      return {
        success: false,
        error: error.message,
        mcpResult,
        timestamp: new Date().toISOString()
      };
    }
  }

  async executeOdooTool(toolName, args, mcpResult) {
    try {
      switch (toolName) {
        case "plan_odoo_check":
          return this.planOdooCheckTool(args);
        case "execute_odoo_queries":
          return this.executeOdooQueriesTool(args, mcpResult);
        case "analyze_results":
          return this.analyzeResultsTool(args);
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return { error: `Tool execution error: ${error.message}` };
    }
  }

  planOdooCheckTool(args) {
    // This tool just returns the plan - the AI will call execute_odoo_queries next
    return {
      success: true,
      plan: args.analysis_plan,
      summary: `Planned ${args.analysis_plan.length} queries to answer: ${args.description}`
    };
  }

  async executeOdooQueriesTool(args, mcpResult) {
    // This tool executes the queries using the MCP service
    const results = [];
    
    for (const query of args.queries) {
      try {
        // Use the MCP service to execute the query
        const data = await this.executeOdooQuery(query);
        results.push({
          query_name: query.query_name,
          data: data,
          count: data ? data.length : 0,
          success: true
        });
      } catch (error) {
        results.push({
          query_name: query.query_name,
          data: [],
          count: 0,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: true,
      results,
      summary: `Executed ${args.queries.length} queries`
    };
  }

  async executeOdooQuery(query) {
    // Call the backend MCP service
    try {
      const response = await fetch('http://localhost:3002/api/odoo/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: [query]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.results && result.results.length > 0) {
        return result.results[0].data || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to execute Odoo query:', error);
      return [];
    }
  }

  analyzeResultsTool(args) {
    // Analyze the results and provide final answer
    const totalRecords = args.results.reduce((sum, r) => sum + r.count, 0);
    const successfulQueries = args.results.filter(r => r.success).length;
    
    let analysis = `## Analysis Results for: ${args.description}\n\n`;
    analysis += `**Queries Executed**: ${successfulQueries}/${args.results.length}\n`;
    analysis += `**Total Records Found**: ${totalRecords}\n\n`;

    args.results.forEach(result => {
      analysis += `### ${result.query_name}\n`;
      if (result.success) {
        analysis += `- **Records**: ${result.count}\n`;
        if (result.count > 0) {
          analysis += `- **Status**: Data found\n`;
        } else {
          analysis += `- **Status**: No data found\n`;
        }
      } else {
        analysis += `- **Status**: Error - ${result.error}\n`;
      }
      analysis += `\n`;
    });

    if (totalRecords === 0) {
      analysis += `**Conclusion**: No relevant data found in Odoo for this check.\n`;
    } else {
      analysis += `**Conclusion**: Found ${totalRecords} relevant records across ${successfulQueries} queries.\n`;
    }

    return {
      success: true,
      analysis,
      summary: `Analyzed ${args.results.length} query results`
    };
  }
}

export default OdooAiAgent;
