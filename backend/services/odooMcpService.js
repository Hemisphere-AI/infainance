// Odoo MCP Service - Real integration with Odoo XML-RPC
import fetch from 'node-fetch';

class OdooMcpService {
  constructor() {
    this.url = process.env.ODOO_URL;
    this.db = process.env.ODOO_DB;
    this.apiKey = process.env.ODOO_API_KEY;
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
    <param><value><string>admin</string></value></param>
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
    return this.parseXmlRpcResponse(xmlResponse);
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
    return this.parseXmlRpcResponse(xmlResponse);
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

  parseXmlRpcResponse(xmlResponse) {
    // Simple XML parsing for the response
    const match = xmlResponse.match(/<value>(.*?)<\/value>/s);
    if (match) {
      const valueXml = match[1];
      
      // Parse different value types
      if (valueXml.includes('<string>')) {
        const stringMatch = valueXml.match(/<string><!\[CDATA\[(.*?)\]\]><\/string>/s);
        return stringMatch ? stringMatch[1] : null;
      } else if (valueXml.includes('<double>')) {
        const doubleMatch = valueXml.match(/<double>(.*?)<\/double>/);
        return doubleMatch ? parseFloat(doubleMatch[1]) : null;
      } else if (valueXml.includes('<boolean>')) {
        const boolMatch = valueXml.match(/<boolean>(.*?)<\/boolean>/);
        return boolMatch ? boolMatch[1] === '1' : false;
      } else if (valueXml.includes('<array>')) {
        // Parse array - simplified
        const arrayMatches = valueXml.match(/<value>(.*?)<\/value>/gs);
        if (arrayMatches) {
          return arrayMatches.map(match => {
            const innerValue = match.replace(/<\/?value>/g, '');
            return this.parseXmlValue(innerValue);
          });
        }
      }
    }
    
    // Fallback: try to extract any meaningful data
    const stringMatch = xmlResponse.match(/<string><!\[CDATA\[(.*?)\]\]><\/string>/);
    return stringMatch ? stringMatch[1] : null;
  }

  parseXmlValue(valueXml) {
    if (valueXml.includes('<string>')) {
      const match = valueXml.match(/<string><!\[CDATA\[(.*?)\]\]><\/string>/s);
      return match ? match[1] : null;
    } else if (valueXml.includes('<double>')) {
      const match = valueXml.match(/<double>(.*?)<\/double>/);
      return match ? parseFloat(match[1]) : null;
    } else if (valueXml.includes('<boolean>')) {
      const match = valueXml.match(/<boolean>(.*?)<\/boolean>/);
      return match ? match[1] === '1' : false;
    }
    return null;
  }

  async executeQueries(queries) {
    console.log('🔍 Executing Odoo queries:', queries.length);
    
    try {
      const results = [];
      
      for (const query of queries) {
        console.log(`🔧 Executing query: ${query.query_name}`);
        try {
          // Execute real Odoo query
          const data = await this.xmlRpcCall(
            query.table,
            'search_read',
            [query.filters],
            { fields: query.fields }
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


}

export default OdooMcpService;
