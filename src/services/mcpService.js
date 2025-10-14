// MCP Service for Odoo Integration
// This service handles communication with the Odoo MCP server

class MCPService {
  constructor() {
    this.baseUrl = 'http://localhost:3002'; // Backend server URL
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

  async analyzeCheck(description) {
    try {
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
