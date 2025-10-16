import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Square, Plus, ChevronLeft, ChevronRight, Building2, ChevronDown, ChevronRight as ChevronRightIcon, X } from 'lucide-react';
import { getStatusIcon } from '../utils/statusIcons.jsx';

// TODO: Enable tooltip when multiple components
const Sidebar = ({ 
  organizations = [],
  checks = [], 
  currentCheckId,
  currentOrganizationId,
  onOrganizationSelect,
  onCheckSelect, 
  onCreateOrganization,
  onCreateCheck, 
  onRenameOrganization,
  onRenameCheck,
  onDeleteOrganization,
  onDeleteCheck,
  onToggleCheck,
  onLoadOrganizationChecks,
  isOpen = false,
  onToggle 
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [expandedOrganizations, setExpandedOrganizations] = useState(new Set());

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

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleRenameSave();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSave, handleRenameCancel]);

  const handleDelete = useCallback((e, checkId) => {
    e.stopPropagation();
    if (onDeleteCheck) {
      onDeleteCheck(checkId);
    }
  }, [onDeleteCheck]);

  const handleDeleteOrganization = useCallback((e, organizationId) => {
    e.stopPropagation();
    if (onDeleteOrganization) {
      onDeleteOrganization(organizationId);
    }
  }, [onDeleteOrganization]);

  const handleOrganizationToggle = useCallback((organizationId) => {
    setExpandedOrganizations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(organizationId)) {
        newSet.delete(organizationId);
      } else {
        newSet.add(organizationId);
        // Load checks for this organization when expanding
        if (onLoadOrganizationChecks) {
          onLoadOrganizationChecks(organizationId);
        }
      }
      return newSet;
    });
  }, [onLoadOrganizationChecks]);

  const handleOrganizationRenameStart = useCallback((e, organization) => {
    e.stopPropagation();
    setEditingId(`org-${organization.id}`);
    setEditingName(organization.name);
  }, []);

  const handleOrganizationRenameSave = useCallback(async () => {
    if (editingName.trim() && editingId && editingId.startsWith('org-') && onRenameOrganization) {
      const organizationId = editingId.replace('org-', '');
      await onRenameOrganization(organizationId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  }, [editingName, editingId, onRenameOrganization]);

  const handleOrganizationRenameCancel = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

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
          {organizations.slice(0, 3).map((organization) => {
            const orgChecks = checks.filter(check => check.organization_id === organization.id);
            const isOrgExpanded = expandedOrganizations.has(organization.id);
            const shouldShowChecks = isOrgExpanded && orgChecks.length > 0;
            
            return (
              <div key={organization.id} className="flex flex-col items-center space-y-1">
                {/* Organization button */}
                <button
                  onClick={() => onOrganizationSelect && onOrganizationSelect(organization.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    currentOrganizationId === organization.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'hover:bg-gray-100'
                  }`}
                  title={organization.name}
                >
                  <Building2 className="w-5 h-5 text-gray-500" />
                </button>
                
                {/* Check icons below organization */}
                {shouldShowChecks && (
                  <div className="flex flex-col items-center space-y-1">
                    {orgChecks.map((check) => {
                      const icon = getStatusIcon(check.status, 'w-4 h-4');
                      const displayIcon = icon || <Square className="w-4 h-4 text-blue-600" />;
                      
                      return (
                        <button
                          key={check.id}
                          onClick={() => onCheckSelect && onCheckSelect(check.id)}
                          className={`p-1 rounded transition-colors ${
                            currentCheckId === check.id
                              ? 'bg-blue-100'
                              : 'hover:bg-gray-100'
                          }`}
                          title={`${check.name} - ${check.status || 'open'}`}
                        >
                          {displayIcon}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          <button
            onClick={onCreateOrganization}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Add new organization"
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

        {/* Organizations and Checks List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 flex flex-col" style={{ gap: '2px' }}>
            {organizations.map((organization) => {
              const isExpanded = expandedOrganizations.has(organization.id);
              const organizationChecks = checks.filter(check => check.organization_id === organization.id);
              
              return (
                <div key={organization.id} className="space-y-1">
                  {/* Organization Header */}
                  <div
                    className={`group relative flex items-center space-x-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      currentOrganizationId === organization.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    onClick={() => onOrganizationSelect && onOrganizationSelect(organization.id)}
                    onMouseEnter={() => setHoveredId(`org-${organization.id}`)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOrganizationToggle(organization.id);
                      }}
                      className="flex-shrink-0 p-1 hover:bg-blue-100 rounded transition-colors"
                      title="Toggle organization"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    <Building2 className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingId === `org-${organization.id}` ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={handleOrganizationRenameSave}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleOrganizationRenameSave();
                            } else if (e.key === 'Escape') {
                              handleOrganizationRenameCancel();
                            }
                          }}
                          className="w-full text-sm font-medium bg-transparent border-none outline-none focus:ring-0"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div
                          className="text-sm font-medium text-gray-800 truncate"
                          onDoubleClick={(e) => handleOrganizationRenameStart(e, organization)}
                          title="Double-click to rename"
                        >
                          {organization.name}
                        </div>
                      )}
                    </div>
                    
                    {/* Delete button - only show on hover */}
                    {hoveredId === `org-${organization.id}` && editingId !== `org-${organization.id}` && (
                      <button
                        onClick={(e) => handleDeleteOrganization(e, organization.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-red-500 rounded transition-all duration-200"
                        title="Delete organization"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  {/* Organization Checks */}
                  {isExpanded && (
                    <div className="ml-6 space-y-1">
                      {organizationChecks.map((check) => (
                        <div
                          key={check.id}
                          className={`group relative flex items-center space-x-2 p-1 rounded-lg cursor-pointer transition-colors ${
                            currentCheckId === check.id
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                          onClick={() => onCheckSelect(check.id)}
                          onMouseEnter={() => setHoveredId(check.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleCheck) {
                                onToggleCheck(check.id);
                              }
                            }}
                            className="flex-shrink-0 p-1 hover:bg-blue-100 rounded transition-colors"
                            title="Toggle check status"
                          >
                            {getStatusIcon(check.status, 'w-4 h-4')}
                          </button>
                          <div className="flex-1 min-w-0">
                            {editingId === check.id ? (
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
                                onDoubleClick={(e) => handleRenameStart(e, check)}
                                title="Double-click to rename"
                              >
                                {check.name}
                              </div>
                            )}
                          </div>
                          
                          {/* Delete button - only show on hover */}
                          {hoveredId === check.id && editingId !== check.id && (
                            <button
                              onClick={(e) => handleDelete(e, check.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-red-500 rounded transition-all duration-200"
                              title="Delete check"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      
                      {/* Add New Check for this organization */}
                      <button
                        onClick={() => onCreateCheck && onCreateCheck(organization.id)}
                        className="w-full flex items-center space-x-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm">Add check</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Add New Organization - positioned after the list */}
            <button
              onClick={onCreateOrganization}
              className="w-full flex items-center space-x-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Organization</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Sidebar.propTypes = {
  organizations: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    created_at: PropTypes.string,
    updated_at: PropTypes.string
  })).isRequired,
  checks: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    status: PropTypes.oneOf(['active', 'completed', 'cancelled', 'passed', 'failed', 'unknown', 'warning']).isRequired,
    organization_id: PropTypes.string.isRequired
  })).isRequired,
  currentCheckId: PropTypes.string,
  currentOrganizationId: PropTypes.string,
  onOrganizationSelect: PropTypes.func,
  onCheckSelect: PropTypes.func.isRequired,
  onCreateOrganization: PropTypes.func,
  onCreateCheck: PropTypes.func,
  onRenameOrganization: PropTypes.func,
  onRenameCheck: PropTypes.func.isRequired,
  onDeleteOrganization: PropTypes.func,
  onDeleteCheck: PropTypes.func,
  onToggleCheck: PropTypes.func.isRequired,
  onLoadOrganizationChecks: PropTypes.func,
  isOpen: PropTypes.bool,
  onToggle: PropTypes.func.isRequired
};

export default Sidebar;
