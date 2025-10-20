/* eslint-env node */
// MCP Odoo Service - Real integration with Odoo XML-RPC
import fetch from 'node-fetch';
import xml2js from 'xml2js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible paths for .env file
const envPaths = [
  path.join(__dirname, '../../.env'),        // From backend/services/ folder
  path.join(__dirname, '../../../.env'),     // From root folder
  path.join(process.cwd(), '.env'),          // From current working directory
  path.join(process.cwd(), '../.env')        // From parent of current working directory
];

// let envLoaded = false;
for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath });
    if (process.env.ODOO_URL) {
      // envLoaded = true;
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

class MCPOdooService {
  constructor(customConfig = null) {
    // Use custom config if provided, otherwise fall back to environment variables
    if (customConfig) {
      this.url = customConfig.url;
      this.db = customConfig.db;
      this.username = customConfig.username || 'admin';
      this.apiKey = customConfig.apiKey;
    } else {
      this.url = process.env.ODOO_URL;
      this.db = process.env.ODOO_DB;
      this.username = process.env.ODOO_USERNAME || 'admin';
      this.apiKey = process.env.ODOO_API_KEY;
    }
    this.uid = null;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing real Odoo connection...');
      console.log('URL:', this.url, 'DB:', this.db);
      
      // Check if this is a trial instance
      const isTrial = this.url.includes('trial') || this.url.includes('saas');
      if (isTrial) {
        console.log('⚠️ Trial Odoo instance detected - XML-RPC may be restricted');
        console.log('🔗 Please access your Odoo instance via web browser to verify data');
        console.log('📊 URL:', this.url);
        return false;
      }
      
      // Authenticate using the common endpoint
      this.uid = await this.authenticate();
      
      console.log('✅ Authentication successful, UID:', this.uid);
      return true;
    } catch (error) {
      console.error('❌ Odoo MCP initialization failed:', error.message);
      console.log('💡 This may be due to:');
      console.log('   - Trial instance restrictions');
      console.log('   - Incorrect credentials');
      console.log('   - Network connectivity issues');
      console.log('🔗 Please verify your Odoo instance at:', this.url);
      return false;
    }
  }

  async authenticate() {
    const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${this.db}</string></value></param>
    <param><value><string>${this.username}</string></value></param>
    <param><value><string>${this.apiKey}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

    const response = await fetch(`${this.url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'Mozilla/5.0 (compatible; OdooMCP/1.0)'
      },
      body: authXml
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlResponse = await response.text();
    return await this.parseXmlRpcResponse(xmlResponse);
  }

  async xmlRpcCall(model, method, args = [], kwargs = {}) {
    const xmlBody = this.buildXmlRpcRequest(model, method, args, kwargs);
    
    const response = await fetch(`${this.url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'Mozilla/5.0 (compatible; OdooMCP/1.0)'
      },
      body: xmlBody
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlResponse = await response.text();
    return await this.parseXmlRpcResponse(xmlResponse);
  }

  buildXmlRpcRequest(model, method, args, kwargs) {
    const params = [
      this.db,
      this.uid || this.apiKey,
      this.apiKey,
      model,
      method,
      args,
      kwargs
    ];

    return `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    ${params.map(param => `<param><value>${this.valueToXml(param)}</value></param>`).join('')}
  </params>
</methodCall>`;
  }

  valueToXml(value) {
    if (value === null || value === undefined) {
      return '<nil/>';
    } else if (typeof value === 'boolean') {
      return `<boolean>${value ? 1 : 0}</boolean>`;
    } else if (typeof value === 'number') {
      return `<double>${value}</double>`;
    } else if (typeof value === 'string') {
      return `<string><![CDATA[${value}]]></string>`;
    } else if (Array.isArray(value)) {
      return `<array><data>${value.map(item => `<value>${this.valueToXml(item)}</value>`).join('')}</data></array>`;
    } else if (typeof value === 'object') {
      return `<struct>${Object.entries(value).map(([key, val]) => 
        `<member><name>${key}</name><value>${this.valueToXml(val)}</value></member>`
      ).join('')}</struct>`;
    }
    return '<string><![CDATA[unknown]]></string>';
  }

  async parseXmlRpcResponse(xmlResponse) {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        explicitRoot: false
      });
      
      const result = await parser.parseStringPromise(xmlResponse);
      
      // Extract the main value from the XML-RPC response
      if (result && result.params && result.params.param && result.params.param.value) {
        return this.extractValue(result.params.param.value);
      }
      
      return null;
    } catch (error) {
      console.error('XML parsing error:', error);
      return null;
    }
  }

  extractValue(valueObj) {
    if (valueObj.array && valueObj.array.data) {
      // Handle array of records
      const data = valueObj.array.data;
      if (Array.isArray(data.value)) {
        return data.value.map(item => this.extractValue(item));
      } else if (data.value) {
        return [this.extractValue(data.value)];
      }
    } else if (valueObj.struct && valueObj.struct.member) {
      // Handle struct (record)
      const record = {};
      const members = Array.isArray(valueObj.struct.member) 
        ? valueObj.struct.member 
        : [valueObj.struct.member];
      
      members.forEach(member => {
        if (member.name && member.value) {
          record[member.name] = this.extractValue(member.value);
        }
      });
      
      return record;
    } else if (valueObj.string) {
      return valueObj.string;
    } else if (valueObj.int) {
      return parseInt(valueObj.int);
    } else if (valueObj.double) {
      return parseFloat(valueObj.double);
    } else if (valueObj.boolean) {
      return valueObj.boolean === '1';
    }
    
    return null;
  }

  async executeQueries(queries) {
    console.log('🔍 Executing Odoo queries:', queries.length);
    
    try {
      const results = [];
      
      for (const query of queries) {
        console.log(`🔧 Executing query: ${query.query_name}`);
        
        // Validate query before execution
        const validationResult = await this.validateQuery(query);
        if (!validationResult.isValid) {
          console.log(`⚠️ Query ${query.query_name} is invalid: ${validationResult.reason}`);
          results.push({
            query_name: query.query_name,
            data: [],
            count: 0,
            success: false,
            error: `Invalid query: ${validationResult.reason}`,
            status: 'no_active_query'
          });
          continue;
        }
        
        try {
          // Parse filters - handle both string and array formats
          let filters = query.filters;
          if (Array.isArray(filters) && filters.length > 0 && typeof filters[0] === 'string') {
            // Convert string filters to array format
            filters = filters.map(filter => {
              if (typeof filter === 'string') {
                // Parse string filters like "account_type = 'liability_payable'" or "balance < 0"
                const match = filter.match(/^(\w+)\s*(=|<|>|<=|>=|!=|in|not in|ilike|like)\s*(.+)$/);
                if (match) {
                  const [, field, operator, value] = match;
                  let parsedValue = value;
                  
                  // Parse value based on type
                  if (value.startsWith("'") && value.endsWith("'")) {
                    parsedValue = value.slice(1, -1); // Remove quotes
                  } else if (value === 'true') {
                    parsedValue = true;
                  } else if (value === 'false') {
                    parsedValue = false;
                  } else if (!isNaN(value)) {
                    parsedValue = parseFloat(value);
                  }
                  
                  return [field, operator, parsedValue];
                }
              }
              return filter;
            });
          }
          
          // Execute real Odoo query using search_read
          const data = await this.xmlRpcCall(
            query.table,
            'search_read',
            [filters],
            { fields: query.fields, limit: query.limit || 100 }
          );
          
          results.push({
            query_name: query.query_name,
            data: data || [],
            count: data ? data.length : 0,
            success: true
          });
          console.log(`✅ Query ${query.query_name} completed: ${data ? data.length : 0} records found`);
        } catch (error) {
          console.error(`❌ Query ${query.query_name} failed:`, error.message);
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
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Query execution failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate query before execution to ensure it follows Odoo documentation
   * Returns validation result with reason if invalid
   */
  async validateQuery(query) {
    try {
      // Check if query has required properties
      if (!query.table) {
        return { isValid: false, reason: 'Missing table/model name' };
      }
      
      if (!query.fields || !Array.isArray(query.fields) || query.fields.length === 0) {
        return { isValid: false, reason: 'Missing or empty fields array' };
      }
      
      if (!query.filters || !Array.isArray(query.filters)) {
        return { isValid: false, reason: 'Missing or invalid filters array' };
      }
      
      // Validate model name format (should be valid Python identifier)
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(query.table)) {
        return { isValid: false, reason: `Invalid model name format: ${query.table}` };
      }
      
      // Validate field names format
      for (const field of query.fields) {
        if (typeof field !== 'string') {
          return { isValid: false, reason: 'Field names must be strings' };
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(field)) {
          return { isValid: false, reason: `Invalid field name format: ${field}` };
        }
      }
      
      // Validate domain filters format
      for (const filter of query.filters) {
        if (!Array.isArray(filter) || filter.length < 3) {
          return { isValid: false, reason: 'Invalid filter format - must be [field, operator, value]' };
        }
        
        const [field, operator, value] = filter;
        
        // Validate field name in filter
        if (typeof field !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(field)) {
          return { isValid: false, reason: `Invalid field name in filter: ${field}` };
        }
        
        // Validate operator
        const validOperators = ['=', '!=', '<', '>', '<=', '>=', 'in', 'not in', 'like', 'ilike', 'not like', 'not ilike', '=like', '=ilike', 'child_of', 'parent_of'];
        if (!validOperators.includes(operator)) {
          return { isValid: false, reason: `Invalid operator: ${operator}. Valid operators: ${validOperators.join(', ')}` };
        }
        
        // Validate value based on operator
        if (['in', 'not in'].includes(operator) && !Array.isArray(value)) {
          return { isValid: false, reason: `Operator '${operator}' requires array value` };
        }
      }
      
      // Check for common invalid field references
      const invalidFieldPatterns = [
        /^[0-9]/, // Field starting with number
        /[^a-zA-Z0-9_.]/, // Field with invalid characters
        /^\./, // Field starting with dot
        /\.$/, // Field ending with dot
        /\.\./ // Double dots
      ];
      
      for (const field of query.fields) {
        for (const pattern of invalidFieldPatterns) {
          if (pattern.test(field)) {
            return { isValid: false, reason: `Invalid field name: ${field}` };
          }
        }
      }
      
      // Check for invalid domain patterns
      for (const filter of query.filters) {
        const [field] = filter;
        for (const pattern of invalidFieldPatterns) {
          if (pattern.test(field)) {
            return { isValid: false, reason: `Invalid field name in domain: ${field}` };
          }
        }
      }
      
      return { isValid: true, reason: 'Query is valid' };
      
    } catch (error) {
      return { isValid: false, reason: `Validation error: ${error.message}` };
    }
  }


}

export default MCPOdooService;
