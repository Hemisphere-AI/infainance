#!/usr/bin/env node

/**
 * Supabase Query Debug
 * This tests the exact same query used in NetlifyOdooAiAgent.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ujwmhwlabqozhyexkkui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqd21od2xhYnFvemh5ZXhra3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTExODgsImV4cCI6MjA3NDk2NzE4OH0.zJTzPTFQxL35S1na-7O50JKqAilis0pEK_WgTOQa2eU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSupabaseQuery() {
  try {
    console.log('🔍 Debugging Supabase Query');
    console.log('==========================');
    console.log('');
    
    const organizationId = '9a4880df-ba32-4291-bd72-2b13dad95f20';
    console.log(`Testing with organization ID: ${organizationId}`);
    console.log('');
    
    // Test 1: Check if the record exists at all
    console.log('1️⃣ Checking if organization_integrations record exists...');
    const { data: allRecords, error: allError } = await supabase
      .from('organization_integrations')
      .select('*');
    
    if (allError) {
      console.error('❌ Error fetching all records:', allError);
      return;
    }
    
    console.log(`📊 Found ${allRecords.length} total records:`);
    allRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. Organization: ${record.organization_id}`);
      console.log(`     Integration: ${record.integration_name}`);
      console.log(`     Active: ${record.is_active}`);
      console.log(`     Odoo URL: ${record.odoo_url}`);
      console.log('');
    });
    
    // Test 2: Test the exact query from NetlifyOdooAiAgent.js
    console.log('2️⃣ Testing exact NetlifyOdooAiAgent query...');
    const { data: integrations, error } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_name', 'odoo')
      .eq('is_active', true)
      .single();
    
    console.log('Query result:');
    if (error) {
      console.error('❌ Error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
    } else if (integrations) {
      console.log('✅ Found integration:');
      console.log(`   Organization ID: ${integrations.organization_id}`);
      console.log(`   Integration Name: ${integrations.integration_name}`);
      console.log(`   Is Active: ${integrations.is_active}`);
      console.log(`   Odoo URL: ${integrations.odoo_url}`);
      console.log(`   Odoo DB: ${integrations.odoo_db}`);
      console.log(`   Username: ${integrations.odoo_username}`);
      console.log(`   Has API Key: ${integrations.api_key ? 'Yes' : 'No'}`);
    } else {
      console.log('⚠️  No integration found (integrations is null)');
    }
    
    console.log('');
    
    // Test 3: Test individual conditions
    console.log('3️⃣ Testing individual query conditions...');
    
    // Test organization_id condition
    const { data: orgTest, error: orgError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', organizationId);
    
    console.log(`Organization ID filter: ${orgTest?.length || 0} records`);
    if (orgError) console.error('Org ID error:', orgError);
    
    // Test integration_name condition
    const { data: intTest, error: intError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('integration_name', 'odoo');
    
    console.log(`Integration name filter: ${intTest?.length || 0} records`);
    if (intError) console.error('Integration name error:', intError);
    
    // Test is_active condition
    const { data: activeTest, error: activeError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('is_active', true);
    
    console.log(`Is active filter: ${activeTest?.length || 0} records`);
    if (activeError) console.error('Is active error:', activeError);
    
    console.log('');
    console.log('🎯 DIAGNOSIS:');
    console.log('=============');
    if (error) {
      console.log('The Supabase query is failing with an error.');
      console.log('This explains why the Netlify Function falls back to environment variables.');
    } else if (!integrations) {
      console.log('The Supabase query returns null (no records found).');
      console.log('This explains why the Netlify Function falls back to environment variables.');
    } else {
      console.log('The Supabase query should work correctly.');
      console.log('The issue might be elsewhere in the code.');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

debugSupabaseQuery();
