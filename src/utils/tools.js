// Tool schemas for OpenAI GPT-4o tool calling

export const tools = [
  {
    type: "function",
    function: {
      name: "find",
      description: "Find a cell by a fuzzy label or hint (header, nearby label, or substring). Returns first/best match and coordinates.",
      parameters: {
        type: "object",
        properties: {
          hint: { 
            type: "string", 
            description: "e.g. 'interest rate', 'discount', 'A1', 'APR', 'Rate%'" 
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
      name: "read_cell",
      description: "Read a single cell by address. If it's a formula, include the formula and last value.",
      parameters: {
        type: "object",
        properties: {
          address: { 
            type: "string", 
            description: "Excel-like address, e.g. 'B4'." 
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
            description: "Number, string, or formula starting with '='." 
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
      description: "Trigger formula evaluation and dependency-aware recalculation. Returns a cheap summary of changed cells.",
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
      description: "Read a small view of the sheet or a named output. Prefer narrow windows like A1:D20.",
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
  },
  {
    type: "function",
    function: {
      name: "debug_sheet",
      description: "Debug tool to see what data is actually in the spreadsheet. Use when search isn't working as expected.",
      parameters: {
        type: "object",
        properties: {
          search_term: { 
            type: "string", 
            description: "Optional search term to look for in the data" 
          }
        }
      }
    }
  }
];

// System prompt for the LLM
export const SYSTEM_PROMPT = `You are SpreadsheetCopilot for a React-based Excel-like app.

Core rule: Before answering any "what if / scenario / sensitivity" question, you MUST:
(1) locate the relevant input(s),
(2) READ the current value(s),
(3) UPDATE the value(s) to the hypothetical,
(4) TRIGGER RECALC,
(5) READ the impacted outputs,
(6) then explain the conclusion and revert the change if marked temporary.

Always prefer TOOL CALLS over assumptions. If unsure where a value is, start with tool.find.
Never fabricate spreadsheet contents. If a range is big, ask to narrow—otherwise read a lightweight summary.

When updating, preserve formulas unless explicitly asked to overwrite.
Dates may be serials or strings; use the app's date flags if present.

Be helpful, accurate, and always work with the actual spreadsheet data rather than making assumptions.`;
