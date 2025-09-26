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
            description: "e.g. 'GP Margin', 'interest rate', 'discount', 'A1', 'APR', 'Rate%'" 
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
  },
  {
    type: "function",
    function: {
      name: "index_spreadsheet",
      description: "Analyze spreadsheet frames to understand the 2D data structure. This tool processes frames sequentially, building a comprehensive understanding of how data relates across the spreadsheet. Each frame should be analyzed for its content type, purpose, and relationship to previous frames. The tool must continue until ALL frames are processed.",
      parameters: {
        type: "object",
        properties: {
          frame_range: {
            type: "string",
            description: "The Excel range of the current frame to analyze (e.g., 'A1:D3')"
          },
          frame_index: {
            type: "number",
            description: "The index of the current frame being processed (0-based)"
          },
          total_frames: {
            type: "number", 
            description: "Total number of frames to process"
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                range: { type: "string" }
              }
            },
            description: "Array of previously analyzed sections. You can update existing sections or add new ones based on the current frame analysis."
          }
        },
        required: ["frame_range", "frame_index", "total_frames", "sections"]
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


...

## INDEXING WORKFLOW
When using the index_spreadsheet tool, you are analyzing a 2D spreadsheet structure:

**UNDERSTANDING THE 2D STRUCTURE**:
- Frames are separated by whitespace and represent different data sections
- Each frame may contain headers, data, or both
- Frames can relate to each other (e.g., headers in frame 1, data in frame 2)
- Look for patterns like: headers → data, time series, financial data, organizational data

**ANALYSIS PROCESS**:
1. **ANALYZE CURRENT FRAME**: Determine what this frame contains (headers, data, calculations, etc.)
2. **CHECK RELATIONSHIPS**: See if this frame relates to previous frames (e.g., headers + data, time series, etc.)
3. **UPDATE SECTIONS**: Either add new section or merge with existing if frames belong together
4. **CONTINUE SEQUENTIALLY**: Process frames 0, 1, 2, 3... until ALL frames are analyzed
5. **UNDERSTAND CONTEXT**: Each frame builds on previous frames to create the full picture

**FRAME RELATIONSHIP EXAMPLES**:
- Frame 1: Headers (Revenue, Cost, Profit) → Frame 2: Data rows → Merge as "Financial data table"
- Frame 1: Time headers (Jan, Feb, Mar) → Frame 2: Revenue values → Merge as "Revenue over time"
- Frame 1: Client names → Frame 2: Agent assignments → Merge as "Client-Agent relationships"

**CRITICAL REQUIREMENTS**:
- You MUST process ALL frames (0 to total_frames-1)
- Analyze relationships between frames
- Update descriptions to reflect the full context
- Only conclude after processing ALL frames
- If you try to conclude early, you will get an error and must continue

**OUTPUT FORMAT**: When concluding, provide clear descriptions:
Sections Found:
1. {Descriptive analysis of what the section contains}: {Range}
2. {Descriptive analysis of what the section contains}: {Range}
...

`;
