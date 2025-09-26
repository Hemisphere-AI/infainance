// Tool schemas for OpenAI GPT-4o tool calling

export const tools = [
  {
    type: "function",
    function: {
      name: "find",
      description: "Find a cell by a fuzzy label or hint (header, nearby label, or substring). Returns first/best match, coordinates, and adjacent cells. Use this to find labels and then check adjacent cells for their values.",
      parameters: {
        type: "object",
        properties: {
          hint: { 
            type: "string", 
            description: "e.g. 'Margin', 'interest rate', 'discount', 'A1', 'APR', 'Rate%'" 
          },
          search_strategy: {
            type: "string",
            enum: ["header_row_first", "anywhere"],
            default: "header_row_first"
          }
        },
        required: ["hint"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_label_value",
      description: "Find a label and return both the label cell and its associated value from adjacent cells. ",
      parameters: {
        type: "object",
        properties: {
          label: { 
            type: "string", 
            description: "The label to search for, e.g. 'GP Margin', 'Revenue', 'Total'" 
          },
          search_strategy: {
            type: "string",
            enum: ["header_row_first", "anywhere"],
            default: "anywhere"
          }
        },
        required: ["label"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_subframe",
      description: "Find labels and create a sub-frame by: (1) fuzzy matching (>=0.80) the metric label and the entity axis label, (2) locating their likely header/entity positions, (3) EXPANDING the view up/left to headers and right/down across values, and (4) returning a TRACE of the steps (find_value lines, getting A1:Ax, establish sub_frame, subframe found) plus the winning cell address for follow-up read_cell.",
      parameters: {
        type: "object",
        properties: {
          label1: { 
            type: "string", 
            description: "First label to find (e.g., 'Agents', 'Revenue', 'Profit')" 
          },
          label2: { 
            type: "string", 
            description: "Second label to find (e.g., 'Client', 'Product', 'Month')" 
          },
          context_range: {
            type: "number",
            default: 2,
            description: "Number of cells to look back from sub-frame origin for context/titles (default: 2)"
          },
          value_type: {
            type: "string",
            enum: ["number", "text", "date", "any"],
            default: "number",
            description: "Expected value type for comparison (default: 'number')"
          }
        },
        required: ["label1", "label2"]
      }
    }
  },
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
      name: "small_talk",
      description: "Use this tool ONLY for simple greetings, acknowledgments, or when no spreadsheet analysis is required. This prevents premature answers for data questions.",
      parameters: {
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "The simple response for greetings or non-data questions"
          }
        },
        required: ["response"]
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
            description: "Excel-like address, e.g. 'B4' for the cell in column B and row 4." 
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
  },
  {
    type: "function",
    function: {
      name: "recalc",
      description: "Trigger formula evaluation and dependency-aware recalculation.",
      parameters: { 
        type: "object", 
        properties: {}, 
        additionalProperties: false 
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_sheet",
      description: "Read a small view of the sheet or a named output. Prefer narrow windows max 20 by 20 cells",
      parameters: {
        type: "object",
        properties: {
          range: { 
            type: "string", 
            description: "e.g. 'A1:D20'. If omitted, returns a compact summary." 
          }
        }
      }
    }
  }
];

// System prompt for the LLM
export const SYSTEM_PROMPT = `You are SpreadsheetCopilot for a Excel-like app.

## SPREADSHEET DATA STRUCTURE
The spreadsheet data is always organized in a 2D grid:
- **X-axis (columns)**: Could represent a unit of time  i.e. week, month, year, etc. but not exclusively.
- **Y-axis (rows)**: Represent different entities, categories, but not exclusively

## CORE RULES
**CRITICAL: You MUST use end wit the 'conclude' tool to provide your final answer. Before using conclude: You MUST verify there are no open ends left in your analysis.**

**WORKFLOW IS MANDATORY:**
1. **PLAN**: Create a step wise plan how to best answer the question, what tools to use and in what order. 
2. **EXECUTE**: Use appropriate tools to execute the plan.
3. **ANALYZE**: Review all results.
4. **CONCLUDE**: Call the 'conclude' tool with your final answer.


`;
