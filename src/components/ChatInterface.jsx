import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Send, Bot, User, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const ChatInterface = ({ onSendMessage, isLoading = false, onClearHistory, onToolCall = null }) => {
  const [message, setMessage] = useState('');
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
      setShowScrollButton(!isAtBottom);
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
  }, []);

  useEffect(() => {
    if (onToolCall) {
      // Store the handler so it can be passed to the LLM service
      onToolCall(handleToolCall);
    }
  }, [onToolCall, handleToolCall]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

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

  const formatParameters = (toolCall) => {
    if (toolCall.type === 'tool_call') {
      if (toolCall.tool === 'update_cell') {
        return [
          `Cell: ${toolCall.arguments?.address || 'N/A'}`,
          `New value: ${JSON.stringify(toolCall.arguments?.newValue || 'N/A')}`
        ];
      } else if (toolCall.tool === 'conclude') {
        return [`Answer: ${toolCall.arguments?.answer || 'No answer provided'}`];
      } else if (toolCall.tool === 'find_multi_intersection') {
        return [`Labels: ${toolCall.arguments?.labels?.join(', ') || 'No labels provided'}`];
      } else if (toolCall.tool === 'find_time_series_analysis') {
        return [
          `Value label: ${toolCall.arguments?.value_label || 'No value label provided'}`,
          `Date label: ${toolCall.arguments?.date_label || 'No date label provided'}`,
          `Criteria: ${toolCall.arguments?.criteria || 'No criteria provided'}`
        ];
      } else {
        return Object.entries(toolCall.arguments || {}).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
      }
    } else {
      if (toolCall.result?.error) {
        return [`Error: ${toolCall.result.error}`];
      } else if (toolCall.tool === 'update_cell') {
        return [
          `Cell: ${toolCall.result?.address || 'N/A'}`,
          `New value: ${JSON.stringify(toolCall.result?.newValue || 'N/A')}`
        ];
      } else if (toolCall.tool === 'conclude') {
        return [`Answer: ${toolCall.result?.answer || 'No answer provided'}`];
      } else {
        return ['Success'];
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
                      <span className={`font-medium ${textColor}`}>
                        {toolCall.tool}
                      </span>
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
  onToolCall: PropTypes.func
};

export default ChatInterface;
