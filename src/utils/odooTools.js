// Odoo Analysis Tools for AI Agent
// These tools help the AI agent analyze Odoo data and provide intelligent insights

export const odooTools = [
  {
    type: "function",
    function: {
      name: "plan_odoo_check",
      description: "Plan what Odoo data is needed to answer a check description",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "The check description to analyze"
          },
          analysis_plan: {
            type: "array",
            description: "List of Odoo queries needed to answer the check",
            items: {
              type: "object",
              properties: {
                query_name: { type: "string" },
                table: { type: "string" },
                filters: { 
                  type: "array",
                  items: { type: "string" }
                },
                fields: { 
                  type: "array",
                  items: { type: "string" }
                },
                reason: { type: "string" }
              }
            }
          }
        },
        required: ["description", "analysis_plan"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "execute_odoo_queries",
      description: "Execute the planned Odoo queries and analyze results",
      parameters: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            description: "Array of queries to execute",
            items: {
              type: "object",
              properties: {
                query_name: { type: "string" },
                table: { type: "string" },
                filters: { 
                  type: "array",
                  items: { type: "string" }
                },
                fields: { 
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        },
        required: ["queries"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_results",
      description: "Analyze the query results and provide final answer",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Original check description"
          },
          results: {
            type: "array",
            description: "Array of query results",
            items: {
              type: "object",
              properties: {
                query_name: { type: "string" },
                data: { 
                  type: "array",
                  items: { type: "object" }
                },
                count: { type: "number" }
              }
            }
          }
        },
        required: ["description", "results"]
      }
    }
  }
];

// System prompt for Odoo analysis
export const ODOO_ANALYSIS_PROMPT = `You are an expert Odoo financial analyst. Your role is to understand check descriptions and plan the necessary Odoo queries to answer them.

## WORKFLOW:
1. **PLAN**: Use 'plan_odoo_check' to understand what data is needed
2. **EXECUTE**: Use 'execute_odoo_queries' to get the data from Odoo
3. **ANALYZE**: Use 'analyze_results' to provide the final answer

## COMMON ODOO TABLES:
- **res.partner**: Partners (customers/suppliers)
- **account.move**: Journal entries and invoices
- **account.move.line**: Individual accounting lines
- **account.account**: Chart of accounts
- **account.bank.statement.line**: Bank transactions

## COMMON FILTERS:
- **account_type**: 'liability_payable', 'asset_receivable', 'income', 'expense'
- **move_type**: 'out_invoice', 'in_invoice', 'entry'
- **state**: 'draft', 'posted', 'cancel'
- **balance**: Use < 0 for debit balances, > 0 for credit balances

Always start with 'plan_odoo_check' to understand what's needed.`;

