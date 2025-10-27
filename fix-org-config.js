#!/usr/bin/env node

/**
 * Fix Organization Integration Config
 * Updates the organization_integrations table with proper Odoo config
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  console.error('\nPlease set these in your .env file or run with:');
  console.error('VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node fix-org-config.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrganizationConfig() {
  console.log('🔧 Fixing Organization Integration Config');
  console.log('========================================\n');

  const organizationId = '9a4880df-ba32-4291-bd72-2b13dad95f20';
  
  // You need to provide these values
  const odooConfig = {
    url: 'https://hemisphere1.odoo.com',
    db: 'hemisphere1',
    username: 'YOUR_USERNAME_HERE' // Replace with actual username
  };

  console.log('📋 Current config to update:');
  console.log('   Organization ID:', organizationId);
  console.log('   Odoo URL:', odooConfig.url);
  console.log('   Database:', odooConfig.db);
  console.log('   Username:', odooConfig.username);
  console.log('   API Key: (already set in database)');

  try {
    const { data, error } = await supabase
      .from('organization_integrations')
      .update({ 
        config: odooConfig 
      })
      .eq('organization_id', organizationId)
      .eq('integration_name', 'odoo')
      .select();

    if (error) {
      console.error('❌ Error updating config:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('\n✅ Successfully updated organization integration config!');
      console.log('📊 Updated record:', data[0]);
    } else {
      console.log('\n⚠️  No records updated. Check if the organization integration exists.');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

fixOrganizationConfig();
