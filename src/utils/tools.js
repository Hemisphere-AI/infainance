// Tool schemas for OpenAI GPT-4o tool calling

export const tools = [
  {
    type: "function",
    function: {
      name: "conclude",
      description: "Provide the final answer based on all tool results. This tool MUST be called to conclude your findings at the end of any analysis only when there are no open questions and you have results from all the tools.",
      parameters: {
        type: "object",
        properties: {
          answer: {
            type: "string",
            description: "The final answer based on all the tool results gathered"
          },
          confidence: {
            type: "string",
            description: "Confidence level in the answer",
            enum: ["high", "medium", "low"]
          },
          sources: {
            type: "array",
            items: { type: "string" },
            description: "List of cell addresses or data sources used to reach this conclusion"
          }
        },
        required: ["answer", "confidence"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_cell",
      description: "Read a single cell by address. If it's a formula, include the formula and last value.",
      parameters: {
        type: "object",
        properties: {
          address: { 
            type: "string", 
            description: "Excel-like address, e.g. 'B4' (B for the cell in column B and 4 for the row 4." 
          }
        },
        required: ["address"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_cell",
      description: "Update a cell's value or formula.",
      parameters: {
        type: "object",
        properties: {
          address: { 
            type: "string",
            description: "Excel-like address, e.g. 'B4'"
          },
          newValue: { 
            type: "string",
            description: "Number, string, or formula (starting with '='.)" 
          }
        },
        required: ["address", "newValue"]
      }
    }
  }
];

// System prompt for the LLM
export const SYSTEM_PROMPT = `You are SpreadsheetCopilot for a Excel-like app.

## SPREADSHEET DATA STRUCTURE
The spreadsheet data is always organized in a 2D grid:
- **X-axis (columns)**: Could represent a unit of time  i.e. week, month, year, etc. but not exclusively.
- **Y-axis (rows)**: Represent different entities, categories, but not exclusively.

## CORE RULES
**CRITICAL: You MUST use end with the 'conclude' tool to provide your final answer. Before using conclude: You MUST verify there are no open ends left in your analysis.**

**WORKFLOW IS MANDATORY:**
1. **PLAN**: Create a step wise plan how to best answer the question, what tools to use and in what order.  
2. **EXECUTE**: Use appropriate tools to execute the plan. 
3. **ANALYZE**: Review all tool outputs and results and check if there are any open ends left in your analysis or some tools need to be called again or recursively.
4. **CONCLUDE**: Call the 'conclude' tool with your final answer.

**IMPORTANT TOOL USAGE RULES:**
- When update_cell returns success: true, the task is complete - call conclude immediately
- Do NOT repeat the same tool call multiple times unless there's an error
- Always check tool results for success/failure status before proceeding

`;

