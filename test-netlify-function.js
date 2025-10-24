#!/usr/bin/env node

/**
 * Test script for Netlify Functions locally
 * This simulates the Netlify Functions environment for testing
 */

const path = require('path');
const testConfig = require('./test-config.js');

// Set up environment variables for testing
Object.assign(process.env, testConfig);
process.env.NODE_ENV = 'development';
process.env.NETLIFY = 'true';

// Mock Netlify Functions context
const mockEvent = {
  httpMethod: 'POST',
  path: '/api/odoo/check',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'test-client'
  },
  body: JSON.stringify({
    checkDescription: "Find all invoices",
    checkTitle: "Invoice Check",
    organizationId: "test-org-123"
  }),
  queryStringParameters: {},
  multiValueQueryStringParameters: {},
  isBase64Encoded: false
};

const mockContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'NetlifyOdooAiAgent',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:NetlifyOdooAiAgent',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/NetlifyOdooAiAgent',
  logStreamName: '2023/10/24/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

// Mock console for better testing output
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: (...args) => originalConsole.log('[TEST]', ...args),
  error: (...args) => originalConsole.error('[TEST ERROR]', ...args),
  warn: (...args) => originalConsole.warn('[TEST WARN]', ...args),
  info: (...args) => originalConsole.info('[TEST INFO]', ...args)
};

async function testNetlifyFunction() {
  try {
    console.log('🧪 Starting Netlify Function test...');
    
    // Import the function handler
    const { handler } = require('./netlify/functions/NetlifyOdooAiAgent.js');
    
    console.log('📦 Function handler loaded successfully');
    
    // Test the function
    console.log('🚀 Calling function handler...');
    const result = await handler(mockEvent, mockContext);
    
    console.log('✅ Function executed successfully');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    if (result.statusCode === 200) {
      console.log('🎉 Test PASSED - Function returned 200');
    } else {
      console.log('❌ Test FAILED - Function returned', result.statusCode);
    }
    
  } catch (error) {
    console.error('💥 Test FAILED with error:', error.message);
    console.error('📋 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testNetlifyFunction();
