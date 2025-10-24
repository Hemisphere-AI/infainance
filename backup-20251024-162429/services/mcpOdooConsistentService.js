/* eslint-env node */
// MCP Odoo Consistent Service - Implements the consistency playbook for reliable queries
// Based on the MCP server recommendations for stable, repeatable Odoo queries

import MCPOdooService from './mcpOdooService.js';

class MCPOdooConsistentService {
  constructor(customConfig = null) {
    this.odooService = new MCPOdooService(customConfig);
    this.initialized = false;
    this.customConfig = customConfig;
    
    // Consistency configuration
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 5000,
      batchSize: 1000,
      logLevel: 'info'
    };
  }

  async initialize() {
    try {
      console.log('🔧 Initializing MCP Odoo Consistent Service...');
      const success = await this.odooService.initialize();
      if (!success) {
        throw new Error('Failed to initialize Odoo service');
      }
      this.initialized = true;
      console.log('✅ MCP Odoo Consistent Service initialized');
      return true;
    } catch (error) {
      console.error('❌ MCP Odoo Consistent Service initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Get model information to validate fields before querying
   * Implements: odoo://model/{model}
   */
  async getModelInfo(modelName) {
    if (!this.initialized) {
      throw new Error('MCP Odoo Consistent Service not initialized');
    }

    try {
      const result = await this.odooService.xmlRpcCall(
        modelName,
        'fields_get',
        [],
        {}
      );

      return {
        success: true,
        model: modelName,
        fields: result || {},
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Failed to get model info for ${modelName}:`, error.message);
      return {
        success: false,
        model: modelName,
        error: error.message,
        fields: {},
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * List all available models
   * Implements: odoo://models
   */
  async listModels() {
    if (!this.initialized) {
      throw new Error('MCP Odoo Consistent Service not initialized');
    }

    try {
      const result = await this.odooService.xmlRpcCall(
        'ir.model',
        'search_read',
        [[]],
        { fields: ['model', 'name'], limit: 1000 }
      );

      return {
        success: true,
        models: result || [],
        count: result ? result.length : 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to list models:', error.message);
      return {
        success: false,
        models: [],
        count: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Search records with consistent domain and field selection
   * Implements the consistency playbook for reliable queries
   */
  async searchRecordsConsistent(modelName, domain = [], fields = [], options = {}) {
    if (!this.initialized) {
      throw new Error('MCP Odoo Consistent Service not initialized');
    }

    // Validate model exists first
    const modelInfo = await this.getModelInfo(modelName);
    if (!modelInfo.success) {
      return {
        success: false,
        error: `Model ${modelName} not found or inaccessible`,
        records: [],
        count: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Validate fields exist in the model
    const invalidFields = fields.filter(field => !modelInfo.fields[field]);
    if (invalidFields.length > 0) {
      return {
        success: false,
        error: `Invalid fields for model ${modelName}: ${invalidFields.join(', ')}`,
        records: [],
        count: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Apply consistency playbook defaults
    const consistentOptions = {
      limit: options.limit || 1000,
      order: options.order || 'id asc',
      ...options
    };

    try {
      const result = await this.odooService.xmlRpcCall(
        modelName,
        'search_read',
        [domain],
        {
          fields: fields,
          limit: consistentOptions.limit,
          order: consistentOptions.order
        }
      );

      // Post-process for consistency
      const normalizedRecords = this.normalizeRecords(result || [], fields);

      return {
        success: true,
        model: modelName,
        domain: domain,
        fields: fields,
        records: normalizedRecords,
        count: normalizedRecords.length,
        options: consistentOptions,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Search failed for ${modelName}:`, error.message);
      return {
        success: false,
        model: modelName,
        domain: domain,
        fields: fields,
        error: error.message,
        records: [],
        count: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute the canonical Dutch rule query with consistency
   * Domain: line_ids.account_id.code in [480500,481000,482000,483000,484000] + move_type=in_invoice + state=posted
   */
  async executeDutchRuleQuery() {
    const canonicalDomain = [
      ["line_ids.account_id.code", "in", ["480500", "481000", "482000", "483000", "484000"]],
      ["move_type", "=", "in_invoice"],
      ["state", "=", "posted"]
    ];

    const canonicalFields = ["id", "name", "move_type", "date", "partner_id", "line_ids"];

    return await this.searchRecordsConsistent(
      "account.move",
      canonicalDomain,
      canonicalFields,
      { limit: 1000, order: "id asc" }
    );
  }

  /**
   * Execute two-step query for detailed line information
   * Step 1: Get move headers
   * Step 2: Get line items for those moves
   */
  async executeTwoStepQuery(accountCodes = ["480500", "481000", "482000", "483000", "484000"]) {
    // Step 1: Get move headers
    const moveDomain = [
      ["line_ids.account_id.code", "in", accountCodes],
      ["move_type", "=", "in_invoice"],
      ["state", "=", "posted"]
    ];

    const moveFields = ["id", "name", "move_type", "date", "partner_id"];
    
    const moveResult = await this.searchRecordsConsistent(
      "account.move",
      moveDomain,
      moveFields,
      { limit: 1000, order: "id asc" }
    );

    if (!moveResult.success || moveResult.count === 0) {
      return {
        success: true,
        moves: [],
        lineItems: [],
        totalMoves: 0,
        totalLineItems: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Step 2: Get line items for those moves
    const moveIds = moveResult.records.map(record => record.id);
    const lineDomain = [
      ["move_id", "in", moveIds],
      ["account_id.code", "in", accountCodes]
    ];

    const lineFields = ["id", "move_id", "account_id", "account_id.code", "debit", "credit", "balance"];

    const lineResult = await this.searchRecordsConsistent(
      "account.move.line",
      lineDomain,
      lineFields,
      { limit: 1000, order: "id asc" }
    );

    return {
      success: true,
      moves: moveResult.records,
      lineItems: lineResult.records,
      totalMoves: moveResult.count,
      totalLineItems: lineResult.count,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Normalize records for consistent output
   * Ensures same projection, ordering, and shape every run
   */
  normalizeRecords(records, fields) {
    if (!Array.isArray(records)) {
      return [];
    }

    return records
      .map(record => {
        const normalized = {};
        
        // Copy all requested fields
        fields.forEach(field => {
          if (record.hasOwnProperty(field)) {
            normalized[field] = record[field];
          }
        });

        // Normalize relational fields to consistent shape
        if (normalized.partner_id && Array.isArray(normalized.partner_id)) {
          normalized.partner_id = [normalized.partner_id[0], normalized.partner_id[1]];
        }

        if (normalized.account_id && Array.isArray(normalized.account_id)) {
          normalized.account_id = [normalized.account_id[0], normalized.account_id[1]];
        }

        return normalized;
      })
      .sort((a, b) => a.id - b.id); // Sort by ID for consistency
  }

  /**
   * Validate query spec against the consistency playbook
   */
  validateQuerySpec(querySpec) {
    const errors = [];

    // Check required fields
    if (!querySpec.model) {
      errors.push('Missing model');
    }

    if (!Array.isArray(querySpec.domain)) {
      errors.push('Domain must be an array of triplets');
    } else {
      // Validate domain format
      querySpec.domain.forEach((filter, index) => {
        if (!Array.isArray(filter) || filter.length !== 3) {
          errors.push(`Domain filter ${index} must be [field, operator, value]`);
        }
      });
    }

    if (!Array.isArray(querySpec.fields)) {
      errors.push('Fields must be an array');
    }

    if (querySpec.limit && (typeof querySpec.limit !== 'number' || querySpec.limit <= 0 || querySpec.limit > 1000)) {
      errors.push('Limit must be a positive number <= 1000');
    }

    if (querySpec.order && typeof querySpec.order !== 'string') {
      errors.push('Order must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Execute query with full validation and consistency
   */
  async executeValidatedQuery(querySpec) {
    // Validate query spec
    const validation = this.validateQuerySpec(querySpec);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid query spec: ${validation.errors.join(', ')}`,
        records: [],
        count: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Execute with consistency options
    return await this.searchRecordsConsistent(
      querySpec.model,
      querySpec.domain,
      querySpec.fields,
      {
        limit: querySpec.limit || 1000,
        order: querySpec.order || 'id asc'
      }
    );
  }
}

export default MCPOdooConsistentService;
