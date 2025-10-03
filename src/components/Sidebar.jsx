import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FileSpreadsheet, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';

const Sidebar = ({ 
  spreadsheets = [], 
  currentSpreadsheetId, 
  onSpreadsheetSelect, 
  onCreateSpreadsheet, 
  onRenameSpreadsheet,
  onDeleteSpreadsheet,
  isOpen = false,
  onToggle 
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [hoveredId, setHoveredId] = useState(null);

  const handleRenameStart = useCallback((e, spreadsheet) => {
    e.stopPropagation();
    setEditingId(spreadsheet.id);
    setEditingName(spreadsheet.name);
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (editingName.trim() && editingId && onRenameSpreadsheet) {
      await onRenameSpreadsheet(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  }, [editingName, editingId, onRenameSpreadsheet]);

  const handleRenameCancel = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleRenameSave();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSave, handleRenameCancel]);

  const handleDelete = useCallback((e, spreadsheetId) => {
    e.stopPropagation();
    if (onDeleteSpreadsheet) {
      onDeleteSpreadsheet(spreadsheetId);
    }
  }, [onDeleteSpreadsheet]);

  return (
    <div className="flex h-full">
      {/* Collapsed Sidebar (50px) */}
      <div className={`w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 transition-all duration-300 ${
        isOpen ? 'hidden' : 'flex'
      }`}>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Open sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        
        <div className="flex-1 flex flex-col items-center space-y-2 mt-4">
          {spreadsheets.slice(0, 5).map((spreadsheet) => (
            <button
              key={spreadsheet.id}
              onClick={() => onSpreadsheetSelect(spreadsheet.id)}
              className={`p-2 rounded-lg transition-colors ${
                currentSpreadsheetId === spreadsheet.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-gray-100'
              }`}
              title={spreadsheet.name}
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
            </button>
          ))}
          
          <button
            onClick={onCreateSpreadsheet}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Add new spreadsheet"
          >
            <Plus className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Expanded Sidebar */}
      <div className={`w-64 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
        isOpen ? 'flex' : 'hidden'
      }`}>
        {/* Header with close button */}
        <div className="p-3 flex items-center justify-between">
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Close sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Spreadsheet List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {spreadsheets.map((spreadsheet) => (
              <div
                key={spreadsheet.id}
                className={`group relative flex items-center space-x-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  currentSpreadsheetId === spreadsheet.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
                onClick={() => onSpreadsheetSelect(spreadsheet.id)}
                onMouseEnter={() => setHoveredId(spreadsheet.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingId === spreadsheet.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleRenameSave}
                      onKeyDown={handleKeyPress}
                      className="w-full text-sm font-medium bg-transparent border-none outline-none focus:ring-0"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      className="text-sm font-medium text-gray-800 truncate"
                      onDoubleClick={(e) => handleRenameStart(e, spreadsheet)}
                      title="Double-click to rename"
                    >
                      {spreadsheet.name}
                    </div>
                  )}
                </div>
                
                {/* Delete button - only show on hover */}
                {hoveredId === spreadsheet.id && editingId !== spreadsheet.id && (
                  <button
                    onClick={(e) => handleDelete(e, spreadsheet.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-red-500 rounded transition-all duration-200"
                    title="Delete spreadsheet"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            
            {/* Add New Spreadsheet - positioned after the list */}
            <button
              onClick={onCreateSpreadsheet}
              className="w-full flex items-center space-x-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add new</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Sidebar.propTypes = {
  spreadsheets: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  })).isRequired,
  currentSpreadsheetId: PropTypes.string,
  onSpreadsheetSelect: PropTypes.func.isRequired,
  onCreateSpreadsheet: PropTypes.func.isRequired,
  onRenameSpreadsheet: PropTypes.func.isRequired,
  onDeleteSpreadsheet: PropTypes.func,
  isOpen: PropTypes.bool,
  onToggle: PropTypes.func.isRequired
};

export default Sidebar;
