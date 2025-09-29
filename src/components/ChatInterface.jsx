import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Send, Bot, User, Loader2, Square, ChevronDown, ChevronUp, AlertTriangle, Plus, X } from 'lucide-react';

const ChatInterface = ({ onSendMessage, isLoading = false, onToolCall = null, onCancel = null, llmService = null, onAddBotMessage = null }) => {
  const [message, setMessage] = useState('');
  const [tokenQuotaStatus, setTokenQuotaStatus] = useState(null);
  
  // Chat tabs management
  const [activeChatId, setActiveChatId] = useState(1);
  const [chats, setChats] = useState({
    1: {
      id: 1,
      name: 'Chat 1',
      messages: [{
        id: 1,
        type: 'bot',
        content: 'Hello! I can help you analyze and modify your Excel data. Try asking me something like "What if my interest rate was twice as high?" or "Find the total in column A".',
        timestamp: new Date()
      }],
      toolCalls: []
    }
  });
  const [nextChatId, setNextChatId] = useState(2);
  
  // Get current chat data
  const currentChat = chats[activeChatId];
  const messages = useMemo(() => currentChat?.messages || [], [currentChat?.messages]);
  const toolCalls = useMemo(() => currentChat?.toolCalls || [], [currentChat?.toolCalls]);
  
  const [expandedToolCalls, setExpandedToolCalls] = useState(new Set());
  const [isCancelling, setIsCancelling] = useState(false);
  const [isHoveringStop, setIsHoveringStop] = useState(false);
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

  // Tab management functions
  const addNewChat = () => {
    const newChatId = nextChatId;
    const newChat = {
      id: newChatId,
      name: `Chat ${newChatId}`,
      messages: [{
        id: 1,
        type: 'bot',
        content: 'Hello! I can help you analyze and modify your Excel data. Try asking me something like "What if my interest rate was twice as high?" or "Find the total in column A".',
        timestamp: new Date()
      }],
      toolCalls: []
    };
    
    setChats(prev => ({
      ...prev,
      [newChatId]: newChat
    }));
    setActiveChatId(newChatId);
    setNextChatId(prev => prev + 1);
  };

  const closeChat = (chatId) => {
    if (Object.keys(chats).length <= 1) return; // Don't close the last chat
    
    // Actually delete the chat tab
    setChats(prev => {
      const newChats = { ...prev };
      delete newChats[chatId];
      return newChats;
    });
    
    // If we're closing the active chat, switch to the first available chat
    if (activeChatId === chatId) {
      const remainingChatIds = Object.keys(chats).filter(id => id !== chatId);
      if (remainingChatIds.length > 0) {
        setActiveChatId(parseInt(remainingChatIds[0]));
      }
    }
  };

  const switchToChat = (chatId) => {
    setActiveChatId(chatId);
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages, toolCalls]);


  // Handle tool call updates
  const handleToolCall = useCallback((toolCallData) => {
    const newToolCall = {
      id: Date.now() + Math.random(),
      ...toolCallData,
      timestamp: new Date()
    };
    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        toolCalls: [...(prev[activeChatId]?.toolCalls || []), newToolCall]
      }
    }));
  }, [activeChatId]);

  // Handle adding bot messages directly
  const addBotMessage = useCallback((content) => {
    const botMessage = {
      id: Date.now(),
      type: 'bot',
      content: content,
      timestamp: new Date()
    };
    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        messages: [...(prev[activeChatId]?.messages || []), botMessage]
      }
    }));
  }, [activeChatId]);

  useEffect(() => {
    if (onToolCall) {
      // Store the handler so it can be passed to the LLM service
      onToolCall(handleToolCall);
    }
  }, [onToolCall, handleToolCall]);

  useEffect(() => {
    if (onAddBotMessage) {
      // Store the handler so it can be called from the parent
      onAddBotMessage(addBotMessage);
    }
  }, [onAddBotMessage, addBotMessage]);

  // Update token quota status
  useEffect(() => {
    if (llmService) {
      const quotaStatus = llmService.getTokenQuotaStatus();
      setTokenQuotaStatus(quotaStatus);
    } else {
      setTokenQuotaStatus(null);
    }
  }, [llmService]);

  // Handle cancellation
  const handleCancel = useCallback(() => {
    setIsCancelling(true);
    
    // Call the parent's cancel handler
    if (onCancel) {
      onCancel();
    }
    
    // Clear any pending tool calls
    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        toolCalls: []
      }
    }));
    
    // Add cancellation message
    const cancelMessage = {
      id: Date.now(),
      type: 'bot',
      content: 'Request cancelled by user.',
      timestamp: new Date()
    };
    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        messages: [...(prev[activeChatId]?.messages || []), cancelMessage]
      }
    }));
    
    // Reset states immediately
    setIsCancelling(false);
    setIsHoveringStop(false);
  }, [onCancel, activeChatId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading || isCancelling) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    // Add user message to current chat
    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        messages: [...(prev[activeChatId]?.messages || []), userMessage],
        toolCalls: [] // Clear previous tool calls for this chat
      }
    }));
    
    setMessage('');
    
    // Reset cancellation state for new request
    setIsCancelling(false);
    setIsHoveringStop(false);

    try {
      const response = await onSendMessage(message.trim());
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response,
        timestamp: new Date()
      };

      // Add bot message to current chat
      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...(prev[activeChatId]?.messages || []), botMessage]
        }
      }));
      
      // Update token quota status after successful completion
      if (llmService) {
        // Add a small delay to ensure token cache is fully updated
        setTimeout(() => {
          const updatedQuotaStatus = llmService.getTokenQuotaStatus();
          console.log('Updating token quota status after completion:', updatedQuotaStatus);
          // Force a new object reference to ensure React re-renders
          setTokenQuotaStatus({...updatedQuotaStatus});
        }, 100);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      };

      // Add error message to current chat
      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...(prev[activeChatId]?.messages || []), errorMessage]
        }
      }));
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
      'dependency_analysis': {
        call: '🔍 Analyzing spreadsheet dependencies',
        result: '📊 Dependency layer identified'
      },
    };
    
    return descriptions[toolName]?.[type] || '';
  };





  // Utility functions for cell range merging
  const parseCellAddress = (address) => {
    const match = address.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const [, colStr, rowStr] = match;
    
    // Convert column letters to number (A=1, B=2, ..., Z=26, AA=27, etc.)
    let colNum = 0;
    for (let i = 0; i < colStr.length; i++) {
      colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
    }
    
    return {
      row: parseInt(rowStr),
      col: colNum,
      address: address
    };
  };


  const mergeCellRanges = (addresses) => {
    if (!addresses || addresses.length === 0) return [];
    
    // Parse all addresses
    const parsed = addresses
      .map(parseCellAddress)
      .filter(addr => addr !== null)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    
    if (parsed.length === 0) return addresses;
    
    const ranges = [];
    let currentRange = { start: parsed[0], end: parsed[0] };
    
    for (let i = 1; i < parsed.length; i++) {
      const current = parsed[i];
      const prev = parsed[i - 1];
      
      // Check if cells are adjacent (same row and consecutive columns, or same column and consecutive rows)
      const isAdjacent = (current.row === prev.row && current.col === prev.col + 1) ||
                        (current.col === prev.col && current.row === prev.row + 1);
      
      if (isAdjacent) {
        currentRange.end = current;
      } else {
        // Add current range and start new one
        if (currentRange.start.address === currentRange.end.address) {
          ranges.push(currentRange.start.address);
        } else {
          ranges.push(`${currentRange.start.address}:${currentRange.end.address}`);
        }
        currentRange = { start: current, end: current };
      }
    }
    
    // Add the last range
    if (currentRange.start.address === currentRange.end.address) {
      ranges.push(currentRange.start.address);
    } else {
      ranges.push(`${currentRange.start.address}:${currentRange.end.address}`);
    }
    
    return ranges;
  };

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
      } else if (toolCall.tool === 'dependency_analysis') {
        const cells = toolCall.arguments?.cells || [];
        const mergedCells = mergeCellRanges(cells);
        return [
          `Layer ${toolCall.arguments?.layer || 'N/A'}: ${toolCall.arguments?.layerType || 'Unknown'}`,
          `Cells: ${mergedCells.join(', ') || 'N/A'}`,
          `Frames: ${toolCall.arguments?.horizontalFrames?.join(', ') || 'None'} | ${toolCall.arguments?.verticalFrames?.join(', ') || 'None'}`
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
        const answer = toolCall.result?.answer || 'No answer provided';
        const confidence = toolCall.result?.confidence || 'unknown';
        const sources = toolCall.result?.sources || [];
        return [
          `🎯 Final Answer: ${answer.length > 100 ? answer.substring(0, 100) + '...' : answer}`,
          `🎯 Confidence: ${confidence}`,
          ...(sources.length > 0 ? [`📚 Sources: ${sources.length} references`] : [])
        ];
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
        const window = toolCall.result?.window;
        const range = toolCall.result?.range || 'N/A';
        return [
          `📊 Range: ${range}`,
          `📈 Data loaded: ${window ? 'Yes' : 'No'}`,
          ...(window ? [
            `📏 Size: ${window.length} rows x ${window[0]?.length || 0} columns`,
            `📋 Sample: ${window[0]?.slice(0, 3).join(', ') || 'No data'}`
          ] : []),
          `Next: Analyzing the data to find the answer`
        ];
      } else if (toolCall.tool === 'dependency_analysis') {
        const layer = toolCall.result?.layer || 'N/A';
        const cellCount = toolCall.result?.cellCount || 0;
        const frames = toolCall.result?.frames;
        const cells = toolCall.result?.cells || [];
        const mergedCells = mergeCellRanges(cells);
        return [
          `📊 Layer ${layer} analyzed`,
          `📈 Cells: ${cellCount} cells in this layer`,
          ...(mergedCells.length > 0 ? [`📍 Cell ranges: ${mergedCells.join(', ')}`] : []),
          ...(frames ? [
            `🔗 Horizontal frames: ${frames.horizontal?.join(', ') || 'None'}`,
            `🔗 Vertical frames: ${frames.vertical?.join(', ') || 'None'}`
          ] : []),
          `✅ Layer dependency structure identified`
        ];
      } else {
        return [];
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg">

      {/* Token Usage Display */}
      {tokenQuotaStatus && (
        <div className="bg-gray-50 p-4 rounded-t-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">Token Usage</span>
            <span className="text-xs font-medium text-gray-600">
              {tokenQuotaStatus.used >= 1000 ? `${(tokenQuotaStatus.used / 1000).toFixed(1)}K` : tokenQuotaStatus.used.toLocaleString()}
              {tokenQuotaStatus.limit === Infinity ? ' (unlimited)' : ` / ${tokenQuotaStatus.limit >= 1000 ? `${(tokenQuotaStatus.limit / 1000).toFixed(0)}K` : tokenQuotaStatus.limit.toLocaleString()}`}
            </span>
          </div>
          {/* Only show progress bar for non-test users with limited quota */}
          {tokenQuotaStatus.limit !== Infinity && tokenQuotaStatus.limit > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (tokenQuotaStatus.used / tokenQuotaStatus.limit) * 100)}%` }}
              ></div>
            </div>
          )}
          
          {/* Token limit exceeded warning */}
          {tokenQuotaStatus.hasReachedQuota && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">
                    Token limit reached! Number of tokens used: {tokenQuotaStatus.used.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    <a 
                      href="https://calendly.com/hemisphere/30min" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-red-800 transition-colors"
                    >
                      Click here to increase your limit
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Tabs */}
      <div className="bg-gray-50 px-4 py-0 -mt-px">
        <div className="flex items-center space-x-0.5">
          {Object.values(chats).map((chat) => (
            <div
              key={chat.id}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg transition-colors ${
                activeChatId === chat.id
                  ? 'bg-white text-gray-800'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              <button
                onClick={() => switchToChat(chat.id)}
                className="text-sm font-medium"
              >
                {chat.name}
              </button>
              {Object.keys(chats).length > 1 && (
                <button
                  onClick={() => closeChat(chat.id)}
                  className="ml-1 p-1 hover:bg-gray-300 rounded-full transition-colors"
                  title="Close chat"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addNewChat}
            className="flex items-center px-3 py-2 rounded-t-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
            title="Add new chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 relative rounded-b-lg"
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
            type={isLoading ? "button" : "submit"}
            onClick={isLoading ? handleCancel : undefined}
            disabled={!isLoading && (!message.trim() || isCancelling)}
            onMouseEnter={() => isLoading && setIsHoveringStop(true)}
            onMouseLeave={() => isLoading && setIsHoveringStop(false)}
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center space-x-2 transition-all duration-200 ${
              isLoading 
                ? (isHoveringStop 
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500')
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={isLoading ? (isHoveringStop ? "Click to stop processing" : "Processing...") : "Send message"}
          >
            {isLoading ? (
              isHoveringStop ? (
                <Square className="w-4 h-4" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin" />
              )
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
  onToolCall: PropTypes.func,
  llmService: PropTypes.object,
  onCancel: PropTypes.func,
  onAddBotMessage: PropTypes.func
};

export default ChatInterface;
