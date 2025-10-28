#!/usr/bin/env node

/**
 * Test Local Query Generation
 * This script tests what query the AI generates locally
 */

import { OdooAiAgent } from './src/services/OdooAiAgent.js';

async function testLocalQuery() {
  console.log('🧪 Testing Local Query Generation');
  console.log('=================================\n');

  try {
    // Initialize with the same config as production
    const agent = new OdooAiAgent();
    
    const customConfig = {
      url: process.env.ODOO_URL || 'https://your-odoo-url.com',
      db: process.env.ODOO_DB || 'your-database',
      username: process.env.ODOO_USERNAME || 'your-username',
      apiKey: process.env.ODOO_API_KEY || 'your-api-key'
    };

    await agent.initialize(customConfig);

    console.log('📋 Testing with same config as production:');
    console.log('   URL:', customConfig.url);
    console.log('   DB:', customConfig.db);
    console.log('   Username:', customConfig.username);
    console.log('   API Key:', customConfig.apiKey.substring(0, 20) + '...\n');

    // Test the same check as production
    const checkDescription = `Er zijn geen facturen geboekt op een van onderstaande grootboekrekeningen

480500	Goodwill	 Afschrijving
481000	Gebouwen / verbouwingen Afschrijving
482000	Machine Afschrijving
483000	Inventaris Afschrijving
484000	Vervoermiddelen`;

    const result = await agent.executeCheck(
      checkDescription,
      'inkoop 48 grootboek',
      '0 records.'
    );

    console.log('📊 Local Result:');
    console.log('   Success:', result.success);
    console.log('   Count:', result.count);
    console.log('   Records found:', result.records ? result.records.length : 0);
    console.log('   Query model:', result.query?.model);
    console.log('   Query domain:', JSON.stringify(result.query?.domain, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLocalQuery();
