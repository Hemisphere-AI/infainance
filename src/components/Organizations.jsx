import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Building2, Plus, Trash2, Edit2 } from 'lucide-react';
import ContentBlock from './ContentBlock';
import organizationService from '../services/organizationService';

const Organizations = ({
  organizations = [],
  currentOrganizationId,
  onRenameOrganization,
  user
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [integrations, setIntegrations] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIntegrationId, setEditingIntegrationId] = useState(null);
  const [newIntegration, setNewIntegration] = useState({
    integration_name: 'Odoo',
    api_key: '',
    database_name: '',
    database_url: '',
    database_username: ''
  });

  const handleRenameStart = useCallback((e, organization) => {
    e.stopPropagation();
    setEditingId(organization.id);
    setEditingName(organization.name);
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (editingName.trim() && editingId && onRenameOrganization) {
      await onRenameOrganization(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  }, [editingName, editingId, onRenameOrganization]);

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

  const currentOrganization = organizations.find(org => org.id === currentOrganizationId);

  // Load integrations when organization changes
  useEffect(() => {
    const loadIntegrations = async () => {
      if (!currentOrganizationId || !user?.id) {
        setIntegrations([]);
        return;
      }

      try {
        console.log('Loading integrations for organization:', currentOrganizationId);
        const result = await organizationService.getOrganizationIntegrations(currentOrganizationId, user.id);
        
        if (result.success) {
          // Map the database fields to our component fields
          const mappedIntegrations = result.integrations.map(integration => ({
            id: integration.id,
            organization_id: integration.organization_id,
            integration_name: integration.integration_name,
            api_key: integration.api_key,
            database_name: integration.odoo_db,
            database_url: integration.odoo_url,
            database_username: integration.odoo_username,
            is_active: integration.is_active,
            created_at: integration.created_at,
            updated_at: integration.updated_at
          }));
          setIntegrations(mappedIntegrations);
        } else {
          console.error('Failed to load integrations:', result.error);
          setIntegrations([]);
        }
      } catch (error) {
        console.error('Failed to load integrations:', error);
        setIntegrations([]);
      }
    };

    loadIntegrations();
  }, [currentOrganizationId, user?.id]);

  // Integration management functions
  const handleAddIntegration = useCallback(() => {
    setShowAddForm(true);
  }, []);

  const handleCancelAddIntegration = useCallback(() => {
    setShowAddForm(false);
    setEditingIntegrationId(null);
    setNewIntegration({
      integration_name: 'Odoo',
      api_key: '',
      database_name: '',
      database_url: '',
      database_username: ''
    });
  }, []);

  const handleSaveIntegration = useCallback(async () => {
    if (!currentOrganizationId) return;
    
    try {
      // Here you would call the API to save the integration
      console.log('Saving integration:', newIntegration);
      
      if (editingIntegrationId) {
        // Update existing integration
        setIntegrations(prev => prev.map(integration => 
          integration.id === editingIntegrationId 
            ? { ...integration, ...newIntegration, updated_at: new Date().toISOString() }
            : integration
        ));
      } else {
        // Add new integration
        const integration = {
          id: Date.now().toString(), // Temporary ID
          organization_id: currentOrganizationId,
          ...newIntegration,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setIntegrations(prev => [...prev, integration]);
      }
      
      handleCancelAddIntegration();
    } catch (error) {
      console.error('Failed to save integration:', error);
    }
  }, [currentOrganizationId, newIntegration, editingIntegrationId, handleCancelAddIntegration]);

  const handleDeleteIntegration = useCallback(async (integrationId) => {
    try {
      // Here you would call the API to delete the integration
      console.log('Deleting integration:', integrationId);
      
      setIntegrations(prev => prev.filter(integration => integration.id !== integrationId));
    } catch (error) {
      console.error('Failed to delete integration:', error);
    }
  }, []);

  const handleNewIntegrationChange = useCallback((field, value) => {
    setNewIntegration(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleEditIntegration = useCallback((integration) => {
    setEditingIntegrationId(integration.id);
    setNewIntegration({
      integration_name: integration.integration_name,
      api_key: integration.api_key,
      database_name: integration.database_name,
      database_url: integration.database_url,
      database_username: integration.database_username
    });
    setShowAddForm(true);
  }, []);

  return (
    <div className="flex h-full">
      <div className="w-full flex flex-col">
        {/* Organization Details */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentOrganization ? (
            <div className="space-y-4">
              {/* Organization content */}
              <ContentBlock>
                <div className="flex items-center space-x-2 mb-4">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  {editingId === currentOrganization.id ? (
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
                    <h2
                      className="text-lg font-semibold text-gray-800 cursor-pointer"
                      onDoubleClick={(e) => handleRenameStart(e, currentOrganization)}
                      title="Double-click to rename"
                    >
                      {currentOrganization.name}
                    </h2>
                  )}
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600 mb-4">Manage your organization settings and integrations</p>
                  
                  {/* Integrations Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">Integrations</h4>
                      {integrations.length === 0 && (
                        <button
                          onClick={handleAddIntegration}
                          className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Integration</span>
                        </button>
                      )}
                    </div>

                    {/* Add/Edit Integration Form */}
                    {showAddForm && (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <div className="space-y-3">
                          {/* Two Column Layout */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Integration Type</label>
                              <select
                                value={newIntegration.integration_name}
                                onChange={(e) => handleNewIntegrationChange('integration_name', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="Odoo">Odoo</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Database Name</label>
                              <input
                                type="text"
                                value={newIntegration.database_name}
                                onChange={(e) => handleNewIntegrationChange('database_name', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter database name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Database URL</label>
                              <input
                                type="url"
                                value={newIntegration.database_url}
                                onChange={(e) => handleNewIntegrationChange('database_url', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://your-odoo-instance.com"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Database Username</label>
                              <input
                                type="text"
                                value={newIntegration.database_username}
                                onChange={(e) => handleNewIntegrationChange('database_username', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter database username"
                              />
                            </div>
                          </div>
                          
                          {/* API Key - Full Width at Bottom */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                            <input
                              type="password"
                              value={newIntegration.api_key}
                              onChange={(e) => handleNewIntegrationChange('api_key', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter API key"
                            />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveIntegration}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelAddIntegration}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Existing Integrations List */}
                    {integrations.length > 0 ? (
                      <div className="space-y-2">
                        {integrations.map((integration) => (
                          <div key={integration.id} className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="text-sm font-medium text-gray-900">{integration.integration_name}</h5>
                                <div className="mt-1 text-xs text-gray-500 space-y-1">
                                  <div>Database: {integration.database_name}</div>
                                  <div>URL: {integration.database_url}</div>
                                  <div>Username: {integration.database_username}</div>
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEditIntegration(integration)}
                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit integration"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteIntegration(integration.id)}
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                  title="Delete integration"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">No integrations yet</p>
                        <p className="text-xs text-gray-400 mt-1">Add an integration to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              </ContentBlock>
            </div>
          ) : (
            // Empty State
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No organization selected</p>
              <p className="text-xs text-gray-400 mt-1">Select an organization to manage</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Organizations.propTypes = {
  organizations: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    created_at: PropTypes.string,
    updated_at: PropTypes.string
  })).isRequired,
  currentOrganizationId: PropTypes.string,
  onRenameOrganization: PropTypes.func.isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired
  })
};

export default Organizations;
