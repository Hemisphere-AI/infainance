import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Send, Bot, User, Loader2, Square, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Plus, X } from 'lucide-react';

const ChatInterface = ({ onSendMessage, isLoading = false, onToolCall = null, onCancel = null, onAddBotMessage = null, isCollapsed = false, onToggleCollapse = null }) => {
  const [message, setMessage] = useState('');
  
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
      'conclude': {
        call: '🎯 Providing final answer',
        result: 'Answer concluded'
      },
      'read_cell': {
        call: '📖 Reading cell value',
        result: '📄 Cell value retrieved'
      },
      'update_cell': {
        call: '✏️ Updating cell value',
        result: 'Cell updated'
      },
    };
    
    return descriptions[toolName]?.[type] || '';
  };








  const formatParameters = (toolCall) => {
    if (toolCall.type === 'tool_call') {
      if (toolCall.tool === 'conclude') {
        return [`Answer: ${toolCall.arguments?.answer || 'No answer provided'}`];
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
      } else {
        return Object.entries(toolCall.arguments || {}).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
      }
    } else {
      if (toolCall.result?.error) {
        return [`❌ Error: ${toolCall.result.error}`];
      } else if (toolCall.tool === 'conclude') {
        const answer = toolCall.result?.answer || 'No answer provided';
        const confidence = toolCall.result?.confidence || 'unknown';
        const sources = toolCall.result?.sources || [];
        const acceptanceCriteria = toolCall.result?.acceptance_criteria || 'No acceptance criteria provided';
        const status = toolCall.result?.status || 'unknown';
        return [
          `🎯 Final Answer: ${answer.length > 100 ? answer.substring(0, 100) + '...' : answer}`,
          `🎯 Confidence: ${confidence}`,
          `📋 Acceptance Criteria: ${acceptanceCriteria.length > 100 ? acceptanceCriteria.substring(0, 100) + '...' : acceptanceCriteria}`,
          `📊 Status: ${status}`,
          ...(sources.length > 0 ? [`📚 Sources: ${sources.length} references`] : [])
        ];
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
      } else {
        return [];
      }
    }
  };

  return (
    <div className="flex h-full">
      {/* Collapsed Chat (10px) */}
      <div className={`w-2.5 flex flex-col items-center py-0.5 transition-all duration-300 ${
        isCollapsed ? 'flex' : 'hidden'
      }`}>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="px-1 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Open chat"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded Chat */}
      <div className={`w-full lg:w-80 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'hidden' : 'flex'
      }`}>
        {/* Chat Tabs */}
        <div className="px-4 pt-2 pb-0">
          <div className="flex items-end justify-between">
            <div className="flex items-end space-x-0.5">
              {Object.values(chats).map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg border border-gray-200 transition-colors relative ${
                    activeChatId === chat.id
                      ? 'bg-white text-gray-800 border-b-0 -mb-px z-10'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300 border-b border-gray-200'
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
                className="flex items-center px-3 py-2 rounded-t-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors border border-gray-200 border-b border-gray-200"
                title="Add new chat"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {/* Collapse Button - positioned on the right side of the header */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Close chat"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* White Content Area with Border */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
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
        <div className="p-4 border-t border-gray-200 bg-white">
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
  onAddBotMessage: PropTypes.func,
  isCollapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func
};

export default ChatInterface;
