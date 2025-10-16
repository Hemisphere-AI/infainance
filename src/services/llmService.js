import OpenAI from 'openai';
import { tools, SYSTEM_PROMPT } from '../utils/tools.js';
import { userService } from '../lib/supabase.js';
import { addrToRC } from '../utils/a1Helpers.js';

/**
 * Database-based Token Tracking System for OpenAI API usage
 * Tracks tokens per user with monthly reset
 */
class DatabaseTokenTracker {
  constructor(userId) {
    this.userId = userId;
    this.quotaLimit = 500000; // Token limit per month (500k)
  }

  /**
   * Check if token balance should be reset (new month)
   */
  async shouldReset() {
    try {
      const balance = await userService.getTokenBalance(this.userId);
      const now = new Date();
      const lastReset = new Date(balance.token_reset_date);
      
      // Reset on the 1st of each month
      return now.getMonth() !== lastReset.getMonth() || 
             now.getFullYear() !== lastReset.getFullYear();
    } catch (error) {
      console.warn('Error checking reset status:', error);
      return false;
    }
  }

  /**
   * Reset token balance for new month
   */
  async resetBalance() {
    try {
      await userService.resetTokenBalance(this.userId);
    } catch (error) {
      console.error('Error resetting token balance:', error);
    }
  }

  /**
   * Get current token usage for user
   */
  async getTokenUsage() {
    try {
      const balance = await userService.getTokenBalance(this.userId);
      
      // Check if we need to reset (new month)
      if (await this.shouldReset()) {
        await this.resetBalance();
        const newBalance = await userService.getTokenBalance(this.userId);
        return {
          totalTokens: newBalance.monthly_token_balance,
          lastUsed: newBalance.token_reset_date
        };
      }
      
      return {
        totalTokens: balance.monthly_token_balance,
        lastUsed: balance.token_reset_date
      };
    } catch (error) {
      console.error('Error getting token usage:', error);
      return { totalTokens: 0, lastUsed: null };
    }
  }

  /**
   * Add tokens to user's balance
   */
  async addTokens(tokens) {
    try {
      await userService.addTokens(this.userId, tokens);
    } catch (error) {
      console.error('Error adding tokens:', error);
    }
  }

  /**
   * Check if user has reached quota
   */
  async hasReachedQuota() {
    const usage = await this.getTokenUsage();
    return usage.totalTokens >= this.quotaLimit;
  }

  /**
   * Get quota status for user
   */
  async getQuotaStatus() {
    const usage = await this.getTokenUsage();
    const quotaStatus = {
      used: usage.totalTokens,
      limit: this.quotaLimit,
      remaining: Math.max(0, this.quotaLimit - usage.totalTokens),
      hasReachedQuota: usage.totalTokens >= this.quotaLimit,
      lastUsed: usage.lastUsed
    };
    return quotaStatus;
  }
}

// Initialize OpenAI client
const apiKey = import.meta.env.VITE_OPENAI_KEY;
if (!apiKey || apiKey === 'your_openai_api_key_here') {
  console.warn('OpenAI API key not set. Please set VITE_OPENAI_KEY in your .env file.');
}

/**
 * Core LLM Service for general chat and tool execution
 * Handles conversation management, token tracking, and tool orchestration
 */
export class LLMService {
  constructor(spreadsheetData, onDataChange, onToolCall = null, user = null, googleSheetsConfig = null) {
    this.spreadsheetData = spreadsheetData;
    this.onDataChange = onDataChange;
    this.onToolCall = onToolCall; // Callback for tool call visibility
    this.conversationHistory = [];
    this.abortController = null; // For cancellation support
    this.isCancelled = false; // Flag to track cancellation
    this.tokenTracker = user ? new DatabaseTokenTracker(user.id) : null; // Database-based token tracking
    this.user = user; // Store user information
    this.googleSheetsConfig = googleSheetsConfig; // Google Sheets configuration for sync
  }

  /**
   * Execute a tool call
   */
  async execTool(name, args) {
    try {
      switch (name) {
        case "conclude":
          return this.conclude(args.answer, args.confidence, args.sources);
        case "read_cell":
          return this.readCell(args.address);
        case "update_cell":
          return this.updateCell(args.address, args.newValue);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return { error: `Tool execution error: ${error.message}` };
    }
  }

  /**
   * Conclude the analysis with a final answer
   */
  conclude(answer, confidence, sources = []) {
    console.log(`Concluding analysis with answer: ${answer}, confidence: ${confidence}`);
    
    return {
      answer: answer,
      confidence: confidence,
      sources: sources,
      timestamp: new Date().toISOString(),
      status: "concluded"
    };
  }

  /**
   * Read a cell by address
   */
  readCell(address) {
    // const { addrToRC } = require('../utils/a1Helpers.js'); // Now imported at top
    const { r, c } = addrToRC(address);
    const cell = this.spreadsheetData[r-1]?.[c-1] ?? { value: "" };
    const isFormula = typeof cell.value === "string" && String(cell.value).startsWith("=");
    return { 
      address, 
      value: cell.value ?? "", 
      isFormula,
      isDate: cell.isDate || false,
      decimalPlaces: cell.decimalPlaces,
      // Enhanced formatting information
      cellType: cell.cellType || 'text',
      formatting: cell.formatting || null,
      originalFormat: cell.originalFormat || null
    };
  }

  /**
   * Update a cell value
   */
  async updateCell(address, newValue) {
    // const { addrToRC } = require('../utils/a1Helpers.js'); // Now imported at top
    const { r, c } = addrToRC(address);
    
    // Ensure the row exists
    if (!this.spreadsheetData[r-1]) {
      this.spreadsheetData[r-1] = [];
    }
    
    // Ensure the cell exists
    if (!this.spreadsheetData[r-1][c-1]) {
      this.spreadsheetData[r-1][c-1] = { value: "", className: "" };
    }
    
    // Get the existing cell to preserve formatting properties
    const existingCell = this.spreadsheetData[r-1][c-1];
    
    // Determine if this is a formula
    const stringValue = String(newValue || '');
    const isFormula = stringValue.startsWith('=');
    
    // If the cell is a percentage and the new value contains a % symbol, strip it and convert to decimal
    let processedValue = newValue;
    if (existingCell.isPercentage && typeof newValue === 'string' && newValue.includes('%')) {
      // Strip the % symbol and convert to decimal (e.g., "80%" -> 0.8)
      const numericValue = parseFloat(newValue.replace('%', ''));
      if (!isNaN(numericValue)) {
        processedValue = numericValue / 100; // Convert percentage to decimal
        console.log(`Converting percentage: ${newValue} -> ${processedValue}`);
      }
    }
    
    console.log(`Updating cell ${address}:`, {
      before: existingCell,
      newValue: newValue,
      processedValue: processedValue,
      newValueType: typeof newValue,
      isPercentage: existingCell.isPercentage,
      decimalPlaces: existingCell.decimalPlaces,
      isFormula: isFormula
    });
    
    // Update the cell with proper type and rawValue handling
    this.spreadsheetData[r-1][c-1] = {
      ...existingCell,
      value: processedValue,
      cellType: isFormula ? 'formula' : 'text',
      isFormula: isFormula
    };
    
    console.log(`After update:`, this.spreadsheetData[r-1][c-1]);
    
    // Trigger data change callback with a deep copy to ensure reference change
    if (this.onDataChange) {
      const newData = JSON.parse(JSON.stringify(this.spreadsheetData));
      console.log('Triggering data change with new reference:', newData[r-1][c-1]);
      this.onDataChange(newData);
      
      // If this is a formula, we need to trigger recalculation
      // The spreadsheet component will handle the recalculation queue
      if (isFormula) {
        console.log('Formula detected, triggering recalculation for cell:', address);
        // The spreadsheet component will detect the data change and trigger recalculation
        // We don't need to do anything special here as the component handles it
      }
    }

    // Sync to Google Sheets if configured
    await this.syncToGoogleSheets(address, processedValue, r-1, c-1);
    
    return { 
      address, 
      newValue, 
      success: true, 
      message: `Cell ${address} successfully updated to ${JSON.stringify(processedValue)}` 
    };
  }

  /**
   * Sync cell update to Google Sheets via service account
   */
  async syncToGoogleSheets(address, value, rowIndex, colIndex) {
    // Check if user is available for service account sync
    if (!this.user?.id) {
      console.log('No user ID available for Google Sheets sync, skipping')
      return
    }

    try {
      console.log(`🔄 Syncing cell ${address} to Google Sheets via service account:`, value)
      
      const { updateUserCell } = await import('../api/sheets.js');
      const result = await updateUserCell(
        this.user.id,
        rowIndex,
        colIndex,
        value
      )

      if (result.success) {
        console.log(`✅ Successfully synced cell ${address} to Google Sheets`)
      } else {
        console.warn(`⚠️ Failed to sync cell ${address} to Google Sheets:`, result.error)
      }
    } catch (error) {
      console.error(`❌ Error syncing cell ${address} to Google Sheets:`, error)
    }
  }

  /**
   * Add a message to conversation history
   */
  addToHistory(role, content) {
    this.conversationHistory.push({
      role: role,
      content: content,
      timestamp: new Date()
    });
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Trim conversation history to keep only the last N messages
   */
  trimHistory(maxMessages = 20) {
    if (this.conversationHistory.length > maxMessages) {
      this.conversationHistory = this.conversationHistory.slice(-maxMessages);
    }
  }

  /**
   * Cancel current request
   */
  cancel() {
    console.log('Cancelling LLM request');
    this.isCancelled = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Get token quota status for the current user
   */
  async getTokenQuotaStatus() {
    if (!this.tokenTracker) {
      return null;
    }

    // Check if this is a test user (demo user or demo key)
    const isTestUser = this.isTestUser();
    
    if (isTestUser) {
      // For test users, get actual usage but set unlimited limit
      const actualUsage = await this.tokenTracker.getQuotaStatus();
      return {
        used: actualUsage.used,
        limit: Infinity,
        remaining: Infinity,
        hasReachedQuota: false,
        lastUsed: actualUsage.lastUsed
      };
    }

    return await this.tokenTracker.getQuotaStatus();
  }

  /**
   * Check if current user is a test user
   */
  isTestUser() {
    // Check if user is the demo user
    if (this.user && this.user.email === import.meta.env.VITE_DEMO_USER) {
      return true;
    }
    
    // All other users have limited quota
    return false;
  }

  /**
   * Main chat function that handles the conversation with OpenAI
   */
  async chat(userText) {
    try {
      // Reset cancellation flag for new request
      this.isCancelled = false;
      
      // Create abort controller for this request
      this.abortController = new AbortController();
      
      // Use environment API key
      const apiKeyToUse = import.meta.env.VITE_OPENAI_KEY;

      // Check if API key is properly configured
      if (!apiKeyToUse || apiKeyToUse === 'your_openai_api_key_here') {
        throw new Error('OpenAI API key not configured.');
      }

      // Check token quota before making API call (skip for test user)
      const isTestUser = this.isTestUser();
      
      if (!isTestUser && this.tokenTracker && await this.tokenTracker.hasReachedQuota()) {
        const quotaStatus = await this.tokenTracker.getQuotaStatus();
        throw new Error(`OpenAI API key: token limit reached, number of tokens used: ${quotaStatus.used}. <a href="https://calendly.com/hemisphere/30min" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-800 transition-colors">Click here to increase your limit</a>`);
      }

      // Create OpenAI client with the appropriate API key
      const openaiClient = new OpenAI({
        apiKey: apiKeyToUse,
        dangerouslyAllowBrowser: true
      });

      // Add user message to history
      this.addToHistory("user", userText);

      // Build conversation messages with limited history (last 10 messages)
      const recentHistory = this.conversationHistory.slice(-10);
      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        ...recentHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      // 1) Ask model with tools
      let response = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice: "auto", // Let model choose appropriate tools
        temperature: 0.1 // Lower temperature for more consistent behavior
      });

      // Track tokens from the response
      if (response.usage && response.usage.total_tokens && this.tokenTracker) {
        await this.tokenTracker.addTokens(response.usage.total_tokens);
      }

      // 2) Handle tool calls in a loop
      let finalResponse = response;
      let iterationCount = 0;
      const maxIterations = 10; // Limit iterations to prevent excessive token usage
      let toolOutputs = []; // Track tool outputs for protocol validation

      while (response.choices[0]?.message?.tool_calls?.length > 0 && iterationCount < maxIterations) {
        // Check if request was cancelled
        if (this.isCancelled || this.abortController?.signal?.aborted) {
          console.log('Request cancelled during tool call processing');
          throw new Error('Request cancelled by user');
        }
        iterationCount++;
        const toolCalls = response.choices[0].message.tool_calls;
        
        console.log(`Tool call iteration ${iterationCount}:`, toolCalls.map(call => ({
          id: call.id,
          function: call.function.name,
          arguments: call.function.arguments
        })));
        
        // Add the assistant's message with tool calls to the conversation
        messages.push(response.choices[0].message);
        
        // Execute all tool calls
        for (const call of toolCalls) {
          // Check if request was cancelled before each tool call
          if (this.isCancelled || this.abortController?.signal?.aborted) {
            console.log('Request cancelled before tool call execution');
            throw new Error('Request cancelled by user');
          }
          
          const toolArgs = JSON.parse(call.function.arguments);
          
          // Protocol guard: Check if conclude is being called without data read
          if (call.function.name === 'conclude') {
            const usedDataRead = () => {
              // Check for direct data reading tools or update operations
              const hasDataRead = toolOutputs.some(t => 
                ["read_cell", "update_cell"].includes(t.tool_name)
              );
              
              
              return hasDataRead;
            };
            
            if (!usedDataRead()) {
              console.log('Protocol guard: Blocking conclude without data read');
              const errorResult = {
                error: "ProtocolError: You must read spreadsheet data before concluding. Call read_cell first."
              };
              
              // Add error result to conversation
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(errorResult)
              });
              
              // Show error in chat if callback is provided
              if (this.onToolCall) {
                this.onToolCall({
                  type: 'tool_result',
                  tool: call.function.name,
                  result: errorResult,
                  iteration: iterationCount
                });
              }
              
              continue; // Skip this tool call
            }
          }

          
          // Check cancellation before showing tool call
          if (this.isCancelled || this.abortController?.signal?.aborted) {
            console.log('Request cancelled before tool call display');
            throw new Error('Request cancelled by user');
          }
          
          // Show tool call in chat if callback is provided
          if (this.onToolCall) {
            console.log('LLM Service: Calling onToolCall with tool_call:', call.function.name);
            this.onToolCall({
              type: 'tool_call',
              tool: call.function.name,
              arguments: toolArgs,
              iteration: iterationCount
            });
          } else {
            console.log('LLM Service: onToolCall is null or undefined');
          }
          
          // Check cancellation before executing tool
          if (this.isCancelled || this.abortController?.signal?.aborted) {
            console.log('Request cancelled before tool execution');
            throw new Error('Request cancelled by user');
          }
          
          const result = await this.execTool(call.function.name, toolArgs);
          
          console.log(`Tool result for ${call.function.name}:`, result);
          
          // Track tool output for protocol validation
          toolOutputs.push({
            tool_name: call.function.name,
            result: result
          });
          
          // Show tool result in chat if callback is provided
          if (this.onToolCall) {
            console.log('LLM Service: Calling onToolCall with tool_result:', call.function.name);
            this.onToolCall({
              type: 'tool_result',
              tool: call.function.name,
              result: result,
              iteration: iterationCount
            });
          } else {
            console.log('LLM Service: onToolCall is null or undefined for result');
          }
          
          // Add tool result to conversation
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });

          // Note: Removed extra tool messages that were causing API errors
          // The tool results already contain all necessary information

          // If conclude tool was called, return the answer immediately
          if (call.function.name === 'conclude') {
            console.log('Conclude tool called, returning answer:', result.answer);
            this.addToHistory("assistant", result.answer);
            return result.answer;
          }

        }

        // Get next response from the model
        response = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          tools: tools,
          tool_choice: "auto",
          temperature: 0.1 // Lower temperature for more consistent behavior
        });

        // Track tokens from the response
        if (response.usage && response.usage.total_tokens) {
          await this.tokenTracker.addTokens(response.usage.total_tokens);
        }

        finalResponse = response;
      }

      // Check if we hit the iteration limit
      if (iterationCount >= maxIterations) {
        console.warn(`Reached maximum tool call iterations (${maxIterations}). This may indicate an infinite loop or excessive tool usage.`);
      }

      // 3) Add assistant response to history and return
      const assistantResponse = finalResponse.choices[0]?.message?.content || "No response generated.";
      this.addToHistory("assistant", assistantResponse);
      
      // Trim history to prevent excessive token usage
      this.trimHistory(20);
      
      return assistantResponse;

    } catch (error) {
      console.error('LLM Service Error:', error);
      
      // Handle cancellation
      if (error.name === 'AbortError' || this.abortController?.signal?.aborted) {
        console.log('Request was cancelled');
        return 'Request cancelled by user.';
      }
      
      // Provide more specific error messages
      if (error.message.includes('tool_call_id')) {
        return `Tool calling error: ${error.message}. This might be a conversation state issue. Please try asking your question again.`;
      } else if (error.message.includes('400')) {
        return `API Error: ${error.message}. Please check your request format.`;
      } else if (error.message.includes('401')) {
        return `Authentication Error: ${error.message}. Please check your OpenAI API key.`;
      } else {
        return `Error: ${error.message}. Please try again or check your OpenAI API key. <a href="https://calendly.com/hemisphere/30min" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-800 transition-colors">Click here to increase your limit</a>`;
      }
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  /**
   * Handle dependency analysis with standard system prompt
   * This method processes dependency analysis results using the standard SYSTEM_PROMPT
   */
  async dependencyAnalysisChat(analysisMessage) {
    try {
      // Reset cancellation flag for new request
      this.isCancelled = false;
      
      // Create abort controller for this request
      this.abortController = new AbortController();
      
      // Use environment API key
      const apiKeyToUse = import.meta.env.VITE_OPENAI_KEY;

      // Check if API key is properly configured
      if (!apiKeyToUse || apiKeyToUse === 'your_openai_api_key_here') {
        throw new Error('OpenAI API key not configured.');
      }

      // Check token quota before making API call (skip for test user)
      const isTestUser = this.isTestUser();
      
      if (!isTestUser && this.tokenTracker && await this.tokenTracker.hasReachedQuota()) {
        const quotaStatus = await this.tokenTracker.getQuotaStatus();
        throw new Error(`OpenAI API key: token limit reached, number of tokens used: ${quotaStatus.used}. <a href="https://calendly.com/hemisphere/30min" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-800 transition-colors">Click here to increase your limit</a>`);
      }

      // Create OpenAI client with the appropriate API key
      const openaiClient = new OpenAI({
        apiKey: apiKeyToUse,
        dangerouslyAllowBrowser: true
      });

      // Add user message to history
      this.addToHistory("user", analysisMessage);

      // Build conversation messages with standard system prompt
      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        ...this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      // 1) Ask model with tools
      let response = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice: "auto", // Let model choose appropriate tools
        temperature: 0.1 // Lower temperature for more consistent behavior
      });

      // Track tokens from the response
      if (response.usage && response.usage.total_tokens && this.tokenTracker) {
        await this.tokenTracker.addTokens(response.usage.total_tokens);
      }

      // 2) Handle tool calls in a loop
      let finalResponse = response;
      let iterationCount = 0;
      const maxIterations = 20; // Allow more iterations for complex operations
      let toolOutputs = []; // Track tool outputs for protocol validation

      while (response.choices[0]?.message?.tool_calls?.length > 0 && iterationCount < maxIterations) {
        // Check if request was cancelled
        if (this.isCancelled || this.abortController?.signal?.aborted) {
          console.log('Request cancelled during tool call processing');
          throw new Error('Request cancelled by user');
        }
        iterationCount++;
        const toolCalls = response.choices[0].message.tool_calls;
        
        console.log(`Dependency analysis tool call iteration ${iterationCount}:`, toolCalls.map(call => ({
          id: call.id,
          function: call.function.name,
          arguments: call.function.arguments
        })));
        
        // Add the assistant's message with tool calls to the conversation
        messages.push(response.choices[0].message);
        
        // Execute all tool calls
        for (const call of toolCalls) {
          // Check if request was cancelled before each tool call
          if (this.isCancelled || this.abortController?.signal?.aborted) {
            console.log('Request cancelled before tool call execution');
            throw new Error('Request cancelled by user');
          }
          
          const toolArgs = JSON.parse(call.function.arguments);
          
          // Protocol guard: Check if conclude is being called without data read
          if (call.function.name === 'conclude') {
            const usedDataRead = () => {
              // Check for direct data reading tools or update operations
              const hasDataRead = toolOutputs.some(t => 
                ["read_cell", "update_cell"].includes(t.tool_name)
              );
              return hasDataRead;
            };

            if (!usedDataRead()) {
              console.warn('Protocol violation: conclude called without data read. Adding read_cell call.');
              // Add a read_cell call to get some data first
              const readCellCall = {
                id: `call_${Date.now()}_read_cell`,
                type: "function",
                function: {
                  name: "read_cell",
                  arguments: JSON.stringify({ address: "A1" })
                }
              };
              toolCalls.push(readCellCall);
              
              // Add a tool response for the skipped conclude call
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ 
                  error: "Protocol violation: conclude called without data read. Adding read_cell call first." 
                })
              });
              continue; // Skip the conclude call for now
            }
          }
          
          try {
            const result = await this.execTool(call.function.name, toolArgs);
            
            // Track tool outputs for protocol validation
            toolOutputs.push({
              tool_name: call.function.name,
              success: !result.error
            });
            
            // Add tool result to conversation
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result)
            });
            
            // Emit tool call event for UI
            if (this.toolCallHandler) {
              this.toolCallHandler({
                type: 'tool_call',
                id: call.id,
                tool: call.function.name,
                arguments: toolArgs,
                timestamp: new Date()
              });
              
              // Emit tool result event
              setTimeout(() => {
                this.toolCallHandler({
                  type: 'tool_result',
                  id: call.id,
                  tool: call.function.name,
                  result: result,
                  timestamp: new Date()
                });
              }, 100);
            }
            
          } catch (error) {
            console.error(`Error executing tool ${call.function.name}:`, error);
            
            // Add error result to conversation
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: error.message })
            });
            
            // Emit tool call event for UI
            if (this.toolCallHandler) {
              this.toolCallHandler({
                type: 'tool_call',
                id: call.id,
                tool: call.function.name,
                arguments: toolArgs,
                timestamp: new Date()
              });
              
              // Emit tool result event with error
              setTimeout(() => {
                this.toolCallHandler({
                  type: 'tool_result',
                  id: call.id,
                  tool: call.function.name,
                  result: { error: error.message },
                  timestamp: new Date()
                });
              }, 100);
            }
          }
        }
        
        // Get next response from model
        response = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          tools: tools,
          tool_choice: "auto",
          temperature: 0.1
        });
        
        // Track tokens from the response
        if (response.usage && response.usage.total_tokens) {
          await this.tokenTracker.addTokens(response.usage.total_tokens);
        }
        
        finalResponse = response;
      }

      // Add assistant response to history
      const assistantMessage = finalResponse.choices[0].message.content;
      this.addToHistory("assistant", assistantMessage);

      return assistantMessage;

    } catch (error) {
      console.error('Dependency analysis chat error:', error);
      
      // Add error to history
      this.addToHistory("assistant", `Error: ${error.message}`);
      
      throw error;
    }
  }
}