import OpenAI from 'openai';
import { tools, SYSTEM_PROMPT } from '../utils/tools.js';
import { addrToRC, rcToAddr, sliceRange } from '../utils/a1Helpers.js';

// Initialize OpenAI client
const apiKey = import.meta.env.VITE_OPENAI_KEY;
if (!apiKey || apiKey === 'your_openai_api_key_here') {
  console.warn('OpenAI API key not set. Please set VITE_OPENAI_KEY in your .env file.');
}

const openai = new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true // Note: In production, this should be handled by a backend
});

/**
 * LLM Service for spreadsheet interaction
 */
export class LLMService {
  constructor(spreadsheetData, onDataChange) {
    this.spreadsheetData = spreadsheetData;
    this.onDataChange = onDataChange;
  }

  /**
   * Update the spreadsheet data reference
   */
  updateSpreadsheetData(newData) {
    this.spreadsheetData = newData;
  }

  /**
   * Find a cell by hint
   */
  findCell(hint, strategy = "header_row_first") {
    console.log(`Searching for: "${hint}" in spreadsheet data:`, this.spreadsheetData);
    
    // 1) exact address?
    if (/^[A-Z]+[0-9]+$/i.test(hint)) {
      return { address: hint.toUpperCase() };
    }

    const searchHint = hint.toLowerCase();
    const results = [];

    // 2) header row scan
    const headerRow = 0;
    if (strategy === "header_row_first" && this.spreadsheetData[headerRow]) {
      for (let c = 0; c < this.spreadsheetData[headerRow].length; c++) {
        const cell = this.spreadsheetData[headerRow][c];
        const cellValue = String(cell?.value ?? "").toLowerCase();
        if (cellValue.includes(searchHint)) {
          results.push({
            address: rcToAddr(1, c + 1),
            value: cell?.value,
            match: cellValue,
            location: `header row, column ${c + 1}`
          });
        }
      }
    }

    // 3) anywhere in the spreadsheet
    for (let r = 0; r < this.spreadsheetData.length; r++) {
      for (let c = 0; c < (this.spreadsheetData[r]?.length ?? 0); c++) {
        const cell = this.spreadsheetData[r][c];
        const cellValue = String(cell?.value ?? "").toLowerCase();
        if (cellValue.includes(searchHint)) {
          results.push({
            address: rcToAddr(r + 1, c + 1),
            value: cell?.value,
            match: cellValue,
            location: `row ${r + 1}, column ${c + 1}`
          });
        }
      }
    }

    console.log(`Found ${results.length} matches:`, results);

    // Return the best match (header row first, then first match)
    if (results.length > 0) {
      const headerMatch = results.find(r => r.location.includes('header'));
      return headerMatch || results[0];
    }

    return { address: null, message: `No cells found containing "${hint}"` };
  }

  /**
   * Read a cell by address
   */
  readCell(address) {
    const { r, c } = addrToRC(address);
    const cell = this.spreadsheetData[r-1]?.[c-1] ?? { value: "" };
    const isFormula = typeof cell.value === "string" && String(cell.value).startsWith("=");
    return { 
      address, 
      value: cell.value ?? "", 
      isFormula,
      isDate: cell.isDate || false,
      decimalPlaces: cell.decimalPlaces
    };
  }

  /**
   * Update a cell value
   */
  updateCell(address, newValue) {
    const { r, c } = addrToRC(address);
    
    // Ensure the row exists
    if (!this.spreadsheetData[r-1]) {
      this.spreadsheetData[r-1] = [];
    }
    
    // Ensure the cell exists
    if (!this.spreadsheetData[r-1][c-1]) {
      this.spreadsheetData[r-1][c-1] = { value: "", className: "" };
    }
    
    // Update the value
    this.spreadsheetData[r-1][c-1].value = newValue;
    
    // Trigger data change callback
    if (this.onDataChange) {
      this.onDataChange([...this.spreadsheetData]);
    }
    
    return { address, newValue };
  }

  /**
   * Trigger recalculation (placeholder for now)
   */
  recalc() {
    // In a real implementation, this would trigger formula evaluation
    // For now, we'll just return a summary
    return { 
      changed: 0, 
      message: "Recalculation triggered (formulas will be evaluated on next render)" 
    };
  }

  /**
   * Read a range of cells
   */
  readSheet(range) {
    if (!range) {
      return { 
        size: { 
          rows: this.spreadsheetData.length, 
          cols: this.spreadsheetData[0]?.length ?? 0 
        } 
      };
    }
    
    try {
      const window = sliceRange(this.spreadsheetData, range);
      return { range, window };
    } catch (error) {
      return { error: `Invalid range: ${range}` };
    }
  }

  /**
   * Debug tool to inspect spreadsheet data
   */
  debugSheet(searchTerm = null) {
    const debugInfo = {
      totalRows: this.spreadsheetData.length,
      totalCols: this.spreadsheetData[0]?.length || 0,
      sampleData: this.spreadsheetData.slice(0, 5).map((row, rowIndex) => 
        row.map((cell, colIndex) => ({
          address: rcToAddr(rowIndex + 1, colIndex + 1),
          value: cell?.value,
          type: typeof cell?.value,
          isFormula: String(cell?.value || '').startsWith('=')
        }))
      )
    };

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matches = [];
      
      for (let r = 0; r < this.spreadsheetData.length; r++) {
        for (let c = 0; c < (this.spreadsheetData[r]?.length || 0); c++) {
          const cell = this.spreadsheetData[r][c];
          const cellValue = String(cell?.value || '').toLowerCase();
          if (cellValue.includes(searchLower)) {
            matches.push({
              address: rcToAddr(r + 1, c + 1),
              value: cell?.value,
              row: r + 1,
              col: c + 1
            });
          }
        }
      }
      
      debugInfo.searchTerm = searchTerm;
      debugInfo.matches = matches;
    }

    return debugInfo;
  }

  /**
   * Execute a tool call
   */
  async execTool(name, args) {
    try {
      switch (name) {
        case "find":
          return this.findCell(args.hint, args.search_strategy);
        case "read_cell":
          return this.readCell(args.address);
        case "update_cell":
          return this.updateCell(args.address, args.newValue);
        case "recalc":
          return this.recalc();
        case "read_sheet":
          return this.readSheet(args.range);
        case "debug_sheet":
          return this.debugSheet(args.search_term);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return { error: `Tool execution error: ${error.message}` };
    }
  }

  /**
   * Main chat function that handles the conversation with OpenAI
   */
  async chat(userText) {
    try {
      // Check if API key is properly configured
      if (!import.meta.env.VITE_OPENAI_KEY || import.meta.env.VITE_OPENAI_KEY === 'your_openai_api_key_here') {
        throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_KEY in your .env file.');
      }

      // Build conversation messages
      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userText
        }
      ];

      // 1) Ask model with tools
      let response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice: "auto"
      });

      // 2) Handle tool calls in a loop
      let finalResponse = response;
      let iterationCount = 0;
      const maxIterations = 5; // Prevent infinite loops

      while (response.choices[0]?.message?.tool_calls?.length > 0 && iterationCount < maxIterations) {
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
          const result = await this.execTool(call.function.name, JSON.parse(call.function.arguments));
          
          console.log(`Tool result for ${call.function.name}:`, result);
          
          // Add tool result to conversation
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });
        }

        // Get next response from the model
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          tools: tools,
          tool_choice: "auto"
        });

        finalResponse = response;
      }

      // 3) Return final text response
      return finalResponse.choices[0]?.message?.content || "No response generated.";

    } catch (error) {
      console.error('LLM Service Error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('tool_call_id')) {
        return `Tool calling error: ${error.message}. This might be a conversation state issue. Please try asking your question again.`;
      } else if (error.message.includes('400')) {
        return `API Error: ${error.message}. Please check your request format.`;
      } else if (error.message.includes('401')) {
        return `Authentication Error: ${error.message}. Please check your OpenAI API key.`;
      } else {
        return `Error: ${error.message}. Please try again or check your OpenAI API key.`;
      }
    }
  }
}
