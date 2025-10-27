#!/usr/bin/env node

/**
 * Test Odoo Authentication Response Parsing
 */

// Test the regex pattern with the actual response
const xmlResponse = `<?xml version="1.0"?>
<methodResponse>
<params>
<param>
<value><int>2</int></value>
</param>
</params>
</methodResponse>`;

console.log('🧪 Testing XML Response Parsing');
console.log('==============================');
console.log('');
console.log('XML Response:');
console.log(xmlResponse);
console.log('');

// Test the old pattern
const oldPattern = /<value><i4>(\d+)<\/i4><\/value>/;
const oldMatch = xmlResponse.match(oldPattern);
console.log('❌ Old pattern result:', oldMatch);

// Test the new pattern
const newPattern = /<value><(?:i4|int)>(\d+)<\/(?:i4|int)><\/value>/;
const newMatch = xmlResponse.match(newPattern);
console.log('✅ New pattern result:', newMatch);

if (newMatch) {
  const uid = parseInt(newMatch[1]);
  console.log('✅ Parsed UID:', uid);
  console.log('🎉 Authentication parsing should work now!');
} else {
  console.log('❌ Still not working');
}
