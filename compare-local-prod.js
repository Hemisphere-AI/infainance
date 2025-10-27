#!/usr/bin/env node

/**
 * Compare Local vs Production Differences
 * This script helps identify why localhost finds 2 records but production finds 0
 */

console.log('🔍 LOCAL vs PRODUCTION DIFFERENCES ANALYSIS');
console.log('==========================================\n');

// 1. Environment Variables
console.log('1️⃣ ENVIRONMENT VARIABLES:');
console.log('   Localhost: Uses .env file (not accessible)');
console.log('   Production: Uses Netlify environment variables');
console.log('   ⚠️  Potential difference in Supabase credentials\n');

// 2. Odoo Configuration
console.log('2️⃣ ODOO CONFIGURATION:');
console.log('   From production logs:');
console.log('   - Organization ID: 9a4880df-ba32-4291-bd72-2b13dad95f20');
console.log('   - Integration found: ✅');
console.log('   - API Key: e6b53587788aa55c0ab30e211c088d96dc8b24af');
console.log('   - Config: {} (EMPTY!)');
console.log('   ⚠️  CRITICAL: Odoo URL, DB, username missing from config\n');

// 3. Query Generation
console.log('3️⃣ AI QUERY GENERATION:');
console.log('   Production query:');
console.log('   - Model: account.move.line');
console.log('   - Domain: account_id.code in [480500, 481000, 482000, 483000, 484000]');
console.log('   - Fields: [id, name, account_id, debit, credit, move_id]');
console.log('   - Limit: 1000');
console.log('   ⚠️  Query looks correct\n');

// 4. Odoo API Response
console.log('4️⃣ ODOO API RESPONSE:');
console.log('   Production: 0 records found');
console.log('   Localhost: 2 records found');
console.log('   ⚠️  Same query, different results\n');

// 5. Possible Causes
console.log('5️⃣ POSSIBLE CAUSES:');
console.log('   A. Different Odoo instances:');
console.log('      - Local uses different Odoo URL/database');
console.log('      - Production uses empty config (fallback to env vars)');
console.log('');
console.log('   B. Different data:');
console.log('      - Local Odoo has test data');
console.log('      - Production Odoo has no matching records');
console.log('');
console.log('   C. Different authentication:');
console.log('      - Local uses different API key/user');
console.log('      - Production uses organization integration API key');
console.log('');
console.log('   D. Different model context:');
console.log('      - Local has full Odoo models loaded');
console.log('      - Production falls back to hardcoded models');

// 6. Next Steps
console.log('\n6️⃣ NEXT STEPS TO DEBUG:');
console.log('   1. Check organization_integrations table in Supabase');
console.log('   2. Verify Odoo URL, database, username in config field');
console.log('   3. Test with same Odoo credentials locally');
console.log('   4. Check if dynamic model loading works in production');
console.log('   5. Compare exact Odoo API responses');

console.log('\n🎯 MOST LIKELY ISSUE:');
console.log('   The organization_integrations.config field is empty,');
console.log('   so production falls back to environment variables,');
console.log('   which might point to a different Odoo instance or have');
console.log('   different credentials than your local setup.');
