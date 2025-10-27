#!/usr/bin/env node

/**
 * Netlify Environment Diagnostic
 * This script tests the exact same flow as Netlify Functions
 */

import { createClient } from '@supabase/supabase-js';

// Use the same environment variables as Netlify
const supabaseUrl = 'https://ujwmhwlabqozhyexkkui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqd21od2xhYnFvemh5ZXhra3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTExODgsImV4cCI6MjA3NDk2NzE4OH0.zJTzPTFQxL35S1na-7O50JKqAilis0pEK_WgTOQa2eU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNetlifyFlow() {
  try {
    console.log('🔍 Testing Netlify Environment Flow');
    console.log('==================================');
    console.log('');
    
    // Test 1: Check Supabase connection
    console.log('1️⃣ Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('organization_integrations')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Supabase connection failed:', testError);
      return;
    }
    console.log('✅ Supabase connection successful');
    console.log('');
    
    // Test 2: Check all organization integrations
    console.log('2️⃣ Checking all organization integrations...');
    const { data: allIntegrations, error: allError } = await supabase
      .from('organization_integrations')
      .select('*');
    
    if (allError) {
      console.error('❌ Error fetching all integrations:', allError);
      return;
    }
    
    console.log(`📊 Found ${allIntegrations.length} integration(s) total:`);
    allIntegrations.forEach((integration, index) => {
      console.log(`  ${index + 1}. Organization: ${integration.organization_id}`);
      console.log(`     Integration: ${integration.integration_name}`);
      console.log(`     Odoo URL: ${integration.odoo_url}`);
      console.log(`     Active: ${integration.is_active}`);
      console.log('');
    });
    
    // Test 3: Check Odoo integrations specifically
    console.log('3️⃣ Checking Odoo integrations...');
    const { data: odooIntegrations, error: odooError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('integration_name', 'odoo')
      .eq('is_active', true);
    
    if (odooError) {
      console.error('❌ Error fetching Odoo integrations:', odooError);
      return;
    }
    
    console.log(`📊 Found ${odooIntegrations.length} active Odoo integration(s):`);
    odooIntegrations.forEach((integration, index) => {
      console.log(`  ${index + 1}. Organization ID: ${integration.organization_id}`);
      console.log(`     Odoo URL: ${integration.odoo_url}`);
      console.log(`     Database: ${integration.odoo_db}`);
      console.log(`     Username: ${integration.odoo_username}`);
      console.log(`     Has API Key: ${integration.api_key ? 'Yes' : 'No'}`);
      
      // Check for placeholder values
      const hasPlaceholders = 
        integration.odoo_url?.includes('your_odoo_url_here') ||
        integration.odoo_url?.includes('placeholder') ||
        integration.odoo_db?.includes('your-database-name') ||
        integration.odoo_username?.includes('your-username') ||
        integration.api_key?.includes('your-api-key');
      
      if (hasPlaceholders) {
        console.log('     ⚠️  CONTAINS PLACEHOLDER VALUES');
      } else {
        console.log('     ✅ Configuration looks good');
      }
      console.log('');
    });
    
    // Test 4: Simulate the exact Netlify Function query
    console.log('4️⃣ Simulating Netlify Function query...');
    console.log('   (This is the exact query used in NetlifyOdooAiAgent.js)');
    
    // We need to test with a real organization ID
    // Let's try to find the organization ID for thomas@hemisphere.ai
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, email')
      .ilike('email', '%thomas%hemisphere%');
    
    if (orgError) {
      console.error('❌ Error fetching organizations:', orgError);
      return;
    }
    
    console.log(`📊 Found ${organizations.length} organization(s) with 'thomas' and 'hemisphere':`);
    organizations.forEach((org, index) => {
      console.log(`  ${index + 1}. ID: ${org.id}, Name: ${org.name}, Email: ${org.email}`);
    });
    
    if (organizations.length > 0) {
      const testOrgId = organizations[0].id;
      console.log(`\n🧪 Testing with organization ID: ${testOrgId}`);
      
      const { data: testIntegration, error: testIntError } = await supabase
        .from('organization_integrations')
        .select('*')
        .eq('organization_id', testOrgId)
        .eq('integration_name', 'odoo')
        .eq('is_active', true)
        .single();
      
      if (testIntError) {
        console.error('❌ Error fetching test integration:', testIntError);
        console.log('   This might be why it fails in Netlify!');
      } else if (testIntegration) {
        console.log('✅ Found integration for test organization:');
        console.log(`   Odoo URL: ${testIntegration.odoo_url}`);
        console.log(`   Database: ${testIntegration.odoo_db}`);
        console.log(`   Username: ${testIntegration.odoo_username}`);
        console.log(`   Has API Key: ${testIntegration.api_key ? 'Yes' : 'No'}`);
        
        // Check for placeholder values
        const hasPlaceholders = 
          testIntegration.odoo_url?.includes('your_odoo_url_here') ||
          testIntegration.odoo_url?.includes('placeholder') ||
          testIntegration.odoo_db?.includes('your-database-name') ||
          testIntegration.odoo_username?.includes('your-username') ||
          testIntegration.api_key?.includes('your-api-key');
        
        if (hasPlaceholders) {
          console.log('   ⚠️  CONTAINS PLACEHOLDER VALUES - THIS IS THE PROBLEM!');
        } else {
          console.log('   ✅ Configuration looks good');
        }
      } else {
        console.log('⚠️  No integration found for test organization');
      }
    }
    
    console.log('\n🎯 DIAGNOSIS COMPLETE');
    console.log('=====================');
    
  } catch (error) {
    console.error('💥 Error during diagnosis:', error.message);
  }
}

// Run the diagnosis
testNetlifyFlow();
