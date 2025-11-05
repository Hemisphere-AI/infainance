/* eslint-env node */
import OpenAI from 'openai';

/**
 * Odoo AI Agent Service
 * Single source of truth for AI-driven Odoo queries and analysis
 * Works in both backend and Netlify environments
 */
export class OdooAiAgent {
  constructor(customConfig = null) {
    this.openai = null;
    this.mcpClient = null;
    this.consistentService = null;
    this.availableModels = [];
    this.availableFields = {};
    this.customConfig = customConfig;
    this.mcpTools = [];
    this.mcpServerUrl = null;
  }

  async initialize(customConfig = null) {
    try {
      // Use custom config if provided, otherwise use constructor config
      if (customConfig) {
        this.customConfig = customConfig;
        console.log('🔧 Using provided custom config:', {
          url: customConfig.url,
          db: customConfig.db,
          hasApiKey: !!customConfig.apiKey,
          username: customConfig.username
        });
      }
      
      // Initialize OpenAI
      const apiKey = process.env.VITE_OPENAI_KEY;
      if (!apiKey || apiKey === 'your_openai_api_key_here') {
        throw new Error('OpenAI API key not configured');
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      });

      // Initialize MCP services based on environment
      await this.initializeMCPServices();

      // Load available models and fields for AI context
      await this.loadOdooMetadata();

      console.log('🤖 Odoo AI Agent initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Odoo AI Agent:', error);
      return false;
    }
  }

  async initializeMCPServices() {
    try {
      // Determine MCP server URL - try Docker internal network first, then localhost
      // Check if we're in Docker or if MCP server is accessible
      // In Docker, use service name; in localhost, use mapped port
      const isInDocker = process.env.DOCKER_CONTAINER || 
                        process.env.NODE_ENV === 'production' ||
                        (typeof process !== 'undefined' && process.env.HOSTNAME && process.env.HOSTNAME.includes('zenith-backend'));
      
      // Try to detect environment - if we can reach Docker internal network, use that
      // Otherwise, use localhost with mapped port
      this.mcpServerUrl = isInDocker 
        ? 'http://mcp-odoo-server:3001'  // Docker internal network (container name)
        : 'http://localhost:3003';        // Local development (mapped port from docker-compose)
      
      console.log('🔧 MCP Server URL:', this.mcpServerUrl);
      console.log('🔧 Environment detection:', { 
        isInDocker, 
        DOCKER_CONTAINER: process.env.DOCKER_CONTAINER,
        NODE_ENV: process.env.NODE_ENV,
        HOSTNAME: process.env.HOSTNAME 
      });
      
      if (this.customConfig) {
        console.log('🔧 Using organization-specific Odoo configuration:', {
          url: this.customConfig.url,
          db: this.customConfig.db,
          hasApiKey: !!this.customConfig.apiKey,
          username: this.customConfig.username
        });
        
        // Initialize direct Odoo connection
        this.odooConfig = this.customConfig;
        console.log('✅ Initialized with organization-specific Odoo config');
      } else {
        console.log('⚠️ No custom config provided, using environment variables as fallback');
        // Fallback to environment variables if no custom config
        this.odooConfig = {
          url: process.env.ODOO_URL,
          db: process.env.ODOO_DB,
          username: process.env.ODOO_USERNAME,
          apiKey: process.env.ODOO_API_KEY
        };
        console.log('✅ Initialized with environment variables');
      }
      
      // Try to fetch MCP tools (will fallback to defaults if MCP server unavailable)
      await this.fetchMCPTools();
      
      // Log MCP connection status
      console.log(`📋 MCP Integration Status: ${this.mcpTools.length} tools available`);
    } catch (error) {
      console.error('❌ Odoo configuration initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Fetch available tools from MCP server
   */
  async fetchMCPTools() {
    try {
      // MCP servers typically expose tools via JSON-RPC, but if wrapped in HTTP, try that first
      // Try to connect via HTTP POST with JSON-RPC format
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };
      
      console.log('🔍 Fetching MCP tools from:', this.mcpServerUrl);
      
      try {
        const response = await fetch(`${this.mcpServerUrl}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mcpRequest),
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.result && data.result.tools) {
            this.mcpTools = this.convertMCPToolsToOpenAI(data.result.tools);
            console.log(`✅ Fetched ${this.mcpTools.length} MCP tools:`, this.mcpTools.map(t => t.function.name));
            return;
          }
        }
      } catch (httpError) {
        console.log('⚠️ HTTP JSON-RPC connection failed, trying direct HTTP endpoints:', httpError.message);
      }
      
      // Fallback: Use hardcoded MCP tools from the mcp-odoo package
      // Based on https://github.com/tuanle96/mcp-odoo/
      this.mcpTools = this.getDefaultMCPTools();
      console.log(`✅ Using default MCP tools: ${this.mcpTools.length} tools`);
      
    } catch (error) {
      console.warn('⚠️ Failed to fetch MCP tools, using defaults:', error.message);
      this.mcpTools = this.getDefaultMCPTools();
    }
  }
  
  /**
   * Get default MCP tools based on mcp-odoo package
   * These match the tools from https://github.com/tuanle96/mcp-odoo/
   */
  getDefaultMCPTools() {
    return [
      {
        type: "function",
        function: {
          name: "execute_method",
          description: "Execute any Odoo model method. Use this to: (1) Discover models - call ir.model.search_read([], {'fields':['model','name'], 'limit':100}) to list all models; (2) Discover fields - call model.fields_get() to get field definitions with 'help' text explaining each field's purpose; (3) Search records - call model.search_read([['field','operator',value]], {'fields':['field1','field2'], 'limit':100}) where domain is array like [['account_id.code','in',['700100']]]; (4) Read records - call model.read([1,2,3], {'fields':['field1','field2']}). Domain operators: '=', '!=', '>', '<', '>=', '<=', 'in', 'like', 'ilike'. MCP resources: odoo://models lists all models, odoo://model/{model_name} returns model info with fields including help text.",
          parameters: {
            type: "object",
            properties: {
              model: {
                type: "string",
                description: "Odoo model name (e.g., 'res.partner', 'account.move.line', 'ir.model')"
              },
              method: {
                type: "string",
                description: "Method name: 'fields_get' (returns field metadata including help text), 'search_read' (search and read records), 'read' (read by IDs), 'search' (search IDs only)"
              },
              args: {
                type: "array",
                description: "Positional arguments. For fields_get: []. For search_read: [[domain]] where domain is array like [['field','operator',value]]. For read: [[id1,id2]] array of integers.",
                items: {}
              },
              kwargs: {
                type: "object",
                description: "Keyword arguments. Common: {'fields':['field1','field2']} for fields to fetch, {'limit':100} for result limit, {'offset':0} for pagination.",
                additionalProperties: true
              }
            },
            required: ["model", "method"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_employee",
          description: "Search for employees by name. Use execute_method with model 'hr.employee' and method 'search_read' for more flexible searches.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name or part of name to search"
              },
              limit: {
                type: "number",
                description: "Maximum results (default: 20)",
                default: 20
              }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_holidays",
          description: "Search for holidays by date range. Use execute_method with model 'hr.leave' and method 'search_read' for more flexible searches.",
          parameters: {
            type: "object",
            properties: {
              start_date: {
                type: "string",
                description: "Start date (YYYY-MM-DD)"
              },
              end_date: {
                type: "string",
                description: "End date (YYYY-MM-DD)"
              },
              employee_id: {
                type: "number",
                description: "Optional employee ID filter"
              }
            },
            required: ["start_date", "end_date"]
          }
        }
      }
    ];
  }
  
  /**
   * Convert MCP tools format to OpenAI tools format
   */
  convertMCPToolsToOpenAI(mcpTools) {
    return mcpTools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        parameters: tool.inputSchema || tool.parameters || {
          type: "object",
          properties: {},
          required: []
        }
      }
    }));
  }
  
  /**
   * Execute an MCP tool call
   */
  async executeMCPTool(toolName, args) {
    try {
      console.log(`🔧 Executing MCP tool: ${toolName}`, args);
      
      // For execute_method, we can use direct Odoo XML-RPC
      if (toolName === 'execute_method' && this.odooConfig) {
        // Parse args and kwargs - handle JSON strings if LLM passed them as strings
        let parsedArgs = args.args || [];
        let parsedKwargs = args.kwargs || {};
        
        // Special handling: if args contains an object at the end, it might be kwargs
        // This handles cases where LLM passes: args: [[], { fields: [...] }]
        if (Array.isArray(parsedArgs) && parsedArgs.length > 0) {
          const lastArg = parsedArgs[parsedArgs.length - 1];
          if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg) && 
              (lastArg.fields || lastArg.limit || lastArg.offset || lastArg.order)) {
            // Last arg looks like kwargs, move it to kwargs
            console.log('⚠️ Detected kwargs in args, moving to kwargs:', lastArg);
            parsedKwargs = { ...parsedKwargs, ...lastArg };
            parsedArgs = parsedArgs.slice(0, -1);
          }
        }
        
        // If args is a string, parse it
        if (typeof parsedArgs === 'string') {
          try {
            parsedArgs = JSON.parse(parsedArgs);
          } catch (e) {
            console.warn('⚠️ Failed to parse args as JSON, using as-is:', e.message);
          }
        }
        
        // If kwargs is a string, parse it
        if (typeof parsedKwargs === 'string') {
          try {
            parsedKwargs = JSON.parse(parsedKwargs);
          } catch (e) {
            console.warn('⚠️ Failed to parse kwargs as JSON, using as-is:', e.message);
          }
        }
        
        // Ensure args is an array
        if (!Array.isArray(parsedArgs)) {
          parsedArgs = [];
        }
        
        // Ensure kwargs is an object
        if (typeof parsedKwargs !== 'object' || parsedKwargs === null || Array.isArray(parsedKwargs)) {
          parsedKwargs = {};
        }
        
        // Special handling for search_read: ensure fields is an array if present
        if (args.method === 'search_read' && parsedKwargs.fields) {
          if (typeof parsedKwargs.fields === 'string') {
            try {
              parsedKwargs.fields = JSON.parse(parsedKwargs.fields);
            } catch (e) {
              // If it's a string like "field1,field2", split it
              parsedKwargs.fields = parsedKwargs.fields.split(',').map(f => f.trim()).filter(f => f);
            }
          }
          if (!Array.isArray(parsedKwargs.fields)) {
            parsedKwargs.fields = [];
          }
        }
        
        console.log(`🔧 Parsed args:`, parsedArgs);
        console.log(`🔧 Parsed kwargs:`, parsedKwargs);
        
        return await this.executeOdooMethod(args.model, args.method, parsedArgs, parsedKwargs);
      }
      
      // For other tools, try MCP server JSON-RPC
      const mcpRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: `tools/call`,
        params: {
          name: toolName,
          arguments: args
        }
      };
      
      const response = await fetch(`${this.mcpServerUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcpRequest),
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.result || data;
      } else {
        throw new Error(`MCP tool execution failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Failed to execute MCP tool ${toolName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Execute an Odoo method directly via XML-RPC
   * This is used by the execute_method MCP tool
   */
  async executeOdooMethod(model, method, args = [], kwargs = {}) {
    try {
      console.log(`🔧 Executing Odoo method: ${model}.${method}`, { args, kwargs });
      
      // Authenticate
      const xmlrpcUrl = `${this.odooConfig.url}/xmlrpc/2/object`;
      const authUrl = xmlrpcUrl.replace('/xmlrpc/2/object', '/xmlrpc/2/common');
      
      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><string>${this.odooConfig.username}</string></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`,
        signal: AbortSignal.timeout(3000)
      });
      
      if (!authResponse.ok) {
        throw new Error(`Auth HTTP ${authResponse.status}: ${authResponse.statusText}`);
      }
      
      const authXml = await authResponse.text();
      const uidMatch = authXml.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/);
      if (!uidMatch) {
        throw new Error('Failed to authenticate');
      }
      
      const uid = parseInt(uidMatch[1]);
      console.log(`✅ Authenticated with Odoo, UID: ${uid}`);
      
      // Build execute_kw XML request
      // Format: execute_kw(db, uid, password, model, method, args, kwargs)
      const argsXml = this.buildArgsXML(args);
      const kwargsXml = this.buildKwargsXML(kwargs);
      
      const executeBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><i4>${uid}</i4></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><string>${model}</string></value></param>
    <param><value><string>${method}</string></value></param>
    <param><value><array><data>${argsXml}</data></array></value></param>
    <param><value><struct>${kwargsXml}</struct></value></param>
  </params>
</methodCall>`;
      
      // Log XML for debugging
      console.log(`📤 ${model}.${method} XML request length:`, executeBody.length);
      if (method === 'search_read') {
        console.log(`📤 ${model}.${method} args:`, JSON.stringify(args));
        console.log(`📤 ${model}.${method} kwargs:`, JSON.stringify(kwargs));
        console.log(`📤 ${model}.${method} kwargs XML:`, kwargsXml.substring(0, 500));
      }
      
      const executeResponse = await fetch(xmlrpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: executeBody,
        signal: AbortSignal.timeout(5000)
      });
      
      if (!executeResponse.ok) {
        throw new Error(`Execute HTTP ${executeResponse.status}: ${executeResponse.statusText}`);
      }
      
      const executeXml = await executeResponse.text();
      
      // Check for XML-RPC fault
      if (executeXml.includes('<fault>')) {
        // Log raw XML for debugging
        console.error(`❌ Odoo XML-RPC fault response (first 1000 chars):`, executeXml.substring(0, 1000));
        
        // Try multiple patterns to extract fault string
        let faultString = 'Unknown error';
        
        // Pattern 1: <faultString><string>...</string></faultString> (most common)
        const faultMatch1 = executeXml.match(/<faultString>[\s\S]*?<string>([\s\S]*?)<\/string>[\s\S]*?<\/faultString>/);
        if (faultMatch1 && faultMatch1[1]) {
          faultString = faultMatch1[1].trim();
          // Unescape XML entities
          faultString = faultString.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        } else {
          // Pattern 2: Try to extract from <fault><value><struct><member><name>faultString</name>...
          const faultMatch2 = executeXml.match(/<name>faultString<\/name>[\s\S]*?<value>[\s\S]*?<string>([\s\S]*?)<\/string>/);
          if (faultMatch2 && faultMatch2[1]) {
            faultString = faultMatch2[1].trim();
            faultString = faultString.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
          } else {
            // Pattern 3: Try to extract any text between fault tags
            const faultMatch3 = executeXml.match(/<fault>[\s\S]*?<value>[\s\S]*?<string>([\s\S]*?)<\/string>[\s\S]*?<\/value>[\s\S]*?<\/fault>/);
            if (faultMatch3 && faultMatch3[1]) {
              faultString = faultMatch3[1].trim();
              faultString = faultString.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
            }
          }
        }
        
        // Extract first few lines of error for readability
        const faultLines = faultString.split('\n');
        const shortFault = faultLines.length > 10 
          ? faultLines.slice(0, 10).join('\n') + '\n... (truncated)'
          : faultString;
        
        console.error(`❌ Odoo XML-RPC fault:`, shortFault);
        console.error(`❌ Request was:`, { model, method, args, kwargs });
        throw new Error(`Odoo error: ${shortFault}`);
      }
      
      const result = this.parseXMLResponse(executeXml);
      
      console.log(`✅ Method ${model}.${method} executed successfully`);
      
      return {
        success: true,
        result: result,
        model: model,
        method: method
      };
    } catch (error) {
      console.error('❌ Failed to execute Odoo method:', error);
      return {
        success: false,
        error: error.message,
        model: model,
        method: method
      };
    }
  }
  
  /**
   * Build XML for positional arguments
   */
  buildArgsXML(args) {
    if (!Array.isArray(args) || args.length === 0) {
      return '';
    }
    
    const serializeValue = (v) => {
      if (Array.isArray(v)) {
        return `<array><data>${v.map(item => `<value>${serializeValue(item)}</value>`).join('')}</data></array>`;
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        return `<i4>${v}</i4>`;
      }
      if (typeof v === 'boolean') {
        return `<boolean>${v ? 1 : 0}</boolean>`;
      }
      if (v === null || v === undefined) {
        return `<nil/>`;
      }
      return `<string>${String(v)}</string>`;
    };
    
    return args.map(arg => `<value>${serializeValue(arg)}</value>`).join('');
  }
  
  /**
   * Build XML for keyword arguments
   */
  buildKwargsXML(kwargs) {
    if (!kwargs || typeof kwargs !== 'object' || Object.keys(kwargs).length === 0) {
      return '';
    }
    
    const serializeValue = (v) => {
      if (Array.isArray(v)) {
        // Handle arrays - each element should be serialized
        const arrayItems = v.map(item => {
          if (Array.isArray(item)) {
            // Nested array (e.g., domain triplets)
            return `<value><array><data>${item.map(subItem => `<value>${serializeValue(subItem)}</value>`).join('')}</data></array></value>`;
          }
          return `<value>${serializeValue(item)}</value>`;
        });
        return `<array><data>${arrayItems.join('')}</data></array>`;
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        return `<i4>${v}</i4>`;
      }
      if (typeof v === 'boolean') {
        return `<boolean>${v ? 1 : 0}</boolean>`;
      }
      if (v === null || v === undefined) {
        return `<nil/>`;
      }
      if (typeof v === 'string') {
        // Escape XML special characters
        return `<string>${v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`;
      }
      return `<string>${String(v)}</string>`;
    };
    
    return Object.entries(kwargs).map(([key, value]) => {
      return `<member>
        <name>${key}</name>
        <value>${serializeValue(value)}</value>
      </member>`;
    }).join('');
  }
  
  /**
   * Parse XML response to extract result
   */
  parseXMLResponse(xml) {
    try {
      // Simple parsing - extract value between <param> tags
      const paramMatch = xml.match(/<param>[\s\S]*?<value>([\s\S]*?)<\/value>[\s\S]*?<\/param>/);
      if (paramMatch) {
        // For now, return raw XML - full parsing would handle all data types
        return { raw: paramMatch[1] };
      }
      return { raw: xml };
    } catch (error) {
      console.warn('⚠️ Failed to parse XML response:', error);
      return { raw: xml };
    }
  }
  
  /**
   * Fetch MCP resources (models list, model info, etc.)
   * Resources are accessed via URI: odoo://models, odoo://model/{name}, odoo://record/{model}/{id}, odoo://search/{model}/{domain}
   */
  async fetchMCPResource(uri) {
    try {
      console.log(`🔍 Fetching MCP resource: ${uri}`);
      
      // Try JSON-RPC method first
      const mcpRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'resources/read',
        params: {
          uri: uri
        }
      };
      
      try {
        const response = await fetch(`${this.mcpServerUrl}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mcpRequest),
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            console.log(`✅ Fetched MCP resource: ${uri}`);
            return data.result;
          }
        }
      } catch (httpError) {
        console.log(`⚠️ HTTP fetch failed for ${uri}, trying direct Odoo access as fallback:`, httpError.message);
      }
      
      // Fallback: If URI is odoo://models, try to use execute_method to fetch from ir.model
      if (uri === 'odoo://models' && this.odooConfig) {
        console.log('📋 Fetching models via Odoo XML-RPC as fallback');
        try {
          const modelsResult = await this.executeOdooMethod('ir.model', 'search_read', [
            [['model', 'like', 'account.']]  // Start with accounting models
          ], {
            fields: ['model', 'name'],
            limit: 100
          });
          
          if (modelsResult.success && modelsResult.result) {
            // Return in MCP format
            return modelsResult.result;
          }
        } catch (fallbackError) {
          console.warn('⚠️ Fallback model fetch failed:', fallbackError.message);
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch MCP resource ${uri}:`, error.message);
      return null;
    }
  }

  async loadOdooMetadata() {
    try {
      if (this.odooConfig) {
        console.log('📋 Loading Odoo metadata for organization:', this.odooConfig.db);
        
        try {
          // Try to fetch models dynamically from Odoo
          const models = await this.fetchOdooModels();
          if (models && models.length > 0) {
            this.availableModels = models;
            console.log('✅ Loaded dynamic Odoo models for AI context');
          } else {
            throw new Error('No models returned from Odoo');
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch dynamic models, using fallback:', error.message);
          // Fallback to basic models if dynamic fetch fails
          this.availableModels = [
            'account.move',
            'account.move.line', 
            'account.account',
            'res.partner',
            'product.product',
            'sale.order',
            'purchase.order'
          ];
          console.log('✅ Loaded fallback Odoo models for AI context');
        }
      } else {
        console.log('⚠️ No Odoo configuration available for metadata loading');
      }

      console.log(`📊 Loaded ${this.availableModels.length} Odoo models for AI context`);
    } catch (error) {
      console.error('⚠️ Failed to load Odoo metadata:', error);
    }
  }

  /**
   * Fetch available models from Odoo
   */
  async fetchOdooModels() {
    try {
      // First authenticate to get UID
      const xmlrpcUrl = `${this.odooConfig.url}/xmlrpc/2/object`;
      const authUrl = xmlrpcUrl.replace('/xmlrpc/2/object', '/xmlrpc/2/common');
      
      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Netlify-Function/1.0'
        },
        body: `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><string>${this.odooConfig.username}</string></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`,
        signal: AbortSignal.timeout(3000)
      });

      if (!authResponse.ok) {
        throw new Error(`Auth HTTP ${authResponse.status}: ${authResponse.statusText}`);
      }

      const authXml = await authResponse.text();
      const uidMatch = authXml.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/);
      if (!uidMatch) {
        throw new Error('Failed to parse UID from auth response');
      }

      const uid = parseInt(uidMatch[1]);

      // Now fetch models using ir.model
      const modelsResponse = await fetch(xmlrpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Netlify-Function/1.0'
        },
        body: `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><i4>${uid}</i4></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><string>ir.model</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param><value><array><data></data></array></value></param>
    <param><value><struct><member><name>fields</name><value><array><data><value><string>model</string></value><value><string>name</string></value></data></array></value></member><member><name>limit</name><value><i4>100</i4></value></member></struct></value></param>
  </params>
</methodCall>`,
        signal: AbortSignal.timeout(5000)
      });

      if (!modelsResponse.ok) {
        throw new Error(`Models HTTP ${modelsResponse.status}: ${modelsResponse.statusText}`);
      }

      const modelsXml = await modelsResponse.text();
      
      // Parse models from XML response
      const modelMatches = modelsXml.match(/<member><name>model<\/name><value><string>([^<]+)<\/string><\/value><\/member>/g);
      if (modelMatches) {
        const models = modelMatches.map(match => {
          const modelMatch = match.match(/<string>([^<]+)<\/string>/);
          return modelMatch ? modelMatch[1] : null;
        }).filter(model => model !== null && model.startsWith('account.'));
        
        console.log(`🔍 Found ${models.length} accounting models from Odoo`);
        return models;
      }

      return [];
    } catch (error) {
      console.error('❌ Failed to fetch Odoo models:', error);
      throw error;
    }
  }

  /**
   * Execute an AI-driven check based on description
   */
  async executeCheck(checkDescription, checkTitle = 'Custom Check', acceptanceCriteria = '') {
    const startTime = Date.now(); // Start timing
    
    try {
      console.log(`🎯 ODOO STEP 1: Starting check: ${checkTitle}`);
      console.log(`📝 ODOO STEP 1: Description: ${checkDescription}`);
      console.log(`📋 ODOO STEP 1: Acceptance Criteria: ${acceptanceCriteria}`);

      // Generate Odoo query using LLM
      console.log('🤖 ODOO STEP 2: Calling LLM for query generation...');
      const queryPlan = await this.analyzeCheckDescription(checkDescription, checkTitle);
      console.log('🧠 ODOO STEP 2: LLM Generated Query:', JSON.stringify(queryPlan, null, 2));

      // Execute query using direct Odoo API calls
      console.log('🔍 ODOO STEP 3: Executing query with organization-specific Odoo config...');
      const queryResult = await this.executeOdooQuery(queryPlan);
      console.log('📊 ODOO STEP 3: Query result:', `${queryResult.count} records found`);
      console.log('📋 ODOO STEP 3: Data preview:', queryResult.data?.slice(0, 2) || 'No data');

      // Generate LLM analysis of the results
      console.log('🧠 ODOO STEP 4: Generating LLM analysis...');
      const analysisResult = await this.analyzeResults(checkDescription, checkTitle, queryResult, acceptanceCriteria);
      console.log('📝 ODOO STEP 4: LLM Analysis:', analysisResult.analysis);

      // Calculate total execution time
      const totalDuration = Date.now() - startTime;

      // Return result with proper LLM analysis
      const result = {
        success: true,
        query: queryPlan,
        queryPlan: queryPlan, // Add queryPlan field for backend compatibility
        count: queryResult.count,
        data: queryResult.records || [],
        records: queryResult.records || [], // Use records from consistent service
        llmAnalysis: analysisResult.analysis,
        status: analysisResult.status || 'unknown', // Include LLM-determined status
        summary: analysisResult.summary || '', // Include LLM summary if available
        recordEvaluations: analysisResult.recordEvaluations || [], // Per-record evaluations
        tokensUsed: analysisResult.tokensUsed || 0,
        duration: totalDuration, // Use actual measured duration
        timestamp: new Date()
      };
      
      console.log('✅ ODOO STEP 5: Final result:', {
        success: result.success,
        count: result.count,
        dataLength: result.data?.length || 0,
        recordsLength: result.records?.length || 0,
        hasLlmAnalysis: !!result.llmAnalysis,
        hasQuery: !!result.query,
        hasQueryPlan: !!result.queryPlan,
        recordsPreview: result.records?.slice(0, 2) || 'No records'
      });
      
      return result;

    } catch (error) {
      const totalDuration = Date.now() - startTime; // Calculate duration even on error
      console.error('❌ ODOO - Check failed:', error.message);
      return {
        success: false,
        error: error.message,
        count: 0,
        data: [],
        duration: totalDuration,
        timestamp: new Date()
      };
    }
  }

  /**
   * Analyze check description to determine Odoo query parameters
   */
  async analyzeCheckDescription(description) {
    const systemPrompt = `You are an expert Odoo ERP analyst. Generate an Odoo query based on the check description.

## OUTPUT FORMAT - ALWAYS OUTPUT THIS EXACT JSON FORMAT:

{
  "model": ...,
  "domain": [
    ["...", ...]
  ],
  "fields": ["...", ...],
  "limit": 1000,
  "order": "id asc"
}

## Rules:
- Domain must be array of triplets: [field, operator, value]
- Return ONLY the JSON object, no other text.`;

    const userMessage = `Generate an Odoo query based on this check description: ${description}`;

    // LLM input diagnostics: capture prompt excerpts, parameters, models context, and hash
    try {
      const paramsPreview = {
        model: "gpt-4o",
        temperature: 0,
        top_p: 1,
        max_tokens: 1000,
      };
      const modelsSnapshot = Array.isArray(this.availableModels)
        ? { length: this.availableModels.length, head: this.availableModels.slice(0, 10) }
        : { length: 0, head: [] };

      // Simple stable hash for payload comparison
      const hashString = (s) => {
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
        return (h >>> 0).toString(16);
      };
      const payloadToHash = JSON.stringify({
        systemPrompt,
        userMessage,
        paramsPreview,
        modelsSnapshot,
        mcpToolsCount: this.mcpTools.length,
        odooDb: this.odooConfig?.db || null,
        odooUrl: this.odooConfig?.url || null,
      });
      const payloadHash = hashString(payloadToHash);

      console.log('🧪 LLM INPUT DIAGNOSTICS:');
      console.log('   Models count:', modelsSnapshot.length);
      console.log('   Models head:', modelsSnapshot.head.slice(0, 3).join(', '));
      console.log('   MCP tools available:', this.mcpTools.length);
      console.log('   MCP tools:', this.mcpTools.map(t => t.function.name).join(', '));
      console.log('   Odoo target:', `${this.odooConfig?.url} / ${this.odooConfig?.db}`);
      console.log('   LLM input hash:', payloadHash);
    } catch (diagErr) {
      console.warn('⚠️ Failed to emit LLM diagnostics:', diagErr?.message || diagErr);
    }

    const makeRequest = async (sysPrompt, usrMsg, tools = [], conversation = []) => {
      const messages = [
        { role: "system", content: sysPrompt },
        ...conversation,
        { role: "user", content: usrMsg }
      ];
      
      const requestConfig = {
        model: "gpt-4o",
        messages: messages,
        temperature: 0,
        top_p: 1,
        max_tokens: 2000  // Increased for tool calls
      };
      
      // Add tools if available
      if (tools.length > 0) {
        requestConfig.tools = tools;
        requestConfig.tool_choice = "auto"; // Let LLM choose to use tools or not
        console.log(`🔧 Passing ${tools.length} MCP tools to LLM:`, tools.map(t => t.function.name));
      } else {
        // If no tools, force JSON format
        requestConfig.response_format = { type: "json_object" };
      }
      
      const response = await this.openai.chat.completions.create(requestConfig);
      const message = response.choices[0].message;
      
      // Handle tool calls if LLM used them
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 LLM used ${message.tool_calls.length} MCP tools:`, message.tool_calls.map(tc => tc.function.name));
        
        // Execute tool calls and add results to conversation
        const toolResults = [];
        for (const toolCall of message.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await this.executeMCPTool(toolCall.function.name, args);
            
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(result)
            });
            
            console.log(`✅ Tool ${toolCall.function.name} result:`, result);
          } catch (toolError) {
            console.error(`❌ Tool ${toolCall.function.name} failed:`, toolError);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ success: false, error: toolError.message })
            });
          }
        }
        
        // Make another request with tool results
        const followUpMessages = [
          ...messages,
          { ...message, content: null }, // Clear content, keep tool_calls
          ...toolResults
        ];
        
        // Second request to get final query after tool results
        // IMPORTANT: Don't spread requestConfig - it contains tools which conflicts with response_format
        const followUpConfig = {
          model: "gpt-4o",
          messages: followUpMessages,
          temperature: 0,
          top_p: 1,
          max_tokens: 2000,
          response_format: { type: "json_object" } // Force JSON for final query - this requires tools to be absent
          // Explicitly NOT including tools or tool_choice - they conflict with response_format
        };
        
        console.log(`🔧 Making follow-up request with ${followUpMessages.length} messages`);
        console.log(`🔧 Tool results count: ${toolResults.length}`);
        
        const followUpResponse = await this.openai.chat.completions.create(followUpConfig);
        const followUpMessage = followUpResponse.choices[0].message;
        const followUpContent = followUpMessage.content;
        
        if (!followUpContent) {
          console.error(`❌ Follow-up response:`, {
            hasContent: !!followUpContent,
            hasToolCalls: !!followUpMessage.tool_calls,
            message: followUpMessage
          });
          throw new Error('LLM returned null content after tool calls');
        }
        
        console.log(`✅ Follow-up response received, length: ${followUpContent.length}`);
        return followUpContent.trim();
      }
      
      // No tools used, return direct content
      if (!message.content) {
        throw new Error('LLM returned null content');
      }
      return message.content.trim();
    };

    // Make request with MCP tools
    let content = await makeRequest(systemPrompt, userMessage, this.mcpTools, []);

    try {
      // Remove markdown code blocks if present
      let jsonContent = content;
      if (content.startsWith('```json')) {
        jsonContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        jsonContent = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      let queryPlan = JSON.parse(jsonContent);
      console.log('🤖 AI Query Plan:', queryPlan);
      
      // Validate query plan against consistency playbook
      let validation = this.validateQueryPlan(queryPlan);
      if (!validation.isValid) {
        // If invalid because of account.move + line_ids.*, request a corrected plan without hardcoding
        const needsModelFix = validation.errors.some(e => e.includes('line_ids') || e.includes('Use account.move.line'));
        if (needsModelFix) {
          const correctiveSystemPrompt = systemPrompt + `\n\n## Additional Guidance:\n- Do NOT filter account.move by line_ids.* fields.\n- When filtering by account codes, use "account.move.line" with ["account_id.code", "in", [...]] and (if needed) ["move_id.state", "=", "posted"].`;
          const correctiveUserMessage = userMessage + `\n\nThe previous attempt used account.move with line_ids.*, which is invalid. Please output a corrected plan.`;
          content = await makeRequest(correctiveSystemPrompt, correctiveUserMessage);
          let fixedContent = content;
          if (fixedContent.startsWith('```json')) fixedContent = fixedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          if (fixedContent.startsWith('```')) fixedContent = fixedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
          queryPlan = JSON.parse(fixedContent);
          console.log('🤖 AI Query Plan (corrected):', queryPlan);
          validation = this.validateQueryPlan(queryPlan);
          if (!validation.isValid) {
            throw new Error(`Invalid query plan after correction: ${validation.errors.join(', ')}`);
          }
        } else {
          throw new Error(`Invalid query plan: ${validation.errors.join(', ')}`);
        }
      }
      
      return queryPlan;
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', content);
      console.error('❌ Parse error:', parseError.message);
      throw new Error('AI returned invalid query plan');
    }
  }

  /**
   * Execute Odoo query using organization-specific configuration
   */
  async executeOdooQuery(queryPlan) {
    // Log the raw plan received
    try {
      console.log('🧩 ODOO EXECUTE - Query Plan:', JSON.stringify(queryPlan));
    } catch (e) {
      console.log('🧩 ODOO EXECUTE - Query Plan (non-JSON)', queryPlan);
    }

    const appliedPlan = queryPlan;

    try {
      if (!this.odooConfig) {
        throw new Error('No Odoo configuration available');
      }

      console.log('🔧 Executing query with Odoo config:', {
        url: this.odooConfig.url,
        db: this.odooConfig.db,
        model: appliedPlan.model
      });

      // Use fetch-based Odoo API calls to match production test
      const odooUrl = this.odooConfig.url.replace(/\/$/, '');
      const xmlrpcUrl = `${odooUrl}/xmlrpc/2/object`;
      
      console.log('🔧 Using fetch-based Odoo API calls to:', xmlrpcUrl);

      // Authenticate with Odoo using fetch
      const uid = await this.authenticateOdooWithFetch(xmlrpcUrl);
      if (!uid) {
        throw new Error('Failed to authenticate with Odoo');
      }

      console.log('✅ Authenticated with Odoo, UID:', uid);

      // Execute search and read using fetch
      const searchResult = await this.searchOdooRecordsWithFetch(xmlrpcUrl, uid, appliedPlan);
      console.log('📊 Search result:', searchResult?.length || 0, 'records');

      return {
        success: true,
        count: searchResult?.length || 0,
        records: searchResult || [],
        data: searchResult || []
      };

    } catch (error) {
      console.error('❌ Failed to execute Odoo query:', error);
      
      // Return a more informative error for timeouts
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        console.log('⚠️ Odoo timeout - returning fallback response');
        // Return a fallback response instead of complete failure
        return {
          success: true,
          count: 0,
          records: [],
          data: [],
          warning: 'Odoo connection timeout - results may be incomplete',
          error: 'Connection timeout - please check your Odoo instance'
        };
      }
      
      return {
        success: false,
        count: 0,
        records: [],
        data: [],
        error: error.message
      };
    }
  }

  /**
   * Authenticate with Odoo using fetch (serverless-friendly)
   */
  async authenticateOdooWithFetch(xmlrpcUrl) {
    try {
      // Validate URL before making request
      if (!xmlrpcUrl || xmlrpcUrl.includes('your_odoo_url_here') || xmlrpcUrl.includes('placeholder')) {
        throw new Error(`Invalid Odoo URL: ${xmlrpcUrl}. Please set a real Odoo URL in your environment variables.`);
      }
      
      const authUrl = xmlrpcUrl.replace('/xmlrpc/2/object', '/xmlrpc/2/common');
      
      // Additional URL validation
      try {
        new URL(authUrl);
      } catch (urlError) {
        throw new Error(`Invalid Odoo URL format: ${authUrl}. Please check your ODOO_URL environment variable.`);
      }
      
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Netlify-Function/1.0'
        },
        body: `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><string>${this.odooConfig.username}</string></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`,
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlResponse = await response.text();
      console.log('🔐 Auth response received');
      console.log('🔍 Auth response length:', xmlResponse.length);
      console.log('🔍 Auth response preview:', xmlResponse.substring(0, 200) + '...');
      
      // Parse XML response to extract UID - handle both <i4> and <int> formats
      const uidMatch = xmlResponse.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/);
      if (uidMatch) {
        const uid = parseInt(uidMatch[1]);
        console.log('✅ Odoo authentication successful, UID:', uid);
        return uid;
      } else {
        console.error('❌ Failed to parse authentication response');
        console.error('🔍 Full response:', xmlResponse);
        throw new Error('Failed to parse authentication response');
      }
    } catch (error) {
      console.error('❌ Odoo authentication failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Odoo (legacy method)
   */
  async authenticateOdoo(client) {
    return this.authenticateOdooWithTimeout(client);
  }

  async searchOdooRecordsWithFetch(xmlrpcUrl, uid, queryPlan) {
      // Extra logging of model/domain before sending
      try {
        console.log('🔧 Odoo SEARCH - Model:', queryPlan.model);
        console.log('🔧 Odoo SEARCH - Domain:', JSON.stringify(queryPlan.domain));
        console.log('🔧 Odoo SEARCH - Limit:', queryPlan.limit);
      } catch (e) {
        // Logging failed, continue
      }

    try {
      // Build domain XML exactly as test-production-flow.js does
      const domainXml = this.buildDomainXML(queryPlan.domain || []);
      // Use limit from query plan, or default to 50, but respect the plan's limit (up to 1000)
      const limitValue = Math.min(queryPlan.limit || 50, 1000); // Use query plan limit, cap at 1000
      
      // Log domain details for comparison with test
      console.log('🔍 DOMAIN COMPARISON:');
      console.log('   Domain array:', JSON.stringify(queryPlan.domain || []));
      console.log('   Domain XML length:', domainXml.length);
      console.log('   Domain XML (first 200 chars):', domainXml.substring(0, 200));
      
      // Build search XML exactly matching test-production-flow.js structure
      const searchBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><i4>${uid}</i4></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><string>${queryPlan.model}</string></value></param>
    <param><value><string>search</string></value></param>
    <param><value><array><data><value><array><data>${domainXml}</data></array></value></data></array></value></param>
    <param><value><struct><member><name>limit</name><value><i4>${limitValue}</i4></value></member></struct></value></param>
  </params>
</methodCall>`;
      
      // Log generated XML for debugging
      console.log('📤 Search XML length:', searchBody.length);
      console.log('📤 Search XML (first 600 chars):', searchBody.substring(0, 600));
      console.log('📤 Search XML (domain section):', searchBody.substring(searchBody.indexOf('<array><data><value><array><data>'), searchBody.indexOf('</data></array></value></data></array></value></param>') + 50));
      
      // First, search for record IDs
      const searchResponse = await fetch(xmlrpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Netlify-Function/1.0'
        },
        body: searchBody,
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!searchResponse.ok) {
        throw new Error(`Search HTTP ${searchResponse.status}: ${searchResponse.statusText}`);
      }

      const searchXml = await searchResponse.text();
      console.log('🔍 Search response received');
      console.log('🔍 Search response length:', searchXml.length);
      console.log('🔍 Search response preview:', searchXml.substring(0, 300) + '...');
      console.log('🔍 Search response full:', searchXml); // Full response for comparison
      
      // Parse search results to get record IDs
      const recordIds = this.parseSearchResults(searchXml);
      console.log('🔍 Found record IDs:', recordIds?.length || 0);
      console.log('🔍 Record IDs:', recordIds);
      console.log('🔍 COMPARISON: Test found [63, 59], Agent found:', recordIds);

      if (!recordIds || recordIds.length === 0) {
        console.log('📭 No records found');
        return [];
      }

      // Then, read the records - Odoo read(ids, fields) takes both as positional args
      // execute_kw format: execute_kw(db, uid, password, model, method, args, kwargs)
      // For read: args = [ids_array, fields_array], kwargs = {}
      const idsArrayXml = `<value><array><data>${recordIds.map(id => `<value><i4>${id}</i4></value>`).join('')}</data></array></value>`;
      const fieldsArrayXml = `<value><array><data>${this.buildFieldsXML(queryPlan.fields || [])}</data></array></value>`;
      
      const readBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><i4>${uid}</i4></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><string>${queryPlan.model}</string></value></param>
    <param><value><string>read</string></value></param>
    <param><value><array><data>${idsArrayXml}${fieldsArrayXml}</data></array></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;
      
      console.log('📤 Read XML - IDs being read:', recordIds);
      console.log('📤 Read XML length:', readBody.length);
      console.log('📤 Read XML preview:', readBody.substring(0, 400));
      
      const readResponse = await fetch(xmlrpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Netlify-Function/1.0'
        },
        body: readBody,
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (!readResponse.ok) {
        throw new Error(`Read HTTP ${readResponse.status}: ${readResponse.statusText}`);
      }

      const readXml = await readResponse.text();
      console.log('📋 Read response received');
      console.log('📋 Read response length:', readXml.length);
      console.log('📋 Read response preview:', readXml.substring(0, 500));
      console.log('📋 Read response full:', readXml); // Full response for debugging
      
      // Parse read results
      const records = this.parseReadResults(readXml);
      console.log('📋 Read records parsed:', records?.length || 0);
      console.log('📋 Read records detail:', JSON.stringify(records, null, 2));
      
      return records || [];
    } catch (error) {
      console.error('❌ Odoo search/read failed:', error);
      throw error;
    }
  }

  async readOdooRecordsWithFetch(xmlrpcUrl, uid, queryPlan, ids) {
      try {
        console.log('🔧 Odoo READ - Model:', queryPlan.model);
        console.log('🔧 Odoo READ - Fields:', JSON.stringify(queryPlan.fields));
        console.log('🔧 Odoo READ - IDs len:', Array.isArray(ids) ? ids.length : 0);
      } catch (e) {
        // Logging failed, continue
      }

    try {
      // Then, read the records
      const readResponse = await fetch(xmlrpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Netlify-Function/1.0'
        },
        body: `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${this.odooConfig.db}</string></value></param>
    <param><value><i4>${uid}</i4></value></param>
    <param><value><string>${this.odooConfig.apiKey}</string></value></param>
    <param><value><string>${queryPlan.model}</string></value></param>
    <param><value><string>read</string></value></param>
    <param><value><array><data>${ids.map(id => `<value><i4>${id}</i4></value>`).join('')}</data></array></value></param>
    <param><value><struct><member><name>fields</name><value><array><data>${this.buildFieldsXML(queryPlan.fields || [])}</data></array></value></member></struct></value></param>
  </params>
</methodCall>`,
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (!readResponse.ok) {
        throw new Error(`Read HTTP ${readResponse.status}: ${readResponse.statusText}`);
      }

      const readXml = await readResponse.text();
      console.log('📋 Read response received');
      
      // Parse read results
      const records = this.parseReadResults(readXml);
      console.log('📋 Read records:', records?.length || 0);
      
      return records || [];
    } catch (error) {
      console.error('❌ Odoo read failed:', error);
      throw error;
    }
  }

  /**
   * Build domain XML for Odoo search
   */
  buildDomainXML(domain) {
    if (!domain || domain.length === 0) {
      return '';
    }

    const serializeValue = (v) => {
      if (Array.isArray(v)) {
        // Array of values
        return `<array><data>${v.map(item => `<value><string>${String(item)}</string></value>`).join('')}</data></array>`;
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        return `<i4>${v}</i4>`;
      }
      if (typeof v === 'boolean') {
        return `<boolean>${v ? 1 : 0}</boolean>`;
      }
      if (v === null || v === undefined) {
        return `<nil/>`;
      }
      // Default to string
      return `<string>${String(v)}</string>`;
    };

    return domain.map(condition => {
      if (Array.isArray(condition) && condition.length === 3) {
        const [field, operator, value] = condition;
        // Special-case 'in' with array of values
        if (operator === 'in' && Array.isArray(value)) {
          const valueXml = `<array><data>${value.map(item => `<value><string>${String(item)}</string></value>`).join('')}</data></array>`;
          return `<value><array><data>
          <value><string>${field}</string></value>
          <value><string>${operator}</string></value>
          <value>${valueXml}</value>
        </data></array></value>`;
        }
        // Generic triplet
        return `<value><array><data>
          <value><string>${field}</string></value>
          <value><string>${operator}</string></value>
          <value>${serializeValue(value)}</value>
        </data></array></value>`;
      }
      // Fallback for invalid condition
      return '';
    }).join('');
  }

  /**
   * Build fields XML for Odoo read
   */
  buildFieldsXML(fields) {
    if (!fields || fields.length === 0) {
      return '';
    }
    
    return fields.map(field => `<value><string>${field}</string></value>`).join('');
  }

  /**
   * Parse search results XML to extract record IDs
   */
  parseSearchResults(xml) {
    try {
      // Handle both <i4> and <int> formats for record IDs
      const idMatches = xml.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/g);
      if (idMatches) {
        return idMatches.map(match => {
          const idMatch = match.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/);
          return idMatch ? parseInt(idMatch[1]) : null;
        }).filter(id => id !== null);
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to parse search results:', error);
      return [];
    }
  }

  /**
   * Parse read results XML to extract records
   * Handles strings, integers, doubles, arrays (many2one), and booleans
   */
  parseReadResults(xml) {
    try {
      // Match each record struct - be more careful with nested structures
      const recordMatches = xml.match(/<value><struct>[\s\S]*?<\/struct><\/value>/g);
      if (!recordMatches) {
        console.log('⚠️ No record structs found in XML');
        return [];
      }

      console.log(`📋 Found ${recordMatches.length} record structs to parse`);

      return recordMatches.map((recordXml, recordIndex) => {
        const record = {};
        
        // Extract all field members - handle nested values more carefully
        // Pattern: <member><name>fieldName</name><value>...value content...</value></member>
        // Need to match value content even if it contains nested tags
        
        // First, find all member tags with their positions
        const memberStartPattern = /<member>/g;
        const members = [];
        let memberMatch;
        
        while ((memberMatch = memberStartPattern.exec(recordXml)) !== null) {
          const startPos = memberMatch.index;
          // Find the matching closing </member> tag
          let depth = 1;
          let pos = startPos + memberMatch[0].length;
          
          while (depth > 0 && pos < recordXml.length) {
            if (recordXml.substring(pos, pos + 8) === '<member>') {
              depth++;
              pos += 8;
            } else if (recordXml.substring(pos, pos + 9) === '</member>') {
              depth--;
              if (depth > 0) pos += 9;
            } else {
              pos++;
            }
          }
          
          if (depth === 0) {
            members.push({ start: startPos, end: pos + 9 });
          }
        }
        
        // Extract each member
        members.forEach(memberRange => {
          const memberXml = recordXml.substring(memberRange.start, memberRange.end);
          
          // Extract field name
          const nameMatch = memberXml.match(/<name>([^<]+)<\/name>/);
          if (!nameMatch) return;
          
          const fieldName = nameMatch[1];
          
          // Extract value - find content between <value> and </value>
          const valueStart = memberXml.indexOf('<value>') + 7;
          const valueEnd = memberXml.lastIndexOf('</value>');
          
          if (valueStart >= 7 && valueEnd > valueStart) {
            const valueXml = memberXml.substring(valueStart, valueEnd);
          
            // Handle many2one as array: <array><data><value><i4>123</i4></value><value><string>Name</string></value></data></array>
            if (valueXml.includes('<array><data>')) {
              const arrayMatch = valueXml.match(/<array><data>(.*?)<\/data><\/array>/s);
              if (arrayMatch) {
                const idMatch = arrayMatch[1].match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/);
                const nameMatch = arrayMatch[1].match(/<value><string>([^<]*)<\/string><\/value>/);
                record[fieldName] = idMatch ? parseInt(idMatch[1]) : null;
                record[fieldName + '_name'] = nameMatch ? nameMatch[1] : null;
              } else {
                record[fieldName] = null;
              }
            }
            // Handle integer: <i4>123</i4> or <int>123</int>
            else if (valueXml.match(/<(?:i4|int)>/)) {
              const intMatch = valueXml.match(/<(?:i4|int)>(\d+)<\/(?:i4|int)>/);
              if (intMatch) {
                record[fieldName] = parseInt(intMatch[1]);
              }
            }
            // Handle double: <double>123.45</double>
            else if (valueXml.includes('<double>')) {
              const doubleMatch = valueXml.match(/<double>([\d.]+)<\/double>/);
              if (doubleMatch) {
                record[fieldName] = parseFloat(doubleMatch[1]);
              }
            }
            // Handle boolean: <boolean>1</boolean> or <boolean>0</boolean>
            else if (valueXml.includes('<boolean>')) {
              const boolMatch = valueXml.match(/<boolean>([01])<\/boolean>/);
              if (boolMatch) {
                record[fieldName] = boolMatch[1] === '1';
              }
            }
            // Handle null: <nil/>
            else if (valueXml.includes('<nil/>') || valueXml.trim() === '') {
              record[fieldName] = null;
            }
            // Handle string: <string>value</string>
            else if (valueXml.includes('<string>')) {
              const stringMatch = valueXml.match(/<string>([^<]*)<\/string>/);
              if (stringMatch) {
                record[fieldName] = stringMatch[1];
              } else {
                // Fallback: try to extract any text content
                record[fieldName] = valueXml.replace(/<[^>]+>/g, '').trim() || null;
              }
            }
            // Fallback: try to extract any text content
            else {
              record[fieldName] = valueXml.replace(/<[^>]+>/g, '').trim() || null;
            }
          }
        });
        
        console.log(`📋 Record ${recordIndex + 1} parsed:`, Object.keys(record).length, 'fields');
        console.log(`📋 Record ${recordIndex + 1} fields:`, Object.keys(record));
        
        return record;
      });
    } catch (error) {
      console.error('❌ Failed to parse read results:', error);
      console.error('❌ XML snippet:', xml.substring(0, 500));
      return [];
    }
  }

  /**
   * Search and read records from Odoo (legacy method)
   */
  async searchOdooRecords(client, uid, queryPlan) {
    return this.searchOdooRecordsWithTimeout(client, uid, queryPlan);
  }

  /**
   * Validate query plan against consistency playbook
   */
  validateQueryPlan(queryPlan) {
    const errors = [];

    // Check required fields
    if (!queryPlan.model) {
      errors.push('Missing model');
    }

    if (!Array.isArray(queryPlan.domain)) {
      errors.push('Domain must be an array of triplets');
    } else {
      // Validate domain format
      queryPlan.domain.forEach((filter, index) => {
        if (!Array.isArray(filter) || filter.length !== 3) {
          errors.push(`Domain filter ${index} must be [field, operator, value]`);
        }
      });

      // Disallow invalid account.move nested line filters
      const usesLineIds = queryPlan.model === 'account.move' && queryPlan.domain.some(f => Array.isArray(f) && typeof f[0] === 'string' && f[0].startsWith('line_ids.'));
      if (usesLineIds) {
        errors.push('Use account.move.line when filtering by line/account fields; account.move with line_ids.* is invalid');
      }
    }

    if (!Array.isArray(queryPlan.fields)) {
      errors.push('Fields must be an array');
    }

    if (queryPlan.limit && (typeof queryPlan.limit !== 'number' || queryPlan.limit <= 0 || queryPlan.limit > 1000)) {
      errors.push('Limit must be a positive number <= 1000');
    }

    if (queryPlan.order && typeof queryPlan.order !== 'string') {
      errors.push('Order must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Use LLM with conclude tool to analyze results and determine status
   */
  async analyzeResults(description, title, queryResult, acceptanceCriteria = '') {
    console.log('🔍 ODOO LLM ANALYSIS INPUT:');
    console.log('📋 Description:', description);
    console.log('📋 Title:', title);
    console.log('📊 Model:', queryResult.model);
    console.log('📊 QueryResult:', JSON.stringify(queryResult, null, 2));
    console.log('📋 Acceptance Criteria:', acceptanceCriteria);

    // Check if this is a connection error
    if (queryResult.error) {
      const analysis = `Connection error: ${queryResult.error}. Please check your Odoo configuration and credentials.`;
      console.log('✅ ODOO LLM ANALYSIS OUTPUT (ERROR):', analysis);
      
      return {
        success: false,
        analysis,
        tokensUsed: 0,
        error: queryResult.error
      };
    }

    try {
      const count = Number(queryResult?.count || 0);
      const records = queryResult?.records || [];
      
      // Extract record IDs explicitly for LLM to reference
      const recordIds = records.map(r => r.id).filter(id => id != null);
      console.log('📋 Record IDs to evaluate:', recordIds);

      const systemPrompt = `You are an expert bookkeeping analyst.

Task:
1) Read ONLY the acceptance criteria and the results (records found)
2) Evaluate EACH record individually: Does this specific record meet the acceptance criteria?
3) Determine overall status based on record evaluations:
   - If ALL records meet criteria → status: "passed"
   - If ANY record fails criteria → status: "failed"
   - If cannot determine → status: "unknown"
4) Write a brief, direct analysis (2-5 sentences) stating your conclusion clearly
5) Call the 'conclude' tool with:
   - Overall status (passed/failed/unknown/warning/open)
   - recordEvaluations: MUST include exactly one evaluation for EACH record ID listed below

CRITICAL LOGIC:
- Records are provided for you to EVALUATE, not to determine if they should exist
- Finding records does NOT mean failure - you must evaluate if those records meet the criteria
- If acceptance criteria says "no invoices should deviate >40%" and all invoices are within 40% → status: "passed"
- If acceptance criteria says "0 records" and 0 records found → status: "passed"
- If acceptance criteria says "0 records" and records found → status: "failed"
- Evaluate EACH record: Does this record satisfy the acceptance criteria?
- Do NOT add "however" statements, contradictions, or hedge when the analysis is clear
- Be direct: If all records meet criteria, state "passed" confidently

CRITICAL REQUIREMENTS:
- You MUST provide a recordEvaluation for EVERY record ID listed
- The recordId in each evaluation MUST match one of the record IDs from the records array
- If overall status is "passed", ALL individual record statuses should be "passed"
- If overall status is "failed", at least one record status should be "failed"
- Evaluate ONLY based on the acceptance criteria - ignore any check description implications

Statuses:
- passed: The acceptance criteria IS met by the data/record
- failed: The acceptance criteria is NOT met by the data/record
- unknown: Cannot determine if criteria is met
- warning: Criteria is partially met with concerns
- open: Error occurred
`;

      const userMessage = `Acceptance criteria: ${acceptanceCriteria || 'No acceptance criteria defined'}

Results: ${count} records found
${JSON.stringify(records, null, 2)}

Record IDs that MUST be evaluated: ${recordIds.length > 0 ? JSON.stringify(recordIds) : 'No records found'}

EVALUATION PROCESS:
1. For EACH record above, determine: Does this specific record meet the acceptance criteria?
2. If all records meet criteria → overall status: "passed"
3. If any record fails criteria → overall status: "failed"

IMPORTANT:
- The records above are provided for evaluation - they exist and should be checked
- Do NOT treat the presence of records as a failure - evaluate if each record meets the criteria
- Do NOT add contradictions or "however" statements - be direct and clear
- Example: If criteria says "deviations >40% are not allowed" and all records are within 40% → status: "passed"

CRITICAL: You MUST evaluate EVERY record and include a recordEvaluation for EACH record ID listed above.

Example recordEvaluations format:
[
  {"recordId": ${recordIds[0] || 'ID1'}, "status": "passed", "reason": "Record meets criteria because..."},
  {"recordId": ${recordIds[1] || 'ID2'}, "status": "passed", "reason": "Record meets criteria because..."}
]

After evaluating each record, determine overall status based on the record evaluations:
- Overall status: "passed" if ALL records meet criteria, "failed" if ANY record fails
- recordEvaluations array with EXACTLY ${recordIds.length} entries (one for each record ID: ${recordIds.join(', ')})`;

      // Define tools inline for analysis
      const tools = [
        {
          type: "function",
          function: {
            name: "conclude",
            description: "Classify the analysis outcome.",
            parameters: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  enum: ["passed", "failed", "unknown", "warning", "open"],
                  description: "Final status: passed (supports acceptance criteria), failed (contradicts), unknown (insufficient), warning (partial/concerns), open (error)."
                },
                reasoning: {
                  type: "string",
                  description: "Short reasoning (2-5 sentences) explaining the decision."
                },
                summary: {
                  type: "string",
                  description: "One-line summary."
                },
                recordEvaluations: {
                  type: "array",
                  description: "REQUIRED: Evaluation for EVERY record found. Must include exactly one entry per record ID from the results. Array of objects with: {recordId: number, status: string, reason: string}. Status: passed/failed/warning/unknown. Each recordId MUST match an ID from the records array.",
                  items: {
                    type: "object",
                    properties: {
                      recordId: {
                        type: "number",
                        description: "REQUIRED: The exact ID of the record being evaluated (must match an ID from the records array)"
                      },
                      status: {
                        type: "string",
                        enum: ["passed", "failed", "warning", "unknown"],
                        description: "REQUIRED: Does this specific record meet the acceptance criteria? Use 'passed' if it meets criteria, 'failed' if it doesn't."
                      },
                      reason: {
                        type: "string",
                        description: "REQUIRED: Brief reason (1-2 sentences) why this specific record passes/fails the acceptance criteria"
                      }
                    },
                    required: ["recordId", "status", "reason"]
                  }
                }
              },
              required: ["status", "reasoning", "summary", "recordEvaluations"]
            }
          }
        }
      ];
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        tools: tools,
        tool_choice: "required",
        temperature: 0.1,
        max_tokens: 2000
      });

      const message = response.choices[0].message;
      const toolCalls = message.tool_calls || [];
      
      if (toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        if (toolCall.function.name === 'conclude') {
          const args = JSON.parse(toolCall.function.arguments);
          console.log('🎯 Agent conclude tool result:', args);
          
          // Validate and log recordEvaluations
          const providedEvaluations = args.recordEvaluations || [];
          console.log('📋 LLM provided recordEvaluations:', providedEvaluations.length, 'entries');
          console.log('📋 Expected record IDs:', recordIds);
          console.log('📋 LLM provided record IDs:', providedEvaluations.map(e => e.recordId));
          
          // Check if all record IDs have evaluations
          const evaluatedIds = providedEvaluations.map(e => Number(e.recordId));
          const missingIds = recordIds.filter(id => !evaluatedIds.includes(Number(id)));
          
          if (missingIds.length > 0) {
            console.log('⚠️ Missing recordEvaluations for IDs:', missingIds);
            console.log('⚠️ Adding default evaluations for missing records');
            
            // Add default evaluations for missing records
            // If overall status is "passed", default missing records to "passed"
            // If overall status is "failed", default to match overall status logic
            const defaultStatus = args.status === 'passed' ? 'passed' : 'unknown';
            missingIds.forEach(missingId => {
              providedEvaluations.push({
                recordId: Number(missingId),
                status: defaultStatus,
                reason: `No evaluation provided by LLM. Overall status: ${args.status}.`
              });
            });
          }
          
          // Normalize all recordIds to numbers for consistency
          const normalizedEvaluations = providedEvaluations.map(e => ({
            ...e,
            recordId: Number(e.recordId)
          }));
          
          console.log('✅ Final recordEvaluations:', normalizedEvaluations.length, 'entries');
          console.log('✅ Final recordEvaluations:', JSON.stringify(normalizedEvaluations, null, 2));
          
          return {
            success: true,
            analysis: args.reasoning,
            status: args.status,
            summary: args.summary,
            recordEvaluations: normalizedEvaluations, // Normalized per-record status evaluations
            tokensUsed: response.usage?.total_tokens || 0
          };
        }
      }

      // Fallback if no tool call
      return {
        success: true,
        analysis: message.content || 'Analysis completed',
        status: 'unknown',
        acceptance_criteria: acceptanceCriteria,
        tokensUsed: response.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error('❌ LLM analysis failed:', error);
      return {
        success: false,
        analysis: 'Analysis failed: ' + error.message,
        status: 'unknown',
        acceptance_criteria: acceptanceCriteria,
        tokensUsed: 0
      };
    }
  }
}

