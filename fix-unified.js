#!/usr/bin/env node

/**
 * UNIFIED ODOO CONFIGURATION FIX
 * This script fixes the organization_integrations table to have proper Odoo config
 * Works for both local and production environments
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment or use defaults
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

console.log('🔧 UNIFIED ODOO CONFIGURATION FIX');
console.log('==================================\n');

console.log('📋 Configuration:');
console.log('   Supabase URL:', supabaseUrl);
console.log('   Supabase Key:', supabaseKey.substring(0, 20) + '...');
console.log('   Organization ID: 9a4880df-ba32-4291-bd72-2b13dad95f20\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOdooConfig() {
  try {
    console.log('🔍 Step 1: Checking current configuration...');
    
    const { data: currentIntegration, error: fetchError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', '9a4880df-ba32-4291-bd72-2b13dad95f20')
      .eq('integration_name', 'odoo')
      .eq('is_active', true)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching integration:', fetchError.message);
      console.log('\n💡 Solution: Make sure your Supabase credentials are correct');
      console.log('   Run with: VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node fix-unified.js');
      return;
    }

    if (!currentIntegration) {
      console.error('❌ No integration found');
      return;
    }

    console.log('✅ Found integration record');
    console.log('   ID:', currentIntegration.id);
    console.log('   API Key:', currentIntegration.api_key ? '✅ Set' : '❌ Missing');
    console.log('   Config:', JSON.stringify(currentIntegration.config, null, 2));
    console.log('   Separate fields:');
    console.log('     odoo_url:', currentIntegration.odoo_url || '❌ Missing');
    console.log('     odoo_db:', currentIntegration.odoo_db || '❌ Missing');
    console.log('     odoo_username:', currentIntegration.odoo_username || '❌ Missing');

    console.log('\n🔍 Step 2: Determining fix strategy...');
    
    // Strategy: Use separate fields if they exist, otherwise use hardcoded values
    let odooConfig;
    
    if (currentIntegration.odoo_url && currentIntegration.odoo_db && currentIntegration.odoo_username) {
      console.log('✅ Using existing separate fields');
      odooConfig = {
        url: currentIntegration.odoo_url,
        db: currentIntegration.odoo_db,
        username: currentIntegration.odoo_username
      };
    } else {
      console.log('⚠️  Separate fields missing, using default values');
      console.log('   You may need to update these values manually');
      odooConfig = {
        url: 'https://your-odoo-url.com',
        db: 'your-database',
        username: 'your-username' // Update this to your actual username
      };
    }

    console.log('\n🔧 Step 3: Updating config field...');
    console.log('   New config:', JSON.stringify(odooConfig, null, 2));

    const { data: updateData, error: updateError } = await supabase
      .from('organization_integrations')
      .update({ 
        config: odooConfig 
      })
      .eq('organization_id', '9a4880df-ba32-4291-bd72-2b13dad95f20')
      .eq('integration_name', 'odoo')
      .select();

    if (updateError) {
      console.error('❌ Error updating config:', updateError.message);
      return;
    }

    console.log('\n✅ SUCCESS! Configuration updated');
    console.log('==================================');
    console.log('   Updated record:', updateData[0].id);
    console.log('   Config field now contains:', JSON.stringify(updateData[0].config, null, 2));

    console.log('\n🎯 Next Steps:');
    console.log('===============');
    console.log('1. Deploy the updated Netlify function to staging/production');
    console.log('2. Test the Odoo integration');
    console.log('3. If username is wrong, update it in Supabase dashboard');
    console.log('4. The function will now use the config field instead of empty {}');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

fixOdooConfig();
