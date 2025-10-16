import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { CheckSquare } from 'lucide-react';
import MCPIntegration from './MCPIntegration';
import { getStatusIcon } from '../utils/statusIcons.jsx';

const Checks = ({
  checks = [],
  currentCheckId,
  // onCheckSelect, // Unused parameter
  // onCreateCheck, // Unused parameter
  onRenameCheck,
  // onDeleteCheck, // Unused parameter
  onToggleCheck,
  onUpdateDescription,
  onUpdateAcceptanceCriteria
  // onRunAnalysis // Unused parameter
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [acceptanceCriteriaText, setAcceptanceCriteriaText] = useState('');
  const [analyzeCheckFunction, setAnalyzeCheckFunction] = useState(null);

  const handleRenameStart = useCallback((e, check) => {
    e.stopPropagation();
    setEditingId(check.id);
    setEditingName(check.name);
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (editingName.trim() && editingId && onRenameCheck) {
      await onRenameCheck(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  }, [editingName, editingId, onRenameCheck]);

  const handleRenameCancel = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  const handleRenameInputBlur = useCallback(() => {
    setTimeout(() => {
      if (editingId) {
        handleRenameSave();
      }
    }, 150);
  }, [editingId, handleRenameSave]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleRenameSave();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSave, handleRenameCancel]);

  const handleDescriptionChange = useCallback((e) => {
    setDescriptionText(e.target.value);
  }, []);

  const handleAcceptanceCriteriaChange = useCallback((e) => {
    setAcceptanceCriteriaText(e.target.value);
    
    // Auto-save acceptance criteria after a short delay
    if (onUpdateAcceptanceCriteria && currentCheckId) {
      const timeoutId = setTimeout(() => {
        onUpdateAcceptanceCriteria(currentCheckId, e.target.value);
      }, 1000); // 1 second delay
      
      return () => clearTimeout(timeoutId);
    }
  }, [onUpdateAcceptanceCriteria, currentCheckId]);

  // Calculate dynamic rows for textarea - only expand on Enter key
  const getTextareaRows = useCallback((text) => {
    if (!text || !text.trim()) return 1;
    const lines = text.split('\n').length;
    return Math.max(1, Math.min(lines, 6)); // Min 1 row, max 6 rows
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    if (descriptionText.trim() && currentCheckId && onUpdateDescription) {
      await onUpdateDescription(currentCheckId, descriptionText.trim());
    }
    
    // Trigger analysis using the analyzeCheck function from MCPIntegration
    if (analyzeCheckFunction && typeof analyzeCheckFunction === 'function') {
      try {
        await analyzeCheckFunction();
      } catch (error) {
        console.error('Error running analysis:', error);
      }
    }
  }, [descriptionText, currentCheckId, onUpdateDescription, analyzeCheckFunction]);

  const handleHeaderToggleCheck = useCallback(async () => {
    if (currentCheckId && onToggleCheck) {
      await onToggleCheck(currentCheckId);
    }
  }, [currentCheckId, onToggleCheck]);

  const currentCheck = checks.find(check => check.id === currentCheckId);


  // Initialize description text when check changes
  useEffect(() => {
    if (currentCheck) {
      setDescriptionText(currentCheck.description || '');
      setAcceptanceCriteriaText(currentCheck.acceptance_criteria || '');
    }
  }, [currentCheck]);

  return (
    <div className="flex h-full">
      <div className="w-full flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          {currentCheck ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {editingId === currentCheck.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleRenameInputBlur}
                      onKeyDown={handleKeyPress}
                      className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-0"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleHeaderToggleCheck}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                        title={`Check status: ${currentCheck.status || 'open'}`}
                      >
                        {getStatusIcon(currentCheck.status, 'w-5 h-5')}
                      </button>
                      <h2
                        className="text-lg font-semibold text-gray-800 cursor-pointer"
                        onDoubleClick={(e) => handleRenameStart(e, currentCheck)}
                        title="Double-click to rename"
                      >
                        {currentCheck.name}
                      </h2>
                    </div>
                  )}
                </div>
              </div>
              {/* Description text block with play button */}
              <div className="flex items-center space-x-2">
                <div className="flex-1 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                  <textarea
                    value={descriptionText}
                    onChange={handleDescriptionChange}
                    className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-0 resize-none"
                    rows={getTextareaRows(descriptionText)}
                    placeholder="Enter description for this check..."
                  />
                </div>
                {/* Run button for all checks */}
                <button
                  onClick={handleRunAnalysis}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center flex-shrink-0 text-sm font-semibold shadow-lg border-2 border-blue-800"
                  title="Run Analysis"
                  style={{ minWidth: '80px', zIndex: 10 }}
                  onMouseEnter={() => console.log('Run button hovered')}
                >
                  Run
                </button>
              </div>

              {/* Acceptance Criteria text block */}
              <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                <textarea
                  value={acceptanceCriteriaText}
                  onChange={handleAcceptanceCriteriaChange}
                  className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-0 resize-none"
                  rows={getTextareaRows(acceptanceCriteriaText)}
                  placeholder="Enter acceptance criteria for this check..."
                />
              </div>
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-gray-800">Checks</h2>
          )}
        </div>

        {/* Check Details */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentCheck ? (
            <div className="space-y-4">
              {/* Single MCP Integration component */}
              <MCPIntegration
                check={currentCheck}
                onAnalysisComplete={(result) => console.log('MCP Analysis Complete:', result)}
                onRunAnalysis={setAnalyzeCheckFunction}
              />
            </div>
          ) : (
            // Empty State
            checks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">No checks yet</p>
                <p className="text-xs text-gray-400 mt-1">Create a check to get started</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

Checks.propTypes = {
  checks: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    status: PropTypes.oneOf(['active', 'completed', 'cancelled', 'passed', 'failed', 'unknown', 'warning']).isRequired,
    created_at: PropTypes.string.isRequired,
    updated_at: PropTypes.string.isRequired
  })).isRequired,
  currentCheckId: PropTypes.string,
  onCheckSelect: PropTypes.func.isRequired,
  onCreateCheck: PropTypes.func.isRequired,
  onRenameCheck: PropTypes.func.isRequired,
  onDeleteCheck: PropTypes.func,
  onToggleCheck: PropTypes.func.isRequired,
  onUpdateDescription: PropTypes.func.isRequired,
  onUpdateAcceptanceCriteria: PropTypes.func,
  onRunAnalysis: PropTypes.func
};

export default Checks;