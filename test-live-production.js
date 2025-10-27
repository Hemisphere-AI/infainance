#!/usr/bin/env node

/**
 * Live Production Test
 * This tests the actual production Netlify Function
 */

async function testLiveProduction() {
  try {
    console.log('🧪 Testing Live Production Netlify Function');
    console.log('==========================================');
    console.log('');
    
    const checkDescription = `Er zijn geen facturen geboekt op een van onderstaande grootboekrekeningen

480500	Goodwill	 Afschrijving
481000	Gebouwen / verbouwingen Afschrijving
482000	Machine Afschrijving
483000	Inventaris Afschrijving
484000	Vervoermiddelen`;

    const requestBody = {
      checkDescription: checkDescription,
      checkTitle: "inkoop 48 grootboek",
      organizationId: "9a4880df-ba32-4291-bd72-2b13dad95f20",
      acceptanceCriteria: "0 records."
    };

    console.log('📋 Test Request:');
    console.log('   Title:', requestBody.checkTitle);
    console.log('   Organization ID:', requestBody.organizationId);
    console.log('   Acceptance Criteria:', requestBody.acceptanceCriteria);
    console.log('   Description Length:', checkDescription.length, 'characters');
    console.log('');

    console.log('🚀 Calling production Netlify Function...');
    const startTime = Date.now();
    
    const response = await fetch('https://getzenith.ai/.netlify/functions/NetlifyOdooAiAgent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Production-Test/1.0'
      },
      body: JSON.stringify(requestBody)
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`⏱️  Response received in ${duration}ms`);
    console.log('📊 Response status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }

    const result = await response.json();
    
    console.log('✅ Success! Response received:');
    console.log('   Full response:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('   Success:', result.success);
    console.log('   Count:', result.count);
    console.log('   Records found:', result.records?.length || 0);
    console.log('   Data length:', result.data?.length || 0);
    console.log('');

    if (result.count === 2) {
      console.log('🎉 PERFECT! Found exactly 2 records as expected!');
      console.log('   This matches your local results.');
    } else if (result.count === 0) {
      console.log('⚠️  Still getting 0 records - XML parsing might need more fixes.');
    } else {
      console.log(`📊 Found ${result.count} records (different from expected 2).`);
    }

    console.log('');
    console.log('🔍 Record IDs:', result.records?.map(r => r.id) || 'No records');
    console.log('📋 Data preview:', result.data?.slice(0, 2) || 'No data');

    console.log('');
    console.log('🎯 TEST COMPLETE');
    console.log('===============');
    console.log('This test called the actual production Netlify Function');
    console.log('with the exact same parameters as your local test.');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the live test
testLiveProduction();
