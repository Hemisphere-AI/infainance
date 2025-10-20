/**
 * Test script to verify API configuration
 * Run this in browser console to test
 */

import { API_BASE, buildApiUrl, API_ENDPOINTS } from './api.js';

console.log('🔧 API Configuration Test');
console.log('Current URL:', window.location.href);
console.log('API_BASE:', API_BASE);
console.log('Sample API URL:', buildApiUrl(API_ENDPOINTS.ORGANIZATIONS));

// Test if we can make a simple API call
async function testApiConnection() {
  try {
    const response = await fetch(buildApiUrl('/api/odoo/config'));
    console.log('✅ API Connection Test:', response.status, response.statusText);
    if (response.ok) {
      const data = await response.json();
      console.log('📊 API Response:', data);
    }
  } catch (error) {
    console.error('❌ API Connection Test Failed:', error);
  }
}

// Run test
testApiConnection();

export { testApiConnection };
