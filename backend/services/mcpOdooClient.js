// MCP Odoo Client - Custom implementation for Odoo integration
// This client provides MCP-like functionality for Odoo data access

import MCPOdooService from './mcpOdooService.js';

class MCPOdooClient {
  constructor() {
    this.odooService = null;
    this.initialized = false;
    
    // Observability & Safety Configuration
    this.config = {
      timeout: 30000,        // 30 second timeout for Odoo calls
      maxRetries: 3,         // Maximum retry attempts
      retryDelay: 1000,      // Initial retry delay (1 second)
      maxRetryDelay: 5000,   // Maximum retry delay (5 seconds)
      batchSize: 1000,       // Default batch size for large queries
      logLevel: 'info'       // Logging level: debug, info, warn, error
    };
  }

  async initialize() {
    try {
      this.log('info', 'Initializing MCP Odoo Client...');
      this.odooService = new MCPOdooService();
      this.initialized = await this.odooService.initialize();
      
      if (this.initialized) {
        this.log('info', 'MCP Odoo Client initialized successfully');
      } else {
        this.log('error', 'MCP Odoo Client initialization failed');
      }
      
      return this.initialized;
    } catch (error) {
      this.log('error', 'MCP Odoo Client initialization error', { error: error.message });
      return false;
    }
  }

  /**
   * Structured logging with context
   */
  log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    // const logEntry = {
    //   timestamp,
    //   level,
    //   service: 'MCPOdooClient',
    //   message,
    //   ...context
    // };

    // Console logging based on level
    switch (level) {
      case 'debug':
        if (this.config.logLevel === 'debug') {
          console.debug(`[${timestamp}] DEBUG: ${message}`, context);
        }
        break;
      case 'info':
        console.log(`[${timestamp}] INFO: ${message}`, context);
        break;
      case 'warn':
        console.warn(`[${timestamp}] WARN: ${message}`, context);
        break;
      case 'error':
        console.error(`[${timestamp}] ERROR: ${message}`, context);
        break;
    }

    // In production, you might want to send this to a logging service
    // this.sendToLoggingService(logEntry);
  }

  /**
   * Retry mechanism with exponential backoff
   */
  async withRetry(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.withTimeout(operation(), this.config.timeout);
        const duration = Date.now() - startTime;
        
        this.log('info', `Operation succeeded on attempt ${attempt}`, {
          ...context,
          attempt,
          duration
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        this.log('warn', `Operation failed on attempt ${attempt}`, {
          ...context,
          attempt,
          error: error.message,
          willRetry: attempt < this.config.maxRetries
        });
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.min(
            this.config.retryDelay * Math.pow(2, attempt - 1),
            this.config.maxRetryDelay
          );
          
          this.log('debug', `Retrying in ${delay}ms`, { ...context, attempt, delay });
          await this.sleep(delay);
        }
      }
    }
    
    this.log('error', 'Operation failed after all retries', {
      ...context,
      attempts: this.config.maxRetries,
      finalError: lastError.message
    });
    
    throw lastError;
  }

  /**
   * Timeout wrapper for promises
   */
  withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // MCP Resource: List all available models (dynamically fetched from Odoo)
  async listModels() {
    if (!this.initialized) {
      throw new Error('MCP Odoo Client not initialized');
    }

    const context = {
      operation: 'listModels'
    };

    this.log('info', 'Fetching available models from Odoo', context);

    return await this.withRetry(async () => {
      const startTime = Date.now();
      
      // Get all models from Odoo's ir.model
      const models = await this.odooService.xmlRpcCall(
        'ir.model',
        'search_read',
        [], // Get all models
        { 
          fields: ['model', 'name', 'info'], 
          limit: 1000,
          order: 'model'
        }
      );

      const duration = Date.now() - startTime;
      const modelCount = models ? models.length : 0;

      this.log('info', 'Models fetched successfully', {
        ...context,
        duration,
        modelCount
      });

      // Extract just the model names for backward compatibility
      const modelNames = models ? models.map(m => m.model) : [];

      return {
        success: true,
        models: modelNames,
        modelDetails: models || [], // Include full model info
        count: modelCount,
        duration,
        timestamp: new Date().toISOString()
      };
    }, context);
  }

  // MCP Resource: List accounting-related models only
  async listAccountingModels() {
    if (!this.initialized) {
      throw new Error('MCP Odoo Client not initialized');
    }

    const context = {
      operation: 'listAccountingModels'
    };

    this.log('info', 'Fetching accounting models from Odoo', context);

    return await this.withRetry(async () => {
      const startTime = Date.now();
      
      // Get all models first, then filter in JavaScript
      const allModels = await this.odooService.xmlRpcCall(
        'ir.model',
        'search_read',
        [], // Get all models
        { 
          fields: ['model', 'name', 'info'], 
          limit: 1000,
          order: 'model'
        }
      );

      const duration = Date.now() - startTime;
      
      if (!allModels || allModels.length === 0) {
        this.log('warn', 'No models found in Odoo', { ...context, duration });
        return {
          success: true,
          models: [],
          modelDetails: [],
          count: 0,
          duration,
          timestamp: new Date().toISOString()
        };
      }

      // Filter for accounting and business models
      const accountingKeywords = ['account', 'payment', 'invoice', 'journal', 'reconcile', 'tax'];
      const businessKeywords = ['partner', 'product', 'sale', 'purchase', 'employee', 'leave', 'stock', 'company'];
      
      const relevantModels = allModels.filter(model => {
        const modelName = model.model.toLowerCase();
        return accountingKeywords.some(keyword => modelName.includes(keyword)) ||
               businessKeywords.some(keyword => modelName.includes(keyword));
      });

      const modelCount = relevantModels.length;

      this.log('info', 'Accounting models filtered successfully', {
        ...context,
        duration,
        totalModels: allModels.length,
        filteredModels: modelCount
      });

      // Extract model names
      const modelNames = relevantModels.map(m => m.model);

      return {
        success: true,
        models: modelNames,
        modelDetails: relevantModels,
        count: modelCount,
        totalAvailable: allModels.length,
        duration,
        timestamp: new Date().toISOString()
      };
    }, context);
  }

  // MCP Resource: Get model metadata and fields
  async getModelInfo(modelName) {
    if (!this.initialized) {
      throw new Error('MCP Odoo Client not initialized');
    }

    try {
      // Get model fields using Odoo's fields_get method
      const fields = await this.odooService.xmlRpcCall(
        modelName,
        'fields_get',
        [],
        {}
      );

      // Get model info
      const modelInfo = await this.odooService.xmlRpcCall(
        'ir.model',
        'search_read',
        [['model', '=', modelName]],
        { fields: ['name', 'model', 'info', 'state'], limit: 1 }
      );

      return {
        success: true,
        model: modelName,
        fields: fields || {},
        info: modelInfo && modelInfo.length > 0 ? modelInfo[0] : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error getting model info for ${modelName}:`, error);
      return {
        success: false,
        error: error.message,
        model: modelName,
        timestamp: new Date().toISOString()
      };
    }
  }

  // MCP Resource: Search records with domain (enhanced with observability)
  async searchRecords(modelName, domain = [], fields = [], limit = 100) {
    if (!this.initialized) {
      throw new Error('MCP Odoo Client not initialized');
    }

    const context = {
      operation: 'searchRecords',
      model: modelName,
      domain: JSON.stringify(domain),
      fields: fields.join(','),
      limit
    };

    this.log('info', 'Starting search records operation', context);

    return await this.withRetry(async () => {
      const startTime = Date.now();
      
      // Optimize batching: use explicit fields and reasonable limits
      const optimizedLimit = Math.min(limit, this.config.batchSize);
      const optimizedFields = fields.length > 0 ? fields : ['id', 'name']; // Default fields
      
      const records = await this.odooService.xmlRpcCall(
        modelName,
        'search_read',
        [domain],
        { fields: optimizedFields, limit: optimizedLimit }
      );

      const duration = Date.now() - startTime;
      const recordCount = records ? records.length : 0;

      this.log('info', 'Search records completed', {
        ...context,
        duration,
        recordCount,
        optimizedLimit,
        optimizedFields: optimizedFields.join(',')
      });

      return {
        success: true,
        model: modelName,
        domain: domain,
        records: records || [],
        count: recordCount,
        fields: optimizedFields,
        limit: optimizedLimit,
        duration,
        timestamp: new Date().toISOString()
      };
    }, context);
  }

  // MCP Resource: Get single record by ID
  async getRecord(modelName, recordId, fields = []) {
    if (!this.initialized) {
      throw new Error('MCP Odoo Client not initialized');
    }

    try {
      const records = await this.odooService.xmlRpcCall(
        modelName,
        'read',
        [[recordId]],
        { fields: fields }
      );

      return {
        success: true,
        model: modelName,
        id: recordId,
        record: records && records.length > 0 ? records[0] : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error getting record ${recordId} from ${modelName}:`, error);
      return {
        success: false,
        error: error.message,
        model: modelName,
        id: recordId,
        record: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  // MCP Tool: Execute custom method
  async executeMethod(modelName, methodName, args = [], kwargs = {}) {
    if (!this.initialized) {
      throw new Error('MCP Odoo Client not initialized');
    }

    try {
      const result = await this.odooService.xmlRpcCall(
        modelName,
        methodName,
        args,
        kwargs
      );

      return {
        success: true,
        model: modelName,
        method: methodName,
        args: args,
        kwargs: kwargs,
        result: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error executing method ${methodName} on ${modelName}:`, error);
      return {
        success: false,
        error: error.message,
        model: modelName,
        method: methodName,
        args: args,
        kwargs: kwargs,
        result: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  // MCP Tool: Search employees by name
  async searchEmployees(name, limit = 10) {
    const domain = [['name', 'ilike', name]];
    const fields = ['name', 'work_email', 'department_id', 'job_id', 'active'];
    
    return await this.searchRecords('hr.employee', domain, fields, limit);
  }

  // MCP Tool: Search holidays/leave requests
  async searchHolidays(startDate, endDate, employeeId = null) {
    let domain = [
      ['date_from', '>=', startDate],
      ['date_to', '<=', endDate]
    ];
    
    if (employeeId) {
      domain.push(['employee_id', '=', employeeId]);
    }
    
    const fields = ['name', 'employee_id', 'date_from', 'date_to', 'state', 'holiday_status_id'];
    
    return await this.searchRecords('hr.leave', domain, fields, 100);
  }

  // Utility: Get available resources (MCP-style)
  async listResources() {
    return [
      {
        uri: 'odoo://models',
        name: 'Available Models',
        description: 'List of all available Odoo models'
      },
      {
        uri: 'odoo://model/{model_name}',
        name: 'Model Information',
        description: 'Get model metadata and field information'
      },
      {
        uri: 'odoo://search/{model}/{domain}',
        name: 'Search Records',
        description: 'Search records in a model with domain filters'
      },
      {
        uri: 'odoo://record/{model}/{id}',
        name: 'Get Record',
        description: 'Get a single record by ID'
      }
    ];
  }

  // Utility: Get available tools (MCP-style)
  async listTools() {
    return [
      {
        name: 'execute_method',
        description: 'Execute a method on an Odoo model',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'Model name' },
            method: { type: 'string', description: 'Method name' },
            args: { type: 'array', description: 'Method arguments' },
            kwargs: { type: 'object', description: 'Method keyword arguments' }
          },
          required: ['model', 'method']
        }
      },
      {
        name: 'search_employee',
        description: 'Search employees by name',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Employee name to search' },
            limit: { type: 'number', description: 'Maximum number of results' }
          },
          required: ['name']
        }
      },
      {
        name: 'search_holidays',
        description: 'Search holiday/leave requests',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
            employee_id: { type: 'number', description: 'Employee ID (optional)' }
          },
          required: ['start_date', 'end_date']
        }
      }
    ];
  }
}

export default MCPOdooClient;
