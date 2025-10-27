#!/usr/bin/env node

/**
 * Organization Table Structure Check
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ujwmhwlabqozhyexkkui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqd21od2xhYnFvemh5ZXhra3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTExODgsImV4cCI6MjA3NDk2NzE4OH0.zJTzPTFQxL35S1na-7O50JKqAilis0pEK_WgTOQa2eU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrganizationTable() {
  try {
    console.log('🔍 Checking Organizations Table Structure');
    console.log('==========================================');
    console.log('');
    
    // Check what columns exist in organizations table
    console.log('1️⃣ Checking organizations table...');
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (orgError) {
      console.error('❌ Error fetching organizations:', orgError);
      return;
    }
    
    if (organizations.length > 0) {
      console.log('✅ Organizations table accessible');
      console.log('📊 Available columns:', Object.keys(organizations[0]));
      console.log('');
      
      // Show the actual organization data
      console.log('2️⃣ Organization data:');
      organizations.forEach((org, index) => {
        console.log(`  ${index + 1}. ID: ${org.id}`);
        console.log(`     Name: ${org.name || 'N/A'}`);
        console.log(`     Email: ${org.email || 'N/A'}`);
        console.log(`     All fields:`, org);
        console.log('');
      });
    } else {
      console.log('⚠️  No organizations found');
    }
    
    // Now let's test the exact organization ID from the integration
    const orgId = '9a4880df-ba32-4291-bd72-2b13dad95f20';
    console.log(`3️⃣ Testing with organization ID from integration: ${orgId}`);
    
    const { data: specificOrg, error: specificError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();
    
    if (specificError) {
      console.error('❌ Error fetching specific organization:', specificError);
    } else if (specificOrg) {
      console.log('✅ Found organization:');
      console.log(`   ID: ${specificOrg.id}`);
      console.log(`   Name: ${specificOrg.name || 'N/A'}`);
      console.log(`   Email: ${specificOrg.email || 'N/A'}`);
      console.log(`   All fields:`, specificOrg);
    } else {
      console.log('⚠️  Organization not found');
    }
    
    console.log('\n🎯 KEY FINDING:');
    console.log('===============');
    console.log('The organization integration has REAL Odoo credentials:');
    console.log('- Odoo URL: https://hemisphere1.odoo.com');
    console.log('- Database: hemisphere1');
    console.log('- Username: thomas@hemisphere.ai');
    console.log('- Has API Key: Yes');
    console.log('');
    console.log('The issue is NOT placeholder values!');
    console.log('The issue might be:');
    console.log('1. Organization ID mismatch in production calls');
    console.log('2. Different organization ID being used in Netlify vs local');
    console.log('3. Frontend sending wrong organizationId');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkOrganizationTable();
