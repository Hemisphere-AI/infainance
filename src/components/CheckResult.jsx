import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.js';
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

  // Auto-expand the current check when it changes
  useEffect(() => {
    if (currentCheckId && !expandedChecks.has(currentCheckId)) {
      setExpandedChecks(prev => new Set([...prev, currentCheckId]));
    }
  }, [currentCheckId, expandedChecks]);

  // Auto-expand check if it has results (from history or current run)
  useEffect(() => {
    if (currentCheckId) {
      const hasResults = checkResults[currentCheckId] || 
                        (checkResultsHistory[currentCheckId] && checkResultsHistory[currentCheckId].length > 0);
      
      if (hasResults && !expandedChecks.has(currentCheckId)) {
        setExpandedChecks(prev => new Set([...prev, currentCheckId]));
      }
    }
  }, [currentCheckId, checkResults, checkResultsHistory, expandedChecks]);

  // Load Odoo configuration
  useEffect(() => {
    const loadOdooConfig = async () => {
      try {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.ODOO_CONFIG}?organizationId=${organizationId}`));
        if (response.ok) {
          const config = await response.json();
          console.log('🔧 Loaded Odoo config:', config);
          setOdooConfig(config);
        } else {
          console.error('❌ Failed to load Odoo config:', response.status, response.statusText);
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
        const response = await fetch(buildApiUrl(API_ENDPOINTS.CHECK_RESULTS(currentCheckId)));
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const results = data.results || [];
            console.log('📋 Loaded check results history:', {
              checkId: currentCheckId,
              resultCount: results.length,
              results: results.map(result => ({
                id: result.id,
                status: result.status,
                recordCount: result.records?.length || 0,
                executedAt: result.executed_at,
                model: result.query_plan?.model
              }))
            });
            setCheckResultsHistory(prev => ({
              ...prev,
              [currentCheckId]: results
            }));
            
            // Set the latest result as selected
            if (results.length > 0) {
              setSelectedResultVersion(prev => ({
                ...prev,
                [currentCheckId]: results[0].id
              }));
            }
          }
        } else {
          console.error('❌ Failed to load check results history:', response.status, response.statusText);
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
    
    // Validate record ID
    if (!recordId || recordId === 'undefined' || recordId === 'null') {
      return null;
    }
    
    // Ensure URL doesn't end with slash to avoid double slashes
    const baseUrl = odooConfig.url.replace(/\/$/, '');
    
    // Construct the correct Odoo record URL format: /web#id=X&model=Y&view_type=form
    const url = `${baseUrl}/web#id=${recordId}&model=${model}&view_type=form`;
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

      // Step 3: Execute AI-driven check using the current check's description
      const apiUrl = buildApiUrl('/api/odoo/check');
      
      // Use the AI agent to generate query based on current check description
      const requestBody = {
        checkDescription: check.description || '',
        checkTitle: check.name,
        checkId: check.id,
        organizationId: organizationId,
        acceptanceCriteria: check.acceptance_criteria || ''
      };
      
      
      let response;
      try {
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error('⏰ Request timed out after 30 seconds');
          throw new Error('Request timed out. Please try again.');
        }
        throw error;
      }


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

      const responseData = await response.json();

      // Extract the actual result from the nested response
      const data = responseData.result || responseData;
      
      // Handle the /api/odoo/check response format
      if (!data.success) {
        await updateStep(checkId, 'connect', 'completed');
        await updateStep(checkId, 'query', 'error');
        await updateStep(checkId, 'analyze', 'pending');
        await updateStep(checkId, 'complete', 'pending');
        
        setCheckResults(prev => ({
          ...prev,
          [checkId]: {
            success: false,
            error: data.error || 'Check execution failed',
            connectionError: false,
            count: 0,
            duration: data.duration || 0,
            tokensUsed: data.tokensUsed || 0,
            llmAnalysis: data.llmAnalysis || 'Check execution failed',
            records: [],
            queryPlan: data.queryPlan,
            steps: [
              { step: 'connect', status: 'completed' },
              { step: 'query', status: 'error' },
              { step: 'analyze', status: 'pending' },
              { step: 'complete', status: 'pending' }
            ],
            executedAt: new Date()
          }
        }));
        
        setExpandedChecks(prev => new Set([...prev, checkId]));
        return;
      }

      
      // Handle successful AI-driven response
      await updateStep(checkId, 'query', 'completed');
      await updateStep(checkId, 'analyze', 'completed');
      await updateStep(checkId, 'complete', 'completed');

      // Store results from AI-driven check
      
      setCheckResults(prev => ({
        ...prev,
        [checkId]: {
          success: data.success,
          count: data.count || 0,
          duration: data.duration || 0,
          tokensUsed: data.tokensUsed || 0,
          llmAnalysis: data.llmAnalysis || `Found ${data.count || 0} records matching the check criteria.`,
          records: data.records || data.data || [], // Use records field, fallback to data
          queryPlan: data.query,
          recordEvaluations: data.recordEvaluations || [], // Per-record status evaluations
          steps: [
            { step: 'connect', status: 'completed' },
            { step: 'query', status: 'completed' },
            { step: 'analyze', status: 'completed' },
            { step: 'complete', status: 'completed' }
          ],
          executedAt: new Date()
        }
      }));
      

      // Update check status using LLM-determined status (not hardcoded count-based logic)
      // The LLM analyzes acceptance criteria and determines if it's met
      const checkStatus = data.status || 'unknown'; // Use LLM status, fallback to 'unknown'
      console.log('🎯 Frontend: Using LLM-determined status:', checkStatus, 'from data.status:', data.status, 'recordEvaluations:', data.recordEvaluations?.length || 0);
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );
        const { error: updateError } = await supabase
          .from('checks')
          .update({ status: checkStatus, updated_at: new Date().toISOString() })
          .eq('id', checkId);
        if (updateError) {
          console.error('Failed to update check status:', updateError);
        } else if (onRefreshChecks) {
          onRefreshChecks();
        }
      } catch (err) {
        console.error('Failed to update check status:', err);
      }

      // Expand the check to show results
      setExpandedChecks(prev => new Set([...prev, checkId]));

      // Refresh the results history to include the new result
      try {
        const historyResponse = await fetch(buildApiUrl(API_ENDPOINTS.CHECK_RESULTS(checkId)));
        
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
    // First priority: use live results from current run (ensures UI reflects latest execution)
    if (checkResults[checkId]) {
      return checkResults[checkId];
    }

    const selectedVersionId = selectedResultVersion[checkId];
    const history = checkResultsHistory[checkId] || [];
    
    // If a specific version is selected from dropdown, use that
    if (selectedVersionId && history.length > 0) {
      const selectedResult = history.find(r => r.id === selectedVersionId);
      if (selectedResult) {
        // Extract recordEvaluations from result_data if stored there
        const recordEvaluations = selectedResult.record_evaluations || 
                                  (selectedResult.result_data?.recordEvaluations) ||
                                  (typeof selectedResult.llm_analysis === 'object' && selectedResult.llm_analysis?.recordEvaluations) ||
                                  [];
        
        return {
          success: selectedResult.success,
          count: selectedResult.record_count,
          duration: selectedResult.duration,
          tokensUsed: selectedResult.tokens_used,
          llmAnalysis: selectedResult.llm_analysis,
          records: selectedResult.records || [],
          queryPlan: selectedResult.query_plan,
          recordEvaluations: recordEvaluations, // Include per-record evaluations
          steps: selectedResult.execution_steps,
          executedAt: new Date(selectedResult.executed_at)
        };
      }
    }
    
    // Fallback: latest from history if available
    if (history.length > 0) {
      const latest = history[0];
      // Extract recordEvaluations from result_data if stored there
      const recordEvaluations = latest.record_evaluations || 
                                (latest.result_data?.recordEvaluations) ||
                                (typeof latest.llm_analysis === 'object' && latest.llm_analysis?.recordEvaluations) ||
                                [];
      
      return {
        success: latest.success,
        count: latest.record_count,
        duration: latest.duration,
        tokensUsed: latest.tokens_used,
        llmAnalysis: latest.llm_analysis,
        records: latest.records || [],
        queryPlan: latest.query_plan,
        recordEvaluations: recordEvaluations, // Include per-record evaluations
        steps: latest.execution_steps,
        executedAt: new Date(latest.executed_at)
      };
    }

    return null; // No result found
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

            {/* Records - Always show when result exists, show ALL records by default */}
            {result && (
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Database className="w-4 h-4" />
                  <span>Records Found ({result.records?.length || 0})</span>
                </h4>
                {result.records && result.records.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    // Always show ALL records found by AI Query Plan - no limit
                    const recordsToShow = result.records;
                    console.log('📋 Displaying records:', recordsToShow.length, 'total records');
                    return recordsToShow.map((record, index) => {
                    const recordId = `${currentCheck.id}-${record.id || index}`;
                    const isRecordExpanded = expandedRecords.has(recordId);
                    
                    // Find evaluation for this record
                    const evaluation = (result.recordEvaluations || []).find(e => e.recordId === record.id);
                    const recordStatus = evaluation?.status || 'unknown';
                    const recordStatusReason = evaluation?.reason || 'No evaluation available';

                    return (
                      <div key={recordId} className={`border rounded-lg ${recordStatus === 'failed' ? 'border-red-200 bg-red-50' : recordStatus === 'passed' ? 'border-green-200 bg-green-50' : recordStatus === 'warning' ? 'border-orange-200 bg-orange-50' : ''}`}>
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
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
                              {/* Record Status Icon */}
                              <div className="flex-shrink-0" title={recordStatusReason}>
                                {getStatusIcon(recordStatus, 'w-5 h-5')}
                              </div>
                            <div className="flex-1">
                            <div className="font-medium text-sm">
                              {record.move_id_name || 
                               record.name || 
                               (record.ref && record.ref !== false ? record.ref : 
                                record.partner_id && Array.isArray(record.partner_id) ? record.partner_id[1] :
                                `Record ${index + 1}`)}
                            </div>
                              <div className="text-xs text-gray-500">
                                ID: {record.id}
                                {(() => {
                                  const odooUrl = result?.queryPlan?.model ? getOdooRecordUrl(result.queryPlan.model, record.id) : null;
                                  return odooUrl && (
                                    <span className="ml-2">
                                      <a 
                                        href={odooUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          console.log('🔗 Opening Odoo record:', {
                                            recordId: record.id,
                                            model: result.queryPlan.model,
                                            url: odooUrl,
                                            recordName: record.name || record.display_name || 'No name',
                                            timestamp: new Date().toISOString()
                                          });
                                        }}
                                      >
                                        View in Odoo
                                      </a>
                                    </span>
                                  );
                                })()}
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
                              {/* Evaluation Status and Reason */}
                              {evaluation && (
                                <div className="mb-3 p-2 bg-gray-50 rounded">
                                  <div className="flex items-center space-x-2 mb-1">
                                    {getStatusIcon(recordStatus, 'w-4 h-4')}
                                    <span className="text-sm font-medium">
                                      Status: {recordStatus}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {recordStatusReason}
                                  </div>
                                </div>
                              )}
                              {/* Record Fields */}
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
                  })})()}
                </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <p>No records found</p>
                  </div>
                )}
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