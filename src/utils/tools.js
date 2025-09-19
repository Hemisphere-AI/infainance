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
      description: "Find a label and return both the label cell and its associated value from adjacent cells. This is perfect for finding values like 'GP Margin' where the label and value are in adjacent cells.",
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
      name: "find_intersection",
      description: "Find the intersection of exactly 2 labels with axis and type hints. Use this when the question contains exactly 2 distinct labels/variables (e.g., 'revenue in March', 'agents for client_2'). This tool finds where the two labels meet in the 2D spreadsheet grid and returns the cell at the intersection.",
      parameters: {
        type: "object",
        properties: {
          label1: { 
            type: "string", 
            description: "First label to find (e.g., 'Revenue', 'March', 'Client_4')" 
          },
          label2: { 
            type: "string", 
            description: "Second label to find (e.g., 'Revenue', 'March', 'Client_4')" 
          },
          label1_role: {
            type: "string",
            enum: ["row", "column", "auto"],
            default: "auto",
            description: "Treat label1 as a row label (left axis), column label (top axis), or auto."
          },
          label2_role: {
            type: "string",
            enum: ["row", "column", "auto"],
            default: "auto",
            description: "Treat label2 as a row label (left axis), column label (top axis), or auto."
          },
          prefer_header_row: {
            type: "boolean",
            default: true,
            description: "Prefer row 1 for column labels."
          },
          prefer_first_column: {
            type: "boolean",
            default: true,
            description: "Prefer column A for row labels."
          },
          value_type: {
            type: "string",
            enum: ["number", "text", "date", "any"],
            default: "any",
            description: "Filter candidate intersections by expected value type."
          },
          search_strategy: {
            type: "string",
            enum: ["header_row_first", "anywhere"],
            default: "anywhere"
          }
        },
        required: ["label1", "label2"]
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
      name: "get_row_data",
      description: "Get all data from a specific row. Useful when you find a label and want to see all values in that row.",
      parameters: {
        type: "object",
        properties: {
          row_address: { 
            type: "string", 
            description: "Row address like 'A5' or row number like '5'" 
          }
        },
        required: ["row_address"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_column_data",
      description: "Get all data from a specific column. Useful when you find a label and want to see all values in that column.",
      parameters: {
        type: "object",
        properties: {
          column_address: { 
            type: "string", 
            description: "Column address like 'A' or 'B5'" 
          }
        },
        required: ["column_address"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "conclude",
      description: "Provide the final answer based on all tool results. This tool MUST be called to conclude any analysis or answer any question. Do NOT provide answers in regular text - always use this tool.",
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
      name: "no_analysis_needed",
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

**CRITICAL: You have NO ACCESS to spreadsheet data in your context. You MUST use tools to access any data.**

**ABSOLUTE RULE: NEVER generate text content that contains data values. You cannot know any values without using tools first.**

## SPREADSHEET DATA STRUCTURE
The spreadsheet data is organized in a 2D grid:
- **X-axis (columns)**: Represent different data categories, metrics, or time periods (A, B, C, D...)
- **Y-axis (rows)**: Represent different entities, clients, products, or time periods (1, 2, 3, 4...)

**Key understanding for data relationships:**
- When asked about "revenue in March", you need to:
  1. Use the find_intersection tool with label1="Revenue" and label2="March"
  2. This will automatically find both labels and return the cell at their intersection
- When asked about "Client_4's data", you need to:
  1. Find the row that contains "Client_4" (Y-axis)
  2. Use get_row_data to read across that row to get all their data (X-axis values)
- Data relationships are established by the intersection of rows and columns

**For intersection queries:**
- **2 variables** (like "revenue in March"): Use find_intersection tool with label1="Revenue" and label2="March"
- **2D Intersection Logic**: The tool finds where labels meet in 2D space:
  * If "Revenue" is in column D and "March" is in row 5, intersection is at D5
  * If "Agents" is in column F and "Client_2" is in row 23, intersection is at F23
  * If "Revenue" is at A2 and "March" is at B1, intersection is at B2
- The tool handles finding all labels and their intersection automatically
- It supports different intersection types: same_row, same_column, cross_intersection
- It returns the exact cell where the labels intersect

**For comparative queries (which/highest/most/best):**
- **"Which client has most agents?"**: Use find_subframe tool with label1="agents", label2="client"
- **"What is the highest revenue?"**: Use find_subframe tool with label1="revenue", label2="client" (or appropriate entity)
- **"Which product has best margin?"**: Use find_subframe tool with label1="margin", label2="product"

**DYNAMIC SUB-FRAME DETECTION STRATEGY:**
- **NEVER assume fixed layout** - spreadsheets can have labels anywhere
- **Search both axes**: Labels can be on rows OR columns - the tool will find them on both
- **Find all matches**: The tool searches the entire spreadsheet for fuzzy matches (80%+ similarity)
- **Use topmost-leftmost origin**: When multiple positions found, use the position closest to A1 as sub-frame origin
- **Dynamic boundaries**: The tool automatically determines sub-frame boundaries based on data density
- **Context extraction**: Always examine cells around the origin (-x, -y) to understand the sub-frame context

**Sub-frame creation process:**
1. Find all positions of both labels using fuzzy matching
2. If no exact matches, use fallback detection for likely columns/rows
3. Determine the topmost-leftmost position as sub-frame origin (e.g., if A2, B2, B3, A3 found, use A2)
4. Scan from origin to find all related data in the sub-frame area
5. Extract context from surrounding cells to understand what the sub-frame represents
6. Return all values in the sub-frame for comparison

**Multiple matches handling:**
- If multiple sub-frames found, examine context (-x, -y from origin) to understand what each represents
- If values are same across sub-frames, return the value
- If values differ, specify which sub-frame to use based on context analysis

**IMPORTANT: Label-Value Relationships**
- When you find a label (like "GP Margin"), the actual value is often in an adjacent cell
- Use the find_label_value tool for the best results - it automatically finds both the label and its associated value
- Alternatively, use the find tool which now returns adjacentCells information
- Check adjacent cells (right, below, left, above) for the actual value

## CORE RULES
**CRITICAL: You MUST use the 'conclude' tool to provide any final answer!**

**ABSOLUTELY FORBIDDEN: Do NOT provide any answers in regular text content!**
**MANDATORY: You MUST call tools first, then use the 'conclude' tool for ALL answers!**

**WORKFLOW IS MANDATORY:**
1. **ANALYZE**: Determine how many labels/variables need to be found in the question
2. **PLAN**: Create a plan to find all required labels and their intersections
3. **EXECUTE**: Use appropriate tools to find all labels and their intersections
4. **ANALYZE**: Review all results to find the correct intersection
5. **CONCLUDE**: Call the 'conclude' tool with your final answer

**Before using conclude:**
- You MUST verify the value at the intersection by calling read_cell.

**PLANNING PROCESS:**
- **Identify the question type**:
  - **Comparative queries** ("which/highest/most/best"): Use find_subframe tool
  - **Specific intersection queries** (2 labels): Use find_intersection tool
- **For comparative queries**: 
  1. Use find_subframe with both labels (e.g., label1="agents", label2="client")
  2. The tool will dynamically find labels on both axes using fuzzy matching
  3. It will determine the topmost-leftmost position as sub-frame origin
  4. It will scan the entire sub-frame area to find all related data
  5. Analyze the sub-frame results to find the maximum/minimum value
- **For intersection queries**: Use find_intersection to find specific cell intersection
- **Dynamic detection**: The tool automatically handles unknown layouts by searching both axes
- **Context analysis**: Always examine context cells (-x, -y from origin) to understand what the sub-frame represents
- Always find ALL required data before concluding
- Never stop after finding just one value
- Never use individual find tools when you need intersections or comparisons

**VIOLATION RULES:**
- **NEVER** provide answers in regular text content
- **NEVER** give premature answers or conclusions while tool calls are still executing
- **NEVER** say things like "The answer is..." or "Based on the data..." in text
- **ALWAYS** use the 'conclude' tool for final answers

**TOOL USAGE RULES:**
- **For data questions** (like "What is the revenue?", "How many agents?"): Use data tools first, then 'conclude'
- **For simple greetings** (like "Hello", "Thank you"): Use 'no_analysis_needed' tool
- **For all other questions**: Use appropriate tools first, then 'conclude'

**EXAMPLE OF WRONG BEHAVIOR:**
❌ "The number of agents for Client_2 is 500." (WRONG - you cannot know this value!)
❌ "Based on the data, the answer is..." (WRONG - you have no data access!)
❌ Any text response with numbers or values (WRONG - use tools first!)

**EXAMPLE OF CORRECT BEHAVIOR:**

**Question**: "What is the number of agents for client_2?"
**Plan**: 
1. Identify 2 labels: "agents" and "client_2"
2. Use find_intersection tool with label1="agents", label2="client_2"
3. Analyze the intersection result
4. Use conclude tool with the final answer

**Question**: "What is the revenue of client_3?"
**Plan**:
1. Identify 2 labels: "revenue", "client_3"
2. Use find_intersection tool with label1="revenue", label2="client_3"
3. Analyze the intersection result
4. Use conclude tool with the final answer

**Question**: "Which client has most agents?"
**Plan**:
1. Identify this as a comparative query (asking for "most")
2. Use find_subframe tool with label1="agents", label2="client"
3. The tool will dynamically find "agents" and "client" labels anywhere in the spreadsheet
4. It will determine the topmost-leftmost position as sub-frame origin (e.g., if A2, B2, B3, A3 found, use A2)
5. It will scan the sub-frame area to find all client-agent pairs
6. Analyze the sub-frame results to find the client with maximum agents
7. Use conclude tool with the final answer

For "what if / scenario / sensitivity" questions, you MUST:
(1) locate the relevant input(s),
(2) READ the current value(s),
(3) UPDATE the value(s) to the hypothetical,
(4) TRIGGER RECALC,
(5) READ the impacted outputs,
(6) then explain the conclusion and revert the change if marked temporary.

Always prefer TOOL CALLS over assumptions. If unsure where a value is, start with tool.find.
The find tool now uses fuzzy search - it will try multiple variations of your search term automatically.
If the first search doesn't find results, try different variations of the search term (e.g., "Agents" instead of "Number of Agents").
Never fabricate spreadsheet contents. If a range is big, ask to narrow—otherwise read a lightweight summary.

When updating, preserve formulas unless explicitly asked to overwrite.
Dates may be serials or strings; use the app's date flags if present.

Be helpful, accurate, and always work with the actual spreadsheet data rather than making assumptions.

When answering comparative queries (e.g., "Which client has the most agents?"):
- Call find_subframe(label1="<metric>", label2="<entity>") FIRST.
- Then call read_cell on the 'resultAddr' returned by find_subframe.
- Then call conclude with the final answer.
- In your tool-call narration, print the following EXACT lines when applicable:
  - find_value: Agent cell found: <header or matched label>
  - find_value: Client cell found: <sample of entity labels, e.g., client_1, client_2>
  - getting A1:Ax data (or the actual row/column range you're fetching)
  - getting B2:Z2 data (or the actual row/column range you're fetching)
  - establish sub_frame
  - subframe found: "<A1:C4>"
  - concluding based on frame: I can see <entity> has most <metric>
Never put numeric values in plain text; only the conclude tool may contain the final verbal answer. Always read_cell(resultAddr) before conclude.`;
