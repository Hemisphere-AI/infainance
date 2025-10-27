#!/usr/bin/env node

/**
 * Production-like Test for Odoo Integration
 * This tests the exact same flow as production Netlify Functions
 */

import { createClient } from '@supabase/supabase-js';

// Use environment variables (same as Netlify Functions)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  console.error('');
  console.error('Please set these in your .env file or run with:');
  console.error('VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node test-production-flow.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProductionFlow() {
  try {
    console.log('🧪 Testing Production-like Odoo Integration');
    console.log('==========================================');
    console.log('');
    
    // Step 1: Get organization integration (same as Netlify Function)
    const organizationId = '9a4880df-ba32-4291-bd72-2b13dad95f20';
    console.log('1️⃣ Fetching organization integration...');
    
    const { data: integrations, error } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_name', 'odoo')
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('❌ Error fetching integrations:', error);
      return;
    }
    
    if (!integrations) {
      console.error('❌ No integration found');
      return;
    }
    
    console.log('✅ Found integration:');
    console.log(`   Odoo URL: ${integrations.odoo_url}`);
    console.log(`   Database: ${integrations.odoo_db}`);
    console.log(`   Username: ${integrations.odoo_username}`);
    console.log(`   Has API Key: ${integrations.api_key ? 'Yes' : 'No'}`);
    console.log('');
    
    // Step 2: Test authentication (same as production)
    console.log('2️⃣ Testing Odoo authentication...');
    console.log('🔍 Original Odoo URL:', integrations.odoo_url);
    const xmlrpcUrl = `${integrations.odoo_url}/xmlrpc/2/object`;
    const authUrl = xmlrpcUrl.replace('/xmlrpc/2/object', '/xmlrpc/2/common');
    console.log('🔍 XML-RPC URL:', xmlrpcUrl);
    console.log('🔍 Auth URL:', authUrl);
    
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
    <param><value><string>${integrations.odoo_db}</string></value></param>
    <param><value><string>${integrations.odoo_username}</string></value></param>
    <param><value><string>${integrations.api_key}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`,
      signal: AbortSignal.timeout(3000)
    });
    
    if (!authResponse.ok) {
      console.error(`❌ Auth HTTP ${authResponse.status}: ${authResponse.statusText}`);
      const errorBody = await authResponse.text();
      console.error('❌ Auth error response:', errorBody);
      return;
    }
    
    const authXml = await authResponse.text();
    console.log('✅ Auth response received');
    
    // Parse UID
    const uidMatch = authXml.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/);
    if (!uidMatch) {
      console.error('❌ Failed to parse UID from auth response');
      console.error('Auth response:', authXml);
      return;
    }
    
    const uid = parseInt(uidMatch[1]);
    console.log(`✅ Authentication successful, UID: ${uid}`);
    console.log('');
    
    // Step 3: Test search query (same as production)
    console.log('3️⃣ Testing search query...');
    const searchUrl = integrations.odoo_url + '/xmlrpc/2/object';
    
    // Use the exact query from your logs
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'User-Agent': 'Netlify-Function/1.0'
      },
      body: `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${integrations.odoo_db}</string></value></param>
    <param><value><i4>${uid}</i4></value></param>
    <param><value><string>${integrations.api_key}</string></value></param>
    <param><value><string>account.move.line</string></value></param>
    <param><value><string>search</string></value></param>
    <param><value><array><data><value><array><data>
      <value><array><data>
        <value><string>account_id.code</string></value>
        <value><string>in</string></value>
        <value><array><data>
          <value><string>480500</string></value>
          <value><string>481000</string></value>
          <value><string>482000</string></value>
          <value><string>483000</string></value>
          <value><string>484000</string></value>
        </data></array></value>
      </data></array></value>
      <value><array><data>
        <value><string>move_id.state</string></value>
        <value><string>=</string></value>
        <value><string>posted</string></value>
      </data></array></value>
    </data></array></value></data></array></value></param>
    <param><value><struct><member><name>limit</name><value><i4>50</i4></value></member></struct></value></param>
  </params>
</methodCall>`,
      signal: AbortSignal.timeout(5000)
    });
    
    if (!searchResponse.ok) {
      console.error(`❌ Search HTTP ${searchResponse.status}: ${searchResponse.statusText}`);
      return;
    }
    
    const searchXml = await searchResponse.text();
    console.log('✅ Search response received');
    console.log('🔍 Search response length:', searchXml.length);
    console.log('🔍 Search response preview:', searchXml.substring(0, 300) + '...');
    
    // Parse search results
    const idMatches = searchXml.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/g);
    if (idMatches) {
      const recordIds = idMatches.map(match => {
        const idMatch = match.match(/<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/);
        return idMatch ? parseInt(idMatch[1]) : null;
      }).filter(id => id !== null);
      
      console.log(`✅ Found ${recordIds.length} record IDs:`, recordIds);
      
      if (recordIds.length > 0) {
        console.log('🎉 SUCCESS: Records found! This should match your local results.');
      } else {
        console.log('⚠️  No records found - this might indicate a query issue.');
      }
    } else {
      console.log('❌ Failed to parse search results');
      console.log('Full search response:', searchXml);
    }
    
    console.log('');
    console.log('🎯 TEST COMPLETE');
    console.log('===============');
    console.log('This test uses the exact same:');
    console.log('- Organization integration from Supabase');
    console.log('- Authentication flow');
    console.log('- Search query structure');
    console.log('- XML parsing logic');
    console.log('as your production Netlify Function.');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the test
testProductionFlow();
