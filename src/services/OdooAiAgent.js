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
      // For Netlify Functions, we'll use direct Odoo API calls instead of MCP services
      // since the backend services were removed in the simplified architecture
      
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
        return;
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
    } catch (error) {
      console.error('❌ Odoo configuration initialization failed:', error);
      throw error;
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

## Critical Rules:
- Domain must be array of triplets ONLY: [field, operator, value]
- NO OR operators ("|") - use simple AND filters only

Return ONLY the JSON object, no other text.`;

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
        odooDb: this.odooConfig?.db || null,
        odooUrl: this.odooConfig?.url || null,
      });
      const payloadHash = hashString(payloadToHash);

      console.log('🧪 LLM INPUT DIAGNOSTICS:');
      console.log('   Models count:', modelsSnapshot.length);
      console.log('   Models head:', modelsSnapshot.head.slice(0, 3).join(', '));
      console.log('   Odoo target:', `${this.odooConfig?.url} / ${this.odooConfig?.db}`);
      console.log('   LLM input hash:', payloadHash);
    } catch (diagErr) {
      console.warn('⚠️ Failed to emit LLM diagnostics:', diagErr?.message || diagErr);
    }

    const makeRequest = async (sysPrompt, usrMsg) => {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: usrMsg }
        ],
        temperature: 0,
        top_p: 1,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });
      return response.choices[0].message.content.trim();
    };

    let content = await makeRequest(systemPrompt, userMessage);

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
      const limitValue = 50; // Match test-production-flow.js exactly
      
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
      
      // Create a detailed analysis of the results
      const analysisData = {
        checkTitle: title,
        checkDescription: description,
        queryModel: queryResult.model,
        recordCount: count,
        records: records.slice(0, 5), // Show first 5 records for context
        acceptanceCriteria: acceptanceCriteria || 'No acceptance criteria defined'
      };

      const systemPrompt = `You are an expert bookkeeping analyst. Your task is to analyze check results and determine the status based on the acceptance criteria.

## Your Task:
1. Analyze the check results and acceptance criteria
2. Compare the analysis with the acceptance criteria
3. Use the 'conclude' tool to provide your final assessment

## Status Determination Rules:
- **passed**: The analysis confirms the acceptance criteria (e.g., "9 records found" matches "There are 9 records found")
- **failed**: The analysis contradicts the acceptance criteria (e.g., found 5 but expected 9)
- **unknown**: The analysis is inconclusive or insufficient data
- **warning**: The analysis partially meets criteria but has concerns

## Important:
- You MUST use the 'conclude' tool to provide your final answer
- Compare the actual results with the acceptance criteria
- Be precise in your status determination

## Conclude Tool Usage:
When using the conclude tool, you MUST determine the status based on the analysis:
- **passed**: The check meets all acceptance criteria
- **failed**: The check does not meet the acceptance criteria or critical issues were found
- **unknown**: The analysis is inconclusive or insufficient data was available
- **warning**: The check partially meets criteria but has concerns or minor issues

The status will automatically update the check's visual indicator:
- passed = blue checkmark
- failed = red cross  
- unknown = yellow question mark (orange)
- warning = orange warning icon
- open = blue open box (unchecked default)`;

      const userMessage = `Check Analysis Data:
${JSON.stringify(analysisData, null, 2)}

Please analyze these results and use the 'conclude' tool to determine the status based on the acceptance criteria.`;

      // Define tools inline for analysis
      const tools = [
        {
          type: "function",
          function: {
            name: "conclude",
            description: "Conclude the analysis with a final status determination",
            parameters: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  enum: ["passed", "failed", "unknown", "warning"],
                  description: "The final status of the check"
                },
                reasoning: {
                  type: "string",
                  description: "Detailed reasoning for the status determination"
                },
                summary: {
                  type: "string", 
                  description: "Brief summary of the analysis"
                }
              },
              required: ["status", "reasoning", "summary"]
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
          
          return {
            success: true,
            analysis: args.reasoning,
            status: args.status,
            summary: args.summary,
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

