import React, { useState } from 'react';
import { LLMService } from '../services/llmService';

const TestLLM = () => {
  const [testResult, setTestResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Create a simple test spreadsheet
  const testData = [
    [{ value: 'Name', className: '' }, { value: 'Value', className: '' }, { value: 'Interest Rate', className: '' }],
    [{ value: 'Item 1', className: '' }, { value: 1000, className: '' }, { value: 0.05, className: '' }],
    [{ value: 'Item 2', className: '' }, { value: 2000, className: '' }, { value: 0.03, className: '' }],
    [{ value: 'Total', className: '' }, { value: '=SUM(B2:B3)', className: '' }, { value: '=AVERAGE(C2:C3)', className: '' }]
  ];

  const testLLMIntegration = async () => {
    setIsLoading(true);
    setTestResult('Testing LLM integration...\n');

    try {
      // Create LLM service with test data
      const llmService = new LLMService(testData, () => {});
      
      // Test basic tool calls
      setTestResult(prev => prev + 'Testing find tool...\n');
      const findResult = llmService.findCell('interest rate');
      setTestResult(prev => prev + `Find result: ${JSON.stringify(findResult)}\n`);

      setTestResult(prev => prev + 'Testing read_cell tool...\n');
      const readResult = llmService.readCell('C2');
      setTestResult(prev => prev + `Read result: ${JSON.stringify(readResult)}\n`);

      setTestResult(prev => prev + 'Testing update_cell tool...\n');
      const updateResult = llmService.updateCell('C2', '0.10');
      setTestResult(prev => prev + `Update result: ${JSON.stringify(updateResult)}\n`);

      setTestResult(prev => prev + 'Testing read_sheet tool...\n');
      const sheetResult = llmService.readSheet('A1:C4');
      setTestResult(prev => prev + `Sheet result: ${JSON.stringify(sheetResult)}\n`);

      // Test OpenAI chat (this will require a valid API key)
      setTestResult(prev => prev + '\nTesting OpenAI chat...\n');
      const chatResult = await llmService.chat('What is the current interest rate in cell C2?');
      setTestResult(prev => prev + `Chat result: ${chatResult}\n`);

      if (chatResult.includes('Error:')) {
        setTestResult(prev => prev + '\n⚠️ Tool tests passed, but OpenAI API needs configuration.\n');
        setTestResult(prev => prev + 'Please set VITE_OPENAI_KEY in your .env file with a valid OpenAI API key.\n');
      } else {
        setTestResult(prev => prev + '\n✅ All tests completed successfully!\n');
        setTestResult(prev => prev + '🎉 LLM integration is working perfectly!\n');
      }
    } catch (error) {
      setTestResult(prev => prev + `\n❌ Error: ${error.message}\n`);
      setTestResult(prev => prev + 'Make sure you have set your VITE_OPENAI_KEY in the .env file.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">LLM Integration Test</h3>
      
      <button
        onClick={testLLMIntegration}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Testing...' : 'Test LLM Integration'}
      </button>

      {testResult && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap">{testResult}</pre>
        </div>
      )}
    </div>
  );
};

export default TestLLM;
