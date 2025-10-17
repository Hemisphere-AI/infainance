import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  ChevronDown, 
  ChevronRight, 
  Database,
  Brain,
  Clock,
  Cpu,
  Eye,
  Loader2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
// import { supabase } from '../lib/supabase'; // Unused import
import { formatMarkdown } from '../utils/markdownFormatter';
import { getStatusIcon } from '../utils/statusIcons.jsx';

const CheckResult = ({
  checks = [],
  currentCheckId,
  organizationId,
  // onCheckSelect, // Unused parameter
  // onCreateCheck, // Unused parameter
  onRenameCheck,
  // onDeleteCheck, // Unused parameter
  onToggleCheck,
  onUpdateDescription,
  onUpdateAcceptanceCriteria,
  onRefreshChecks
  // onRunAnalysis, // Unused parameter
  // user // Unused parameter
}) => {
  const [expandedChecks, setExpandedChecks] = useState(new Set());
  const [expandedRecords, setExpandedRecords] = useState(new Set());
  const [checkResults, setCheckResults] = useState({});
  // const [modelMetadata, setModelMetadata] = useState({}); // Unused state
  const [executionSteps, setExecutionSteps] = useState({});
  const [descriptionTexts, setDescriptionTexts] = useState({});
  const [acceptanceCriteriaTexts, setAcceptanceCriteriaTexts] = useState({});
  const [runningChecks, setRunningChecks] = useState(new Set());
  const [editingCheckId, setEditingCheckId] = useState(null);
  const [editingCheckName, setEditingCheckName] = useState('');
  const [odooConfig, setOdooConfig] = useState(null);
  const [checkResultsHistory, setCheckResultsHistory] = useState({});
  const [selectedResultVersion, setSelectedResultVersion] = useState({});

  // Load Odoo configuration
  useEffect(() => {
    const loadOdooConfig = async () => {
      try {
        // Use backend server for full Odoo AI Agent functionality
        const apiBase = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '');
        const response = await fetch(`${apiBase}/api/odoo/config?organizationId=${organizationId}`);
        if (response.ok) {
          const config = await response.json();
          setOdooConfig(config);
        }
      } catch (error) {
        console.error('Failed to load Odoo config:', error);
      }
    };
    
    if (organizationId) {
      loadOdooConfig();
    }
  }, [organizationId]);

  // Load check results history when currentCheckId changes
  useEffect(() => {
    const loadCheckResultsHistory = async () => {
      if (!currentCheckId) return;
      
      try {
        // Use backend server for local development, Netlify Functions for production
        const apiBase = import.meta.env.DEV ? 'http://localhost:3002' : '';
        const response = await fetch(`${apiBase}/api/checks/${currentCheckId}/results`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCheckResultsHistory(prev => ({
              ...prev,
              [currentCheckId]: data.results
            }));
            
            // Set the latest result as selected by default
            if (data.results.length > 0) {
              setSelectedResultVersion(prev => ({
                ...prev,
                [currentCheckId]: data.results[0].id
              }));
            }
          }
        }
      } catch (error) {
        console.error('Failed to load check results history:', error);
      }
    };
    
    loadCheckResultsHistory();
  }, [currentCheckId]);

  // Generate Odoo URL for a record
  const getOdooRecordUrl = useCallback((model, recordId) => {
    if (!odooConfig?.url) {
      return null;
    }
    
    // Ensure URL doesn't end with slash to avoid double slashes
    const baseUrl = odooConfig.url.replace(/\/$/, '');
    
    // Construct the Odoo record URL in the format: /odoo/model/id
    const url = `${baseUrl}/odoo/${model}/${recordId}`;
    return url;
  }, [odooConfig]);

  const handleDescriptionChange = useCallback((checkId, text) => {
    setDescriptionTexts(prev => ({
      ...prev,
      [checkId]: text
    }));
    
    // Auto-save description after a short delay
    if (onUpdateDescription) {
      const timeoutId = setTimeout(() => {
        onUpdateDescription(checkId, text);
      }, 1000); // 1 second delay
      
      return () => clearTimeout(timeoutId);
    }
  }, [onUpdateDescription]);

  const handleAcceptanceCriteriaChange = useCallback((checkId, text) => {
    setAcceptanceCriteriaTexts(prev => ({
      ...prev,
      [checkId]: text
    }));
    
    // Auto-save acceptance criteria after a short delay
    if (onUpdateAcceptanceCriteria) {
      const timeoutId = setTimeout(() => {
        onUpdateAcceptanceCriteria(checkId, text);
      }, 1000); // 1 second delay
      
      return () => clearTimeout(timeoutId);
    }
  }, [onUpdateAcceptanceCriteria]);

  const getTextareaRows = useCallback((text) => {
    if (!text || !text.trim()) return 1;
    const lines = text.split('\n').length;
    return Math.max(1, Math.min(lines, 6)); // Min 1 row, max 6 rows
  }, []);

  const runCheck = async (check) => {
    try {
      const checkId = check.id;
      console.log('🚀 Starting check execution for:', check.name, 'ID:', checkId);
      setRunningChecks(prev => new Set([...prev, checkId]));
      
      // Initialize execution steps
      setExecutionSteps(prev => ({
        ...prev,
        [checkId]: {
          status: 'running',
          steps: [
            { id: 'init', name: 'Initializing check execution', status: 'running' },
            { id: 'connect', name: 'Connecting to Odoo database', status: 'pending' },
            { id: 'query', name: 'Executing database query', status: 'pending' },
            { id: 'analyze', name: 'Analyzing results with LLM', status: 'pending' },
            { id: 'complete', name: 'Check completed', status: 'pending' }
          ]
        }
      }));

      // Step 1: Initialize
      await updateStep(checkId, 'init', 'completed');
      await updateStep(checkId, 'connect', 'running');

      // Step 2: Connect to Odoo
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      await updateStep(checkId, 'connect', 'completed');
      await updateStep(checkId, 'query', 'running');

      // Step 3: Execute AI-driven check via backend API
      // Use backend server URL from environment or default to localhost
      const apiBase = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '');
      console.log('📡 Making API call to:', `${apiBase}/api/odoo/check`);
      console.log('🔧 Using backend server for full Odoo AI Agent functionality');
      console.log('🌍 Environment:', import.meta.env.DEV ? 'development' : 'production');
      console.log('🔗 Backend URL:', apiBase || 'Not configured');
      
      // Check if backend URL is configured in production
      if (!apiBase && !import.meta.env.DEV) {
        console.error('❌ Backend URL not configured in production');
        await updateStep(checkId, 'connect', 'error');
        await updateStep(checkId, 'query', 'pending');
        await updateStep(checkId, 'analyze', 'pending');
        await updateStep(checkId, 'complete', 'pending');
        
        setCheckResults(prev => ({
          ...prev,
          [checkId]: {
            success: false,
            error: 'Backend server not configured. Please set VITE_BACKEND_URL environment variable.',
            connectionError: true,
            count: 0,
            duration: 0,
            tokensUsed: 0,
            llmAnalysis: 'Backend server not configured. Please deploy the backend server and set VITE_BACKEND_URL environment variable.',
            records: [],
            queryPlan: null,
            steps: [],
            executedAt: new Date()
          }
        }));
        
        setExpandedChecks(prev => new Set([...prev, checkId]));
        return;
      }
      
      const requestBody = {
        checkDescription: check.description || 'Analyze this check',
        checkTitle: check.name || 'Custom Check',
        checkId: check.id,
        organizationId: organizationId,
        acceptanceCriteria: check.acceptance_criteria || ''
      };
      
      console.log('📤 Request body:', requestBody);
      
      const response = await fetch(`${apiBase}/api/odoo/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response received:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Backend error response:', errorData);
        
        // Handle connection errors - only mark the connect step as failed, others as pending
        await updateStep(checkId, 'connect', 'error');
        await updateStep(checkId, 'query', 'pending');
        await updateStep(checkId, 'analyze', 'pending');
        await updateStep(checkId, 'complete', 'pending');
        
        // Store error result
        setCheckResults(prev => ({
          ...prev,
          [checkId]: {
            success: false,
            error: errorData.error || `HTTP error! status: ${response.status}`,
            connectionError: true,
            count: 0,
            duration: 0,
            tokensUsed: 0,
            llmAnalysis: errorData.error || 'Connection failed',
            records: [],
            queryPlan: null,
            steps: [],
            executedAt: new Date()
          }
        }));
        
        // Expand the check to show results
        setExpandedChecks(prev => new Set([...prev, checkId]));
        return; // Exit early for connection errors
      }

      const data = await response.json();
      console.log('📊 Response data received:', {
        success: data.success,
        hasResult: !!data.result,
        resultStatus: data.result?.status,
        stepsCount: data.result?.steps?.length
      });
      
      if (!data.success) {
        // Handle API-level errors - mark connect as completed, query as failed, others as pending
        await updateStep(checkId, 'connect', 'completed');
        await updateStep(checkId, 'query', 'error');
        await updateStep(checkId, 'analyze', 'pending');
        await updateStep(checkId, 'complete', 'pending');
        
        // Store error result
        setCheckResults(prev => ({
          ...prev,
          [checkId]: {
            success: false,
            error: data.error || 'Check execution failed',
            connectionError: true,
            count: 0,
            duration: 0,
            tokensUsed: 0,
            llmAnalysis: data.error || 'Check execution failed',
            records: [],
            queryPlan: null,
            steps: [],
            executedAt: new Date()
          }
        }));
        
        // Expand the check to show results
        setExpandedChecks(prev => new Set([...prev, checkId]));
        return; // Exit early for API errors
      }

      // Check for connection errors
      if (data.result.connectionError || (data.result.success === false && data.result.error)) {
        // Handle connection error - mark connect as failed, others as pending
        await updateStep(checkId, 'connect', 'error');
        await updateStep(checkId, 'query', 'pending');
        await updateStep(checkId, 'analyze', 'pending');
        await updateStep(checkId, 'complete', 'pending');
        
        // Store error result
        setCheckResults(prev => ({
          ...prev,
          [checkId]: {
            success: false,
            error: data.result.error,
            connectionError: true,
            count: 0,
            duration: data.result.duration || 0,
            tokensUsed: 0,
            llmAnalysis: data.result.error || 'Connection failed',
            records: [],
            queryPlan: data.result.queryPlan || null,
            steps: data.result.steps || [],
            executedAt: new Date(data.result.timestamp || new Date().toISOString())
          }
        }));
      } else {
        // Update steps based on AI agent response for successful connections
        if (data.result.steps) {
          for (const step of data.result.steps) {
            await updateStep(checkId, step.step, step.status);
            // Add a small delay for better UX
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Store real results from AI agent
        setCheckResults(prev => ({
          ...prev,
          [checkId]: {
            success: data.result.success,
            count: data.result.count,
            duration: data.result.duration,
            tokensUsed: data.result.tokensUsed,
            llmAnalysis: data.result.llmAnalysis,
            records: data.result.records || [],
            queryPlan: data.result.queryPlan,
            steps: data.result.steps,
            executedAt: new Date(data.result.timestamp)
          }
        }));
        
        console.log('✅ Check execution completed successfully:', {
          checkId,
          status: data.result.status,
          count: data.result.count,
          duration: data.result.duration,
          stepsCompleted: data.result.steps?.length || 0
        });
      }

      // Update check status if backend (agent) provided it
      const statusFromAgent = data?.result?.status;
      if (statusFromAgent) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY
          );
          const { error: updateError } = await supabase
            .from('checks')
            .update({ status: statusFromAgent, updated_at: new Date().toISOString() })
            .eq('id', checkId);
          if (updateError) {
            console.error('Failed to update check status:', updateError);
          } else if (onRefreshChecks) {
            onRefreshChecks();
          }
        } catch (err) {
          console.error('Failed to update check status (agent):', err);
        }
      }

      // Expand the check to show results
      setExpandedChecks(prev => new Set([...prev, checkId]));

      // Refresh the results history to include the new result
      try {
        // Use backend server for full Odoo AI Agent functionality
        const apiBase = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '');
        const historyResponse = await fetch(`${apiBase}/api/checks/${checkId}/results`);
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          if (historyData.success) {
            setCheckResultsHistory(prev => ({
              ...prev,
              [checkId]: historyData.results
            }));
            
            // Set the latest result as selected
            if (historyData.results.length > 0) {
              setSelectedResultVersion(prev => ({
                ...prev,
                [checkId]: historyData.results[0].id
              }));
            }
            
            console.log('📚 Results history refreshed:', {
              checkId,
              historyCount: historyData.results.length
            });
          }
        }
      } catch (error) {
        console.error('Failed to refresh results history:', error);
      }

    } catch (error) {
      console.error('Check execution failed:', error);
      setExecutionSteps(prev => ({
        ...prev,
        [check.id]: {
          status: 'error',
          error: error.message
        }
      }));
    } finally {
      console.log('🏁 Check execution finished for:', check.name, 'ID:', check.id);
      setRunningChecks(prev => {
        const newSet = new Set(prev);
        newSet.delete(check.id);
        return newSet;
      });
    }
  };

  const updateStep = async (checkId, stepId, status) => {
    setExecutionSteps(prev => {
      const steps = prev[checkId]?.steps || [];
      const updatedSteps = steps.map(step => 
        step.id === stepId 
          ? { ...step, status }
          : step
      );
      
      return {
        ...prev,
        [checkId]: {
          ...prev[checkId],
          steps: updatedSteps
        }
      };
    });
    
    // Small delay to show step progression
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  const toggleCheckExpansion = (checkId) => {
    setExpandedChecks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(checkId)) {
        newSet.delete(checkId);
      } else {
        newSet.add(checkId);
      }
      return newSet;
    });
  };

  const toggleRecordExpansion = (recordId) => {
    setExpandedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  // Convert milliseconds to hh:mm:ss format
  const formatDuration = (ms) => {
    if (!ms || ms === 0) return '0:00:00';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  const handleToggleCheck = useCallback(async (checkId) => {
    if (onToggleCheck) {
      await onToggleCheck(checkId);
    }
  }, [onToggleCheck]);

  const handleStartEditing = useCallback((check) => {
    setEditingCheckId(check.id);
    setEditingCheckName(check.name);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingCheckId && editingCheckName.trim() && onRenameCheck) {
      await onRenameCheck(editingCheckId, editingCheckName.trim());
    }
    setEditingCheckId(null);
    setEditingCheckName('');
  }, [editingCheckId, editingCheckName, onRenameCheck]);

  const handleCancelEdit = useCallback(() => {
    setEditingCheckId(null);
    setEditingCheckName('');
  }, []);

  const getStepStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'running': return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'pending': return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  // Get the current result based on selected version or latest from checkResults
  const getCurrentResult = (checkId) => {
    const selectedVersionId = selectedResultVersion[checkId];
    const history = checkResultsHistory[checkId] || [];
    
    if (selectedVersionId && history.length > 0) {
      const selectedResult = history.find(r => r.id === selectedVersionId);
      if (selectedResult) {
        return {
          success: selectedResult.success,
          count: selectedResult.record_count,
          duration: selectedResult.duration,
          tokensUsed: selectedResult.tokens_used,
          llmAnalysis: selectedResult.llm_analysis,
          records: selectedResult.records || [],
          queryPlan: selectedResult.query_plan,
          steps: selectedResult.execution_steps,
          executedAt: new Date(selectedResult.executed_at)
        };
      }
    }
    
    // Fallback to current checkResults (for real-time results)
    return checkResults[checkId];
  };

  // Find the current check
  const currentCheck = checks.find(check => check.id === currentCheckId);

  if (!currentCheck) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No check selected</p>
          <p className="text-sm">Select a check from the sidebar to view its details</p>
        </div>
      </div>
    );
  }

  const isExpanded = expandedChecks.has(currentCheck.id);
  const result = getCurrentResult(currentCheck.id);
  const steps = executionSteps[currentCheck.id];
  const isRunning = runningChecks.has(currentCheck.id);
  const descriptionText = descriptionTexts[currentCheck.id] || currentCheck.description || '';
  const acceptanceCriteriaText = acceptanceCriteriaTexts[currentCheck.id] || currentCheck.acceptance_criteria || '';
  const history = checkResultsHistory[currentCheck.id] || [];
  const selectedVersionId = selectedResultVersion[currentCheck.id];

  return (
    <div className="h-full overflow-y-auto">
      <div className="border border-gray-200 rounded-lg bg-white m-4">
        {/* Check Header with Description and Play Button */}
        <div className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleCheckExpansion(currentCheck.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleToggleCheck(currentCheck.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {getStatusIcon(currentCheck.status, 'w-5 h-5')}
                </button>
                {editingCheckId === currentCheck.id ? (
                  <input
                    type="text"
                    value={editingCheckName}
                    onChange={(e) => setEditingCheckName(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    className="font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0 flex-1"
                    autoFocus
                  />
                ) : (
                  <h3 
                    className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                    onDoubleClick={() => handleStartEditing(currentCheck)}
                  >
                    {currentCheck.name}
                  </h3>
                )}
              </div>
              {/* Version Dropdown */}
              {history.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Version:</span>
                  <select
                    value={selectedVersionId || ''}
                    onChange={(e) => setSelectedResultVersion(prev => ({
                      ...prev,
                      [currentCheck.id]: e.target.value
                    }))}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                  >
                    {history.map((result, index) => (
                      <option key={result.id} value={result.id}>
                        {new Date(result.executed_at).toLocaleDateString()} at {new Date(result.executed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {index === 0 && ' (Latest)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {/* Description textarea */}
            <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
              <textarea
                value={descriptionText}
                onChange={(e) => handleDescriptionChange(currentCheck.id, e.target.value)}
                className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-0 resize-none"
                rows={getTextareaRows(descriptionText)}
                placeholder="Enter description for this check..."
              />
            </div>

            {/* Acceptance Criteria textarea */}
            <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
              <textarea
                value={acceptanceCriteriaText}
                onChange={(e) => handleAcceptanceCriteriaChange(currentCheck.id, e.target.value)}
                className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-0 resize-none"
                rows={getTextareaRows(acceptanceCriteriaText)}
                placeholder="Enter acceptance criteria for this check..."
              />
            </div>

            {/* Quick Stats with Run button */}
            <div className="flex items-center justify-between">
              {result && (
                <div className="flex items-center space-x-4 text-sm">
                  {result.connectionError ? (
                    <div className="flex items-center space-x-1 text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Connection failed</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-1">
                        <Database className="w-4 h-4 text-gray-500" />
                        <span>{result.count} records found</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>{formatDuration(result.duration)}</span>
                      </div>
                      {result.tokensUsed && (
                        <div className="flex items-center space-x-1">
                          <Brain className="w-4 h-4 text-gray-500" />
                          <span>{result.tokensUsed} tokens</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {/* Run button */}
              <button
                onClick={() => runCheck(currentCheck)}
                disabled={isRunning}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ width: '100px' }}
                title="Run Check"
              >
                {isRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Run"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t bg-white">
            {/* Execution Steps */}
            {steps && (
              <div className="p-4 border-b">
                <h4 className="font-medium text-gray-900 mb-3">Execution Steps</h4>
                <div className="space-y-2">
                  {steps.steps?.map((step) => (
                    <div key={step.id} className="flex items-center space-x-3">
                      {getStepStatusIcon(step.status)}
                      <span className="text-sm text-gray-700">{step.name}</span>
                    </div>
                  ))}
                  {steps.error && (
                    <div className="text-red-600 text-sm mt-2">
                      Error: {steps.error}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Query Plan */}
            {result?.queryPlan && (
              <div className="p-4 border-b">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Cpu className="w-4 h-4" />
                  <span>AI Query Plan</span>
                </h4>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-700 space-y-2">
                    <div><strong>Model:</strong> <code className="bg-white px-2 py-1 rounded text-xs">{result.queryPlan.model}</code> 
                      <span className="ml-2 text-xs text-gray-500">
                        {result.queryPlan.model === 'account.move' ? '(Invoices/Journals)' : 
                         result.queryPlan.model === 'account.move.line' ? '(Accounting Lines)' :
                         result.queryPlan.model === 'account.bank.statement.line' ? '(Bank Transactions)' :
                         '(Other Records)'}
                      </span>
                    </div>
                    <div><strong>Domain:</strong> <code className="bg-white px-2 py-1 rounded text-xs">{JSON.stringify(result.queryPlan.domain)}</code></div>
                    <div><strong>Fields:</strong> <code className="bg-white px-2 py-1 rounded text-xs">{JSON.stringify(result.queryPlan.fields)}</code></div>
                    {result.queryPlan.reasoning && (
                      <div><strong>Reasoning:</strong> {result.queryPlan.reasoning}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LLM Analysis or Connection Error */}
            {result?.llmAnalysis && (
              <div className="p-4 border-b">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  {result.connectionError ? (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Brain className="w-4 h-4" />
                  )}
                  <span>{result.connectionError ? 'Connection Error' : 'LLM Analysis'}</span>
                </h4>
                <div className={`p-3 rounded-lg ${result.connectionError ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  {result.connectionError ? (
                    <div className="text-red-700">
                      <div className="font-medium mb-2">Unable to connect to Odoo database</div>
                      <div className="text-sm">{result.error}</div>
                      <div className="text-xs text-red-600 mt-2">
                        Please check your Odoo configuration and credentials in Organization Management.
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: formatMarkdown(result.llmAnalysis) 
                        }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Records */}
            {result?.records && result.records.length > 0 && (
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Database className="w-4 h-4" />
                  <span>Records ({result.records.length})</span>
                </h4>
                <div className="space-y-2">
                  {result.records.slice(0, 10).map((record, index) => {
                    const recordId = `${currentCheck.id}-${record.id || index}`;
                    const isRecordExpanded = expandedRecords.has(recordId);

                    return (
                      <div key={recordId} className="border rounded-lg">
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => toggleRecordExpansion(recordId)}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                {isRecordExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            <div>
                              <div className="font-medium text-sm">
                                {record.name || 
                                 (record.ref && record.ref !== false ? record.ref : 
                                  record.partner_id && Array.isArray(record.partner_id) ? record.partner_id[1] :
                                  `Record ${index + 1}`)}
                              </div>
                              <div className="text-xs text-gray-500">
                                ID: {record.id}
                                {result?.queryPlan?.model && getOdooRecordUrl(result.queryPlan.model, record.id) && (
                                  <span className="ml-2">
                                    <a 
                                      href={getOdooRecordUrl(result.queryPlan.model, record.id)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View in Odoo
                                    </a>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                              onClick={() => toggleRecordExpansion(recordId)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Record Details */}
                          {isRecordExpanded && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(record).map(([key, value]) => (
                                  <div key={key} className="flex">
                                    <span className="font-medium text-gray-600 w-24 truncate">
                                      {key}:
                                    </span>
                                    <span className="text-gray-900 truncate">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {result.records.length > 10 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      ... and {result.records.length - 10} more records
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

CheckResult.propTypes = {
  checks: PropTypes.array,
  currentCheckId: PropTypes.string,
  organizationId: PropTypes.string,
  onCheckSelect: PropTypes.func,
  onCreateCheck: PropTypes.func,
  onRenameCheck: PropTypes.func,
  onDeleteCheck: PropTypes.func,
  onToggleCheck: PropTypes.func,
  onUpdateDescription: PropTypes.func,
  onUpdateAcceptanceCriteria: PropTypes.func,
  onRunAnalysis: PropTypes.func,
  onRefreshChecks: PropTypes.func,
  user: PropTypes.object
};

export default CheckResult;