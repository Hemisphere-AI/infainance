// MCP Service for Odoo Integration
// This service handles communication with the Odoo MCP server

class MCPService {
  constructor() {
    // Use backend server for full Odoo AI Agent functionality
    this.baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
    this.odooConfig = null;
  }

  async initialize() {
    try {
      // Load Odoo configuration from environment
      const response = await fetch(`${this.baseUrl}/api/odoo/config`);
      if (response.ok) {
        this.odooConfig = await response.json();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize MCP service:', error);
      return false;
    }
  }

  // Test MCP connection
  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/odoo/test`);
      if (response.ok) {
        const result = await response.json();
        console.log('🔍 MCP Connection Test:', result);
        return result;
      }
      throw new Error(`Connection test failed: ${response.statusText}`);
    } catch (error) {
      console.error('MCP connection test failed:', error);
      throw error;
    }
  }

  // List available MCP resources
  async listResources() {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/resources`);
      if (!response.ok) {
        throw new Error(`Failed to list resources: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to list MCP resources:', error);
      throw error;
    }
  }

  // List available MCP tools
  async listTools() {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/tools`);
      if (!response.ok) {
        throw new Error(`Failed to list tools: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to list MCP tools:', error);
      throw error;
    }
  }

  // List available Odoo models
  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/models`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to list models:', error);
      throw error;
    }
  }

  // Get model information
  async getModelInfo(modelName) {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/model/${modelName}`);
      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to get model info for ${modelName}:`, error);
      throw error;
    }
  }

  // Search records
  async searchRecords(model, domain = [], fields = [], limit = 100) {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          domain,
          fields,
          limit
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MCP search failed:', error);
      throw error;
    }
  }

  // Get single record
  async getRecord(model, id, fields = []) {
    try {
      const fieldsParam = fields.length > 0 ? `?fields=${fields.join(',')}` : '';
      const response = await fetch(`${this.baseUrl}/api/mcp/record/${model}/${id}${fieldsParam}`);
      if (!response.ok) {
        throw new Error(`Failed to get record: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to get record ${id} from ${model}:`, error);
      throw error;
    }
  }

  // Execute method
  async executeMethod(model, method, args = [], kwargs = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/execute-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          method,
          args,
          kwargs
        })
      });

      if (!response.ok) {
        throw new Error(`Method execution failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MCP method execution failed:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async analyzeCheck(description) {
    try {
      // This method is kept for backward compatibility
      // In the future, this could be enhanced to use the new MCP tools
      const response = await fetch(`${this.baseUrl}/api/odoo/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🔍 MCP Analysis Result:', result);
      return result;
    } catch (error) {
      console.error('MCP analysis failed:', error);
      throw error;
    }
  }
}

export default MCPService;
