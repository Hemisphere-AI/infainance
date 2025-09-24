import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Send, Bot, User, Loader2, ChevronDown, ChevronUp, Key, Eye, EyeOff, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ChatInterface = ({ onSendMessage, isLoading = false, onClearHistory, onToolCall = null, onApiKeyChange = null, spreadsheetData = null, llmService = null, onHighlightBlock = null }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [isKeySectionCollapsed, setIsKeySectionCollapsed] = useState(true);
  const [indexedSections, setIndexedSections] = useState([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: 'Hello! I\'m your Spreadsheet Copilot. I can help you analyze and modify your Excel data. Try asking me something like "What if my interest rate was twice as high?" or "Find the total in column A".',
      timestamp: new Date()
    }
  ]);
  const [toolCalls, setToolCalls] = useState([]);
  const [expandedToolCalls, setExpandedToolCalls] = useState(new Set());
  // const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      // const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
      // setShowScrollButton(!isAtBottom);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, toolCalls]);

  // Handle tool call updates
  const handleToolCall = useCallback((toolCallData) => {
    setToolCalls(prev => [...prev, {
      id: Date.now() + Math.random(),
      ...toolCallData,
      timestamp: new Date()
    }]);

    // Highlight range when index_spreadsheet tool is called
    if (toolCallData.type === 'tool_call' && toolCallData.tool === 'index_spreadsheet' && onHighlightBlock) {
      const frameRange = toolCallData.arguments?.frame_range;
      if (frameRange) {
        onHighlightBlock(frameRange);
      }
    }
  }, [onHighlightBlock]);

  useEffect(() => {
    if (onToolCall) {
      // Store the handler so it can be passed to the LLM service
      onToolCall(handleToolCall);
    }
  }, [onToolCall, handleToolCall]);

  // Check if we have a valid key to determine if section should be collapsed
  const hasValidKey = useCallback(() => {
    if (!user) return false;
    
    // If user is the demo user, they can use the environment key
    if (user.email === import.meta.env.VITE_DEMO_USER) {
      return true;
    }
    
    // If user entered the demo key from environment, they can use the environment key
    if (openaiKey.trim() === import.meta.env.VITE_DEMO_KEY) {
      return true;
    }
    
    // If user entered a valid-looking OpenAI key
    if (openaiKey.trim().startsWith('sk-') && openaiKey.trim().length > 20) {
      return true;
    }
    
    return false;
  }, [user, openaiKey]);

  // Auto-collapse when valid key is detected
  useEffect(() => {
    if (hasValidKey()) {
      setIsKeySectionCollapsed(true);
    }
  }, [openaiKey, user, hasValidKey]);

  // Handle API key input changes
  const handleKeyChange = (e) => {
    const value = e.target.value;
    setOpenaiKey(value);
    setKeyError(''); // Clear any previous errors
    
    // Call the parent's onApiKeyChange if provided
    if (onApiKeyChange) {
      onApiKeyChange(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    // Check if user has valid key access
    if (!hasValidKey()) {
      setKeyError('Please enter a valid OpenAI API key');
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setToolCalls([]); // Clear previous tool calls

    try {
      const response = await onSendMessage(message.trim());
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const toggleToolCallExpansion = (toolCallId) => {
    setExpandedToolCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  const getToolDescription = (toolName, type) => {
    const descriptions = {
      'find': {
        call: '🔎 Searching for label in spreadsheet',
        result: '📍 Label found'
      },
      'find_label_value': {
        call: '🏷️ Finding label and its associated value',
        result: '💰 Label-value pair found'
      },
      'find_subframe': {
        call: '🔍 Finding data subframe for comparison analysis',
        result: '📊 Subframe analysis complete'
      },
      'conclude': {
        call: '🎯 Providing final answer',
        result: 'Answer concluded'
      },
      'small_talk': {
        call: '💬 Handling simple conversation',
        result: 'Response provided'
      },
      'read_cell': {
        call: '📖 Reading cell value',
        result: '📄 Cell value retrieved'
      },
      'update_cell': {
        call: '✏️ Updating cell value',
        result: 'Cell updated'
      },
      'recalc': {
        call: '🔄 Recalculating formulas',
        result: 'Recalculation complete'
      },
      'read_sheet': {
        call: '📋 Reading spreadsheet range',
        result: '📊 Range data loaded'
      },
      'index_spreadsheet': {
        call: '🔍 Analyzing spreadsheet frame',
        result: '📋 Frame analysis complete'
      }
    };
    
    return descriptions[toolName]?.[type] || '';
  };

  // Helper function to convert column index to letter
  const getColumnLetter = (index) => {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  };

  // Helper function to convert row/col to Excel address
  const getExcelAddress = (row, col) => {
    return getColumnLetter(col) + (row + 1);
  };

  // Algorithm to detect data blocks separated by whitespace
  const detectDataBlocks = useCallback(() => {
    if (!spreadsheetData || spreadsheetData.length === 0) return [];
    
    const blocks = [];
    const data = spreadsheetData;
    const rows = data.length;
    const cols = data[0]?.length || 0;
    
    // Helper function to check if a row is empty
    const isEmptyRow = (rowIndex) => {
      if (rowIndex >= rows) return true;
      const row = data[rowIndex];
      if (!row) return true;
      return row.every(cell => !cell || cell.value === '' || cell.value === null || cell.value === undefined);
    };
    
    // Helper function to check if a column is empty
    const isEmptyCol = (colIndex) => {
      if (colIndex >= cols) return true;
      for (let row = 0; row < rows; row++) {
        const cell = data[row]?.[colIndex];
        if (cell && cell.value !== '' && cell.value !== null && cell.value !== undefined) {
          return false;
        }
      }
      return true;
    };
    
    // Find all non-empty cells to determine the actual data bounds
    let minRow = rows, maxRow = -1, minCol = cols, maxCol = -1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = data[row]?.[col];
        if (cell && cell.value !== '' && cell.value !== null && cell.value !== undefined) {
          minRow = Math.min(minRow, row);
          maxRow = Math.max(maxRow, row);
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }
    
    if (maxRow === -1) return []; // No data found
    
    // Find blocks by looking for empty rows/columns that separate data
    let currentBlock = null;
    
    for (let row = minRow; row <= maxRow; row++) {
      if (isEmptyRow(row)) {
        // End current block if we have one
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
      } else {
        // Start or extend current block
        if (!currentBlock) {
          currentBlock = {
            startRow: row,
            endRow: row,
            startCol: minCol,
            endCol: maxCol
          };
        } else {
          currentBlock.endRow = row;
        }
      }
    }
    
    // Add the last block if it exists
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    
    // Convert to Excel ranges and add metadata
    return blocks.map((block, index) => {
      const startAddress = getExcelAddress(block.startRow, block.startCol);
      const endAddress = getExcelAddress(block.endRow, block.endCol);
      const range = `${startAddress}:${endAddress}`;
      
      return {
        id: `block_${index}`,
        range: range,
        startRow: block.startRow,
        endRow: block.endRow,
        startCol: block.startCol,
        endCol: block.endCol,
        size: (block.endRow - block.startRow + 1) * (block.endCol - block.startCol + 1)
      };
    });
  }, [spreadsheetData]);

  // State for tracking analyzed sections
  const [analyzedSections, setAnalyzedSections] = useState([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);

  // Indexing function that uses proper tool calling
  const indexSpreadsheet = useCallback(async () => {
    if (!spreadsheetData || spreadsheetData.length === 0) {
      setKeyError('No spreadsheet data available to index');
      return;
    }

    console.log('Index button clicked, llmService:', llmService);
    console.log('Spreadsheet data length:', spreadsheetData.length);

    if (!llmService) {
      setKeyError('LLM service not available for indexing. Please wait for the service to initialize.');
      return;
    }

    setIsIndexing(true);
    setIndexedSections([{ description: 'Indexing in progress...', range: 'Processing frames', type: 'progress' }]); // Show progress
    setAnalyzedSections([]); // Clear analyzed sections
    setCurrentBlockIndex(0);
    
    try {
      // Step 1: Get frames from the LLM service
      const frames = llmService.getAllFrames();
      console.log('Detected frames:', frames);
      
      if (frames.length === 0) {
        setKeyError('No frames found in the spreadsheet');
        return;
      }
      
      // Step 2: Use LLM with proper tool calling to index the spreadsheet
      const indexingPrompt = `I need to index this spreadsheet by analyzing ${frames.length} frames step by step. 

Detected frames:
${frames.map((frame, index) => `${index}. ${frame.range}`).join('\n')}

You MUST process ALL ${frames.length} frames (0 to ${frames.length - 1}). Use the index_spreadsheet tool for each frame:
1. Call index_spreadsheet with frame_range, frame_index (0, 1, 2, 3, 4, 5, 6, 7...), total_frames (${frames.length}), and current sections
2. Review the analysis results and update your sections list
3. Continue to the next frame until ALL frames are processed

CRITICAL: Do not stop until you have processed frames 0, 1, 2, 3, 4, 5, 6, 7 (all ${frames.length} frames). Show me the progress and findings as you go.

WARNING: If you try to conclude before processing all ${frames.length} frames, you will get an error and must continue. You cannot stop early.

FRAME LIST TO PROCESS:
${frames.map((frame, index) => `Frame ${index}: ${frame.range}`).join('\n')}

You must call index_spreadsheet for each of these ${frames.length} frames in order.`;
      
      // Send the indexing prompt to trigger tool calling
      const response = await onSendMessage(indexingPrompt);
      
      console.log('Indexing response:', response);
      
      // The response should contain the indexed sections from tool calls
      if (response && typeof response === 'string') {
        // Add the indexing response as a regular chat message
        const indexingMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, indexingMessage]);
        setIndexedSections([{ description: 'Indexing complete', range: 'See chat messages for results', type: 'complete' }]);
        setKeyError(''); // Clear any previous errors
      }
      
    } catch (error) {
      console.error('Error indexing spreadsheet:', error);
      setKeyError('Error indexing spreadsheet: ' + error.message);
    } finally {
      setIsIndexing(false);
    }
  }, [spreadsheetData, llmService, onSendMessage]);

  const formatParameters = (toolCall) => {
    if (toolCall.type === 'tool_call') {
      if (toolCall.tool === 'find') {
        return [
          `Searching for: ${toolCall.arguments?.hint || 'N/A'}`,
          `Strategy: ${toolCall.arguments?.search_strategy || 'default'}`
        ];
      } else if (toolCall.tool === 'find_label_value') {
        return [
          `Label: ${toolCall.arguments?.label || 'N/A'}`,
          `Strategy: ${toolCall.arguments?.search_strategy || 'default'}`
        ];
      } else if (toolCall.tool === 'find_subframe') {
        return [
          `Metric: ${toolCall.arguments?.label1 || 'N/A'}`,
          `Entity: ${toolCall.arguments?.label2 || 'N/A'}`,
          `Purpose: Finding which entity has the most/least of the metric`
        ];
      } else if (toolCall.tool === 'conclude') {
        return [`Answer: ${toolCall.arguments?.answer || 'No answer provided'}`];
      } else if (toolCall.tool === 'small_talk') {
        return [`Response: ${toolCall.arguments?.response || 'No response provided'}`];
      } else if (toolCall.tool === 'read_cell') {
        return [
          `Reading cell: ${toolCall.arguments?.address || 'N/A'}`,
          `Purpose: Getting the actual value at this location`
        ];
      } else if (toolCall.tool === 'update_cell') {
        return [
          `Cell: ${toolCall.arguments?.address || 'N/A'}`,
          `New value: ${JSON.stringify(toolCall.arguments?.newValue || 'N/A')}`
        ];
      } else if (toolCall.tool === 'recalc') {
        return ['Triggering formula recalculation'];
      } else if (toolCall.tool === 'read_sheet') {
        return [
          `Reading range: ${toolCall.arguments?.range || 'N/A'}`,
          `Purpose: Getting data from multiple cells`
        ];
      } else if (toolCall.tool === 'index_spreadsheet') {
        return [
          `Frame: ${toolCall.arguments?.frame_range || 'N/A'}`,
          `Progress: ${(toolCall.arguments?.frame_index || 0) + 1}/${toolCall.arguments?.total_frames || 0}`,
          `Sections: ${toolCall.arguments?.sections?.length || 0} analyzed`,
          `Action: ${toolCall.arguments?.frame_index === 0 ? 'Starting indexing' : 'Continuing indexing'}`
        ];
      } else {
        return Object.entries(toolCall.arguments || {}).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
      }
    } else {
      if (toolCall.result?.error) {
        return [`❌ Error: ${toolCall.result.error}`];
      } else if (toolCall.tool === 'find') {
        return [
          `📍 Found: ${toolCall.result?.address || 'N/A'}`,
          `💰 Value: ${toolCall.result?.value || 'N/A'}`,
          `📍 Location: ${toolCall.result?.location || 'N/A'}`
        ];
      } else if (toolCall.tool === 'find_label_value') {
        return [
          `🏷️ Label: ${toolCall.result?.label?.value || 'N/A'}`,
          `💰 Value: ${toolCall.result?.value?.value || 'N/A'}`,
          `📍 Location: ${toolCall.result?.valueLocation || 'N/A'}`
        ];
      } else if (toolCall.tool === 'find_subframe') {
        if (toolCall.result?.resultAddr) {
          return [
            `📍 Found subframe: ${toolCall.result?.range || 'N/A'}`,
            `🏆 Winner: ${toolCall.result?.resultEntity || 'N/A'}`,
            `📍 Location: ${toolCall.result?.resultAddr || 'N/A'}`,
            `Next: Will read this cell to confirm the value`
          ];
        } else if (toolCall.result?.error) {
          return [`❌ Error: ${toolCall.result.error}`];
        } else {
          return ['📊 Subframe analysis complete'];
        }
      } else if (toolCall.tool === 'conclude') {
        return [`🎯 Final Answer: ${toolCall.result?.answer || 'No answer provided'}`];
      } else if (toolCall.tool === 'small_talk') {
        return [`💬 Response: ${toolCall.result?.response || 'No response provided'}`];
      } else if (toolCall.tool === 'read_cell') {
        return [
          `📍 Cell: ${toolCall.result?.address || 'N/A'}`,
          `💰 Value: ${toolCall.result?.value || 'N/A'}`,
          `Next: ${toolCall.result?.value ? 'Ready to conclude with this data' : 'Need to find correct cell'}`
        ];
      } else if (toolCall.tool === 'update_cell') {
        return [
          `Cell: ${toolCall.result?.address || 'N/A'}`,
          `New value: ${JSON.stringify(toolCall.result?.newValue || 'N/A')}`
        ];
      } else if (toolCall.tool === 'recalc') {
        return [
          `Changed: ${toolCall.result?.changed || 0} cells`,
          `Message: ${toolCall.result?.message || 'Recalculation complete'}`
        ];
      } else if (toolCall.tool === 'read_sheet') {
        return [
          `📊 Range: ${toolCall.result?.range || 'N/A'}`,
          `📈 Data loaded: ${toolCall.result?.window ? 'Yes' : 'No'}`,
          `Next: Analyzing the data to find the answer`
        ];
      } else if (toolCall.tool === 'index_spreadsheet') {
        const analysis = toolCall.result?.analysis;
        return [
          `🔍 Frame: ${toolCall.result?.frame_range || 'N/A'}`,
          `📋 Type: ${analysis?.type || 'Unknown'}`,
          `📝 Description: ${analysis?.description || 'N/A'}`,
          `🔗 Merge: ${analysis?.should_merge ? 'Yes' : 'No'}`,
          `📊 Progress: ${toolCall.result?.progress || 'N/A'}`,
          `📈 Sections: ${toolCall.result?.sections?.length || 0} found`,
          `✅ Complete: ${toolCall.result?.is_complete ? 'Yes' : 'No'}`
        ];
      } else {
        return [];
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">Spreadsheet Copilot</h3>
          </div>
          {onClearHistory && (
            <button
              onClick={() => {
                setMessages([{
                  id: 1,
                  type: 'bot',
                  content: 'Hello! I\'m your Spreadsheet Copilot. I can help you analyze and modify your Excel data. Try asking me something like "What if my interest rate was twice as high?" or "Find the total in column A".',
                  timestamp: new Date()
                }]);
                setToolCalls([]);
                onClearHistory();
              }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
              title="Clear conversation history"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Ask me to analyze or modify your spreadsheet data
        </p>
      </div>

      {/* OpenAI Key Input */}
      <div className="border-b border-gray-200 bg-gray-50">
        {/* Collapsible Header */}
        <button
          onClick={() => setIsKeySectionCollapsed(!isKeySectionCollapsed)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">OpenAI API Key</span>
            {hasValidKey() && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                ✓ Configured
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {hasValidKey() && (
              <span className="text-xs text-gray-500">
                {user?.email === import.meta.env.VITE_DEMO_USER
                  ? 'Environment key' 
                  : openaiKey.trim() === import.meta.env.VITE_DEMO_KEY
                    ? 'Demo key' 
                    : 'Custom key'
                }
              </span>
            )}
            {isKeySectionCollapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {/* Collapsible Content */}
        {!isKeySectionCollapsed && (
          <div className="px-4 pb-4 space-y-2">
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={handleKeyChange}
                  placeholder={
                    user?.email === import.meta.env.VITE_DEMO_USER
                      ? "Using environment key (demo user)" 
                      : "Enter your OpenAI API key"
                  }
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    keyError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={user?.email === import.meta.env.VITE_DEMO_USER}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={user?.email === import.meta.env.VITE_DEMO_USER}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {keyError && (
              <p className="text-sm text-red-600">{keyError}</p>
            )}
            {user?.email === import.meta.env.VITE_DEMO_USER && (
              <p className="text-xs text-green-600">
                ✓ Using environment key for demo user
              </p>
            )}
            {openaiKey.trim() === import.meta.env.VITE_DEMO_KEY && user?.email !== import.meta.env.VITE_DEMO_USER && (
              <p className="text-xs text-blue-600">
                ✓ Using demo key
              </p>
            )}
            {openaiKey.trim().startsWith('sk-') && openaiKey.trim().length > 20 && (
              <p className="text-xs text-green-600">
                ✓ Using your OpenAI API key
              </p>
            )}
          </div>
        )}
      </div>

      {/* Index Section */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Spreadsheet Index</span>
              {indexedSections.length > 0 && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  {indexedSections.length} sections
                </span>
              )}
            </div>
            <button
              onClick={indexSpreadsheet}
              disabled={!spreadsheetData || isIndexing}
              className="px-3 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              {isIndexing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Search className="w-3 h-3" />
              )}
              <span>{isIndexing ? 'Indexing...' : 'Index'}</span>
            </button>
          </div>
          
          {indexedSections.length > 0 && (
            <div className="text-xs text-gray-500">
              Indexing complete - see chat messages for results
            </div>
          )}
          
          {!spreadsheetData && (
            <p className="text-xs text-gray-500">
              Upload a spreadsheet to enable indexing
            </p>
          )}
          
          {spreadsheetData && !llmService && (
            <p className="text-xs text-yellow-600">
              Initializing indexing service...
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 relative"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="flex items-start space-x-2">
                {msg.type === 'bot' && (
                  <Bot className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                )}
                {msg.type === 'user' && (
                  <User className="w-4 h-4 mt-0.5 text-white flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Tool Calls Display */}
        {toolCalls.map((toolCall) => {
          const isExpanded = expandedToolCalls.has(toolCall.id);
          const parameters = formatParameters(toolCall);
          const hasParameters = parameters && parameters.length > 0;
          const isSuccess = toolCall.type === 'tool_result' && !toolCall.result?.error;
          
          // Determine colors based on state
          let bgColor, borderColor, textColor, iconColor, icon;
          if (toolCall.tool === 'update_cell') {
            bgColor = isSuccess ? 'bg-green-50' : 'bg-orange-50';
            borderColor = isSuccess ? 'border-green-200' : 'border-orange-200';
            textColor = isSuccess ? 'text-green-800' : 'text-orange-800';
            iconColor = isSuccess ? 'text-green-600' : 'text-orange-600';
            icon = isSuccess ? '✅' : '✏️';
          } else {
            bgColor = isSuccess ? 'bg-green-50' : 'bg-blue-50';
            borderColor = isSuccess ? 'border-green-200' : 'border-blue-200';
            textColor = isSuccess ? 'text-green-800' : 'text-blue-800';
            iconColor = isSuccess ? 'text-green-600' : 'text-blue-600';
            icon = isSuccess ? '✅' : '🔧';
          }
          
          return (
            <div key={toolCall.id} className="w-full mb-1">
              <div className={`w-full rounded-xl border text-xs ${bgColor} ${borderColor}`}>
                {/* Header */}
                <div 
                  className="px-3 py-2 flex items-center space-x-3 cursor-pointer"
                  onClick={() => hasParameters && toggleToolCallExpansion(toolCall.id)}
                >
                  <div className="w-4 h-4 flex-shrink-0">
                    <span className={iconColor}>{icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className={`font-medium ${textColor}`}>
                          {toolCall.tool}
                        </span>
                        <span className={`text-xs ${textColor} opacity-75`}>
                          {getToolDescription(toolCall.tool, toolCall.type)}
                        </span>
                      </div>
                      {hasParameters && (
                        <div className="flex items-center space-x-1">
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-gray-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Parameters */}
                {hasParameters && (
                  <div className={`px-3 pb-2 ${iconColor}`}>
                    {isExpanded ? (
                      <div className="space-y-1">
                        {parameters.map((param, index) => (
                          <div key={index} className="text-xs">
                            {param}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="text-xs">
                          {parameters[0]}
                        </div>
                        {parameters.length > 1 && (
                          <div 
                            className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none"
                            style={{
                              background: `linear-gradient(to bottom, transparent 0%, ${
                                bgColor === 'bg-blue-50' ? '#eff6ff' : 
                                bgColor === 'bg-green-50' ? '#f0fdf4' : 
                                bgColor === 'bg-orange-50' ? '#fff7ed' : '#f9fafb'
                              } 100%)`
                            }}
                          ></div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-blue-600" />
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask me about your spreadsheet..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!message.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

ChatInterface.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  onClearHistory: PropTypes.func,
  onToolCall: PropTypes.func,
  onApiKeyChange: PropTypes.func,
  spreadsheetData: PropTypes.array,
  llmService: PropTypes.object,
  onHighlightBlock: PropTypes.func
};

export default ChatInterface;
