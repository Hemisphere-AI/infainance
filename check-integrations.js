#!/usr/bin/env node

/**
 * Organization Integration Checker
 * This script helps you check and update the organization integration in Supabase
 */

import { createClient } from '@supabase/supabase-js';

// You'll need to set these environment variables or replace with your values
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrganizationIntegrations() {
  try {
    console.log('🔍 Checking organization integrations...');
    console.log('=====================================');
    
    // Get all Odoo integrations
    const { data: integrations, error } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('integration_name', 'odoo')
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Error fetching integrations:', error);
      return;
    }
    
    if (!integrations || integrations.length === 0) {
      console.log('⚠️  No active Odoo integrations found');
      console.log('');
      console.log('📝 To fix this:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to Table Editor → organization_integrations');
      console.log('3. Add a new record with:');
      console.log('   - organization_id: your-organization-id');
      console.log('   - integration_name: "odoo"');
      console.log('   - odoo_url: "https://your-real-odoo-instance.com"');
      console.log('   - odoo_db: "your-real-database-name"');
      console.log('   - odoo_username: "your-real-username"');
      console.log('   - api_key: "your-real-api-key"');
      console.log('   - is_active: true');
      return;
    }
    
    console.log(`📊 Found ${integrations.length} Odoo integration(s):`);
    console.log('');
    
    integrations.forEach((integration, index) => {
      console.log(`Integration ${index + 1}:`);
      console.log(`  Organization ID: ${integration.organization_id}`);
      console.log(`  Odoo URL: ${integration.odoo_url}`);
      console.log(`  Database: ${integration.odoo_db}`);
      console.log(`  Username: ${integration.odoo_username}`);
      console.log(`  Has API Key: ${integration.api_key ? 'Yes' : 'No'}`);
      console.log(`  Active: ${integration.is_active}`);
      
      // Check for placeholder values
      const hasPlaceholders = 
        integration.odoo_url?.includes('your_odoo_url_here') ||
        integration.odoo_url?.includes('placeholder') ||
        integration.odoo_db?.includes('your-database-name') ||
        integration.odoo_username?.includes('your-username') ||
        integration.api_key?.includes('your-api-key');
      
      if (hasPlaceholders) {
        console.log('  ⚠️  CONTAINS PLACEHOLDER VALUES - NEEDS UPDATE');
      } else {
        console.log('  ✅ Configuration looks good');
      }
      console.log('');
    });
    
    // Check for placeholder values
    const needsUpdate = integrations.some(integration => 
      integration.odoo_url?.includes('your_odoo_url_here') ||
      integration.odoo_url?.includes('placeholder') ||
      integration.odoo_db?.includes('your-database-name') ||
      integration.odoo_username?.includes('your-username') ||
      integration.api_key?.includes('your-api-key')
    );
    
    if (needsUpdate) {
      console.log('🔧 ACTION REQUIRED:');
      console.log('==================');
      console.log('Some integrations contain placeholder values.');
      console.log('You need to update them in your Supabase database.');
      console.log('');
      console.log('📝 To update:');
      console.log('1. Go to Supabase Dashboard → Table Editor → organization_integrations');
      console.log('2. Find the records with placeholder values');
      console.log('3. Update them with your real Odoo credentials:');
      console.log('   - odoo_url: "https://your-real-odoo-instance.com"');
      console.log('   - odoo_db: "your-real-database-name"');
      console.log('   - odoo_username: "your-real-username"');
      console.log('   - api_key: "your-real-api-key"');
      console.log('');
      console.log('4. After updating, test again with:');
      console.log('   node test-netlify-function.js');
    } else {
      console.log('✅ All integrations look good!');
      console.log('You can now test with: node test-netlify-function.js');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

// Run the check
checkOrganizationIntegrations();
