#!/usr/bin/env node

/**
 * Fix Organization Integration Config
 * This script reads the current config and helps you update it properly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  console.error('\nPlease set these in your .env file or run with:');
  console.error('VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node fix-org-config-dynamic.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrganizationConfig() {
  console.log('🔧 Fixing Organization Integration Config');
  console.log('========================================\n');

  const organizationId = '9a4880df-ba32-4291-bd72-2b13dad95f20';

  try {
    // First, check what's currently in the database
    const { data: currentIntegration, error: fetchError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_name', 'odoo')
      .eq('is_active', true)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching current integration:', fetchError);
      return;
    }

    if (!currentIntegration) {
      console.error('❌ No integration found for organization ID:', organizationId);
      return;
    }

    console.log('📊 Current integration data:');
    console.log('============================');
    Object.keys(currentIntegration).forEach(key => {
      const value = currentIntegration[key];
      if (typeof value === 'object' && value !== null) {
        console.log(`   ${key}:`, JSON.stringify(value, null, 2));
      } else {
        console.log(`   ${key}:`, value);
      }
    });

    // Check what fields have data
    const hasConfigData = currentIntegration.config && Object.keys(currentIntegration.config).length > 0;
    const hasSeparateFields = currentIntegration.odoo_url || currentIntegration.odoo_db || currentIntegration.odoo_username;

    console.log('\n🔍 Field Analysis:');
    console.log('==================');
    console.log(`   config field has data: ${hasConfigData ? '✅ YES' : '❌ NO'}`);
    console.log(`   separate fields have data: ${hasSeparateFields ? '✅ YES' : '❌ NO'}`);

    if (hasConfigData) {
      console.log('\n✅ Config field already has data - no update needed');
      console.log('   Current config:', JSON.stringify(currentIntegration.config, null, 2));
      return;
    }

    if (hasSeparateFields) {
      console.log('\n📋 Separate fields found - migrating to config field...');
      
      const odooConfig = {
        url: currentIntegration.odoo_url,
        db: currentIntegration.odoo_db,
        username: currentIntegration.odoo_username
      };

      console.log('   Migrating to config field:');
      console.log('   ', JSON.stringify(odooConfig, null, 2));

      const { data: updateData, error: updateError } = await supabase
        .from('organization_integrations')
        .update({ 
          config: odooConfig 
        })
        .eq('organization_id', organizationId)
        .eq('integration_name', 'odoo')
        .select();

      if (updateError) {
        console.error('❌ Error updating config:', updateError);
        return;
      }

      console.log('\n✅ Successfully migrated separate fields to config field!');
      console.log('📊 Updated record:', updateData[0]);
    } else {
      console.log('\n❌ No Odoo configuration found in either config or separate fields');
      console.log('   You need to manually add the Odoo configuration');
      console.log('\n📝 Manual update needed:');
      console.log('   1. Go to Supabase Dashboard');
      console.log('   2. Find organization_integrations table');
      console.log('   3. Update the config field with:');
      console.log('   {');
      console.log('     "url": "https://hemisphere1.odoo.com",');
      console.log('     "db": "hemisphere1",');
      console.log('     "username": "your-actual-username"');
      console.log('   }');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

fixOrganizationConfig();
