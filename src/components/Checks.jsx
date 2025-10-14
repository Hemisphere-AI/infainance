import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { CheckSquare } from 'lucide-react';
import MCPIntegration from './MCPIntegration';

const Checks = ({
  checks = [],
  currentCheckId,
  onCheckSelect,
  onCreateCheck,
  onRenameCheck,
  onDeleteCheck,
  onToggleCheck,
  onUpdateDescription
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [descriptionText, setDescriptionText] = useState('');

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

  const handleRenameInputBlur = useCallback((e) => {
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

  const handleRunAnalysis = useCallback(async () => {
    if (descriptionText.trim() && currentCheckId && onUpdateDescription) {
      await onUpdateDescription(currentCheckId, descriptionText.trim());
    }
  }, [descriptionText, currentCheckId, onUpdateDescription]);

  const currentCheck = checks.find(check => check.id === currentCheckId);

  // Initialize description text when check changes
  useEffect(() => {
    if (currentCheck) {
      setDescriptionText(currentCheck.description || '');
    }
  }, [currentCheck]);

  return (
    <div className="flex h-full">
      <div className="w-full flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          {currentCheck ? (
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
                  <CheckSquare className="w-5 h-5 text-blue-600" />
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
          ) : (
            <h2 className="text-lg font-semibold text-gray-800">Checks</h2>
          )}
        </div>

        {/* Check Details */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentCheck ? (
            <div className="space-y-4">
              {/* Description Input */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={descriptionText}
                  onChange={handleDescriptionChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder="Enter description for this check (e.g., Crediteuren met een debetsaldo, Leveranciersfacturen in concept, etc.)"
                />
              </div>


              {/* MCP Integration - Show results if check has description */}
              {currentCheck.description && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <MCPIntegration
                    check={currentCheck}
                    onAnalysisComplete={(result) => console.log('MCP Analysis Complete:', result)}
                  />
                </div>
              )}
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
    status: PropTypes.oneOf(['active', 'completed', 'cancelled']).isRequired,
    created_at: PropTypes.string.isRequired,
    updated_at: PropTypes.string.isRequired
  })).isRequired,
  currentCheckId: PropTypes.string,
  onCheckSelect: PropTypes.func.isRequired,
  onCreateCheck: PropTypes.func.isRequired,
  onRenameCheck: PropTypes.func.isRequired,
  onDeleteCheck: PropTypes.func,
  onToggleCheck: PropTypes.func.isRequired,
  onUpdateDescription: PropTypes.func.isRequired
};

export default Checks;