#!/usr/bin/env node

/**
 * Check Organization Integrations Schema
 * This script shows what fields actually exist in the organization_integrations table
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  console.error('\nPlease set these in your .env file or run with:');
  console.error('VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node check-schema.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking Organization Integrations Schema');
  console.log('==========================================\n');

  const organizationId = '9a4880df-ba32-4291-bd72-2b13dad95f20';

  try {
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
      console.log('⚠️  No integration found for organization ID:', organizationId);
      return;
    }

    console.log('📊 Found integration record:');
    console.log('============================');
    
    // Show all fields
    Object.keys(integrations).forEach(key => {
      const value = integrations[key];
      if (typeof value === 'object' && value !== null) {
        console.log(`   ${key}:`, JSON.stringify(value, null, 2));
      } else {
        console.log(`   ${key}:`, value);
      }
    });

    console.log('\n🔍 Field Analysis:');
    console.log('==================');
    
    // Check for separate fields
    const separateFields = ['odoo_url', 'odoo_db', 'odoo_username', 'odoo_name'];
    separateFields.forEach(field => {
      const exists = integrations.hasOwnProperty(field);
      const value = integrations[field];
      console.log(`   ${field}: ${exists ? '✅ EXISTS' : '❌ MISSING'} ${value ? `(${value})` : ''}`);
    });

    // Check config field
    const configExists = integrations.hasOwnProperty('config');
    const configValue = integrations.config;
    console.log(`   config: ${configExists ? '✅ EXISTS' : '❌ MISSING'}`);
    if (configExists) {
      console.log(`   config value:`, JSON.stringify(configValue, null, 2));
    }

    console.log('\n🎯 Recommendation:');
    console.log('===================');
    
    if (configExists && configValue && Object.keys(configValue).length > 0) {
      console.log('✅ Use config field - it has data');
    } else if (separateFields.some(field => integrations.hasOwnProperty(field) && integrations[field])) {
      console.log('✅ Use separate fields - they have data');
    } else {
      console.log('❌ Neither config nor separate fields have data - need to populate');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkSchema();
