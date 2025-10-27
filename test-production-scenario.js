#!/usr/bin/env node

/**
 * Production Simulation Test
 * This simulates the exact production call to see what organization ID is being used
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ujwmhwlabqozhyexkkui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqd21od2xhYnFvemh5ZXhra3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTExODgsImV4cCI6MjA3NDk2NzE4OH0.zJTzPTFQxL35S1na-7O50JKqAilis0pEK_WgTOQa2eU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProductionScenario() {
  try {
    console.log('🧪 Testing Production Scenario');
    console.log('==============================');
    console.log('');
    
    // Test with the correct organization ID
    const correctOrgId = '9a4880df-ba32-4291-bd72-2b13dad95f20';
    console.log(`1️⃣ Testing with CORRECT organization ID: ${correctOrgId}`);
    
    const { data: correctIntegration, error: correctError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', correctOrgId)
      .eq('integration_name', 'odoo')
      .eq('is_active', true)
      .single();
    
    if (correctError) {
      console.error('❌ Error with correct org ID:', correctError);
    } else if (correctIntegration) {
      console.log('✅ Found integration with correct org ID:');
      console.log(`   Odoo URL: ${correctIntegration.odoo_url}`);
      console.log(`   Database: ${correctIntegration.odoo_db}`);
      console.log(`   Username: ${correctIntegration.odoo_username}`);
      console.log(`   Has API Key: ${correctIntegration.api_key ? 'Yes' : 'No'}`);
    }
    
    console.log('');
    
    // Test with some common wrong organization IDs
    const wrongOrgIds = [
      'test-org-123',
      'thomas-org',
      'hemisphere-org',
      'default-org',
      null,
      undefined,
      ''
    ];
    
    console.log('2️⃣ Testing with common WRONG organization IDs:');
    for (const wrongOrgId of wrongOrgIds) {
      console.log(`   Testing with: ${wrongOrgId || 'null/undefined'}`);
      
      const { data: wrongIntegration, error: wrongError } = await supabase
        .from('organization_integrations')
        .select('*')
        .eq('organization_id', wrongOrgId)
        .eq('integration_name', 'odoo')
        .eq('is_active', true)
        .single();
      
      if (wrongError) {
        console.log(`     ❌ Error: ${wrongError.message}`);
      } else if (wrongIntegration) {
        console.log(`     ✅ Found integration (unexpected!)`);
      } else {
        console.log(`     ⚠️  No integration found (expected)`);
      }
    }
    
    console.log('');
    console.log('🎯 DIAGNOSIS:');
    console.log('=============');
    console.log('The issue is likely that the frontend is sending a DIFFERENT organization ID');
    console.log('in production than what exists in the database.');
    console.log('');
    console.log('✅ CORRECT organization ID: 9a4880df-ba32-4291-bd72-2b13dad95f20');
    console.log('❌ WRONG organization ID: Whatever the frontend is sending');
    console.log('');
    console.log('🔧 SOLUTION:');
    console.log('1. Check what organization ID the frontend is sending in production');
    console.log('2. Either update the frontend to send the correct ID');
    console.log('3. Or create a new organization_integrations record with the ID the frontend is sending');
    console.log('');
    console.log('📋 To check frontend organization ID:');
    console.log('- Look at browser network tab when making the API call');
    console.log('- Check the request payload for organizationId');
    console.log('- Or check Netlify Function logs for the organization ID being received');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testProductionScenario();
