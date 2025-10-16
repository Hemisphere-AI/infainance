import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Building2, Plus } from 'lucide-react';
import organizationService from '../services/organizationService';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

const OrganizationManagement = ({ 
  organization, 
  onOrganizationUpdate,
  onIntegrationUpdate 
}) => {
  const { user } = useSupabaseAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [organizationName, setOrganizationName] = useState(organization?.name || '');
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);
  const loadTimeoutRef = useRef(null);

  // Update organization name when prop changes
  useEffect(() => {
    setOrganizationName(organization?.name || '');
  }, [organization?.name]);

  const loadIntegrations = useCallback(async () => {
    if (!organization?.id || !user?.id) {
      setIntegrations([]);
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    // Prevent loading if already loading
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      
      // Get user ID from authentication context
      const userId = user.id;
      
      const result = await organizationService.getOrganizationIntegrations(
        organization.id, 
        userId
      );
      
      if (result.success) {
        setIntegrations(result.integrations || []);
        setError(null);
      } else {
        setError(result.error);
        setIntegrations([]);
      }
    } catch (err) {
      setError('Failed to load integrations');
      setIntegrations([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [organization?.id, user?.id]);

  // Load integrations when organization changes
  useEffect(() => {
    // Clear any existing timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    if (organization?.id && user?.id) {
      // Debounce the loading to prevent rapid successive calls
      loadTimeoutRef.current = setTimeout(() => {
        loadIntegrations();
      }, 100);
    } else {
      setIntegrations([]);
      setLoading(false);
      setError(null);
    }

    // Cleanup timeout on unmount
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [organization?.id, user?.id, loadIntegrations]);

  const handleNameSave = useCallback(async () => {
    if (!organization?.id || !organizationName.trim() || !user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      const userId = user.id;
      
      const result = await organizationService.updateOrganization(
        organization.id,
        organizationName.trim(),
        userId
      );
      
      if (result.success) {
        setIsEditingName(false);
        onOrganizationUpdate && onOrganizationUpdate(result.organization);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to update organization name');
      console.error('Error updating organization:', err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, organizationName, user?.id, onOrganizationUpdate]);

  const handleNameCancel = useCallback(() => {
    setOrganizationName(organization?.name || '');
    setIsEditingName(false);
  }, [organization?.name]);

  const handleIntegrationSave = useCallback(async (integrationName, apiKey) => {
    if (!organization?.id || !integrationName || !apiKey || !user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      const userId = user?.id;
      
      const result = await organizationService.upsertOrganizationIntegration(
        organization.id,
        integrationName,
        apiKey,
        {},
        userId
      );
      
      if (result.success) {
        await loadIntegrations(); // Reload integrations
        onIntegrationUpdate && onIntegrationUpdate(result.integration);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to save integration');
      console.error('Error saving integration:', err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, user?.id, loadIntegrations, onIntegrationUpdate]);

  if (!organization || !organization.id || !organization.name) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-500">Select an organization from the sidebar to manage integrations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Organization Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <Building2 className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            {isEditingName ? (
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNameSave();
                  } else if (e.key === 'Escape') {
                    handleNameCancel();
                  }
                }}
                className="text-xl font-semibold bg-transparent border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <h2
                className="text-xl font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                onDoubleClick={() => setIsEditingName(true)}
                title="Double-click to rename"
              >
                {organization.name}
              </h2>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Integrations Section */}
      <div className="flex-1 p-6" key={`integrations-${organization?.id}`}>
        <div className="max-w-2xl">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Integrations</h3>
          
          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading...</p>
            </div>
          )}

          {!loading && integrations.length === 0 && !error && (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">No integrations configured yet</p>
              <IntegrationForm onSave={handleIntegrationSave} />
            </div>
          )}

          {!loading && integrations.length === 0 && error && (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-red-300" />
              <p className="text-red-500 mb-4">{error}</p>
            </div>
          )}

          {!loading && integrations.length > 0 && (
            <div className="space-y-4">
              {integrations.map((integration) => (
                <IntegrationCard 
                  key={integration.id} 
                  integration={integration}
                  onUpdate={handleIntegrationSave}
                />
              ))}
              <IntegrationForm onSave={handleIntegrationSave} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Integration Card Component
const IntegrationCard = ({ integration, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [integrationName, setIntegrationName] = useState(integration.integration_name);
  const [apiKey, setApiKey] = useState('••••••••••••••••');

  const handleSave = () => {
    if (integrationName && apiKey && apiKey !== '••••••••••••••••') {
      onUpdate(integrationName, apiKey);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIntegrationName(integration.integration_name);
    setApiKey('••••••••••••••••');
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Integration Name
                </label>
                <select
                  value={integrationName}
                  onChange={(e) => setIntegrationName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="odoo">Odoo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="font-medium text-gray-900 capitalize">{integration.integration_name}</h4>
              <p className="text-sm text-gray-500">API Key: {apiKey}</p>
              <p className="text-xs text-gray-400 mt-1">
                {integration.is_active ? 'Active' : 'Inactive'} • 
                Updated {new Date(integration.updated_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="ml-4 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

// Integration Form Component
const IntegrationForm = ({ onSave }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [integrationName, setIntegrationName] = useState('odoo');
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    if (integrationName && apiKey) {
      onSave(integrationName, apiKey);
      setIntegrationName('odoo');
      setApiKey('');
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setIntegrationName('odoo');
    setApiKey('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span>Add Integration</span>
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">Add New Integration</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Integration Name
          </label>
          <select
            value={integrationName}
            onChange={(e) => setIntegrationName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="odoo">Odoo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter API key"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

OrganizationManagement.propTypes = {
  organization: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    created_at: PropTypes.string,
    updated_at: PropTypes.string
  }),
  onOrganizationUpdate: PropTypes.func,
  onIntegrationUpdate: PropTypes.func
};

IntegrationCard.propTypes = {
  integration: PropTypes.shape({
    id: PropTypes.string.isRequired,
    integration_name: PropTypes.string.isRequired,
    is_active: PropTypes.bool.isRequired,
    updated_at: PropTypes.string.isRequired
  }).isRequired,
  onUpdate: PropTypes.func.isRequired
};

IntegrationForm.propTypes = {
  onSave: PropTypes.func.isRequired
};

export default OrganizationManagement;
