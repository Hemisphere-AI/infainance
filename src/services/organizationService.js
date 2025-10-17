/**
 * Frontend Organization Service
 * Handles organization and integration management from the frontend
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002'

class OrganizationService {
  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId) {
    try {
      // console.log('🔍 OrganizationService: Getting organizations for userId:', userId)
      const response = await fetch(`${BACKEND_URL}/api/organizations?userId=${userId}`)
      const data = await response.json()
      // console.log('🔍 OrganizationService: Response:', data)
      // console.log('🔍 OrganizationService: Organizations:', data.organizations)
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch organizations')
      }
      
      return data
    } catch (error) {
      console.error('Error getting user organizations:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(userId, name) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          name
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization')
      }
      
      return data
    } catch (error) {
      console.error('Error creating organization:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Update organization name
   */
  async updateOrganization(organizationId, name, userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          name
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update organization')
      }
      
      return data
    } catch (error) {
      console.error('Error updating organization:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get organization integrations
   */
  async getOrganizationIntegrations(organizationId, userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/integrations?userId=${userId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch integrations')
      }
      
      return data
    } catch (error) {
      console.error('Error getting organization integrations:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Create or update organization integration
   */
  async upsertOrganizationIntegration(organizationId, integrationName, apiKey, config = {}, userId, odooUrl, odooDb, odooUsername) {
    try {
      // console.log('🔍 OrganizationService: Creating integration for:', { organizationId, integrationName, userId })
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          integrationName,
          apiKey,
          config,
          odooUrl,
          odooDb,
          odooUsername
        })
      })
      
      const data = await response.json()
      // console.log('🔍 OrganizationService: Integration response:', data)
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save integration')
      }
      
      return data
    } catch (error) {
      console.error('Error saving organization integration:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Delete organization integration
   */
  async deleteOrganizationIntegration(integrationId, userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/organizations/integrations/${integrationId}?userId=${userId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete integration')
      }
      
      return data
    } catch (error) {
      console.error('Error deleting organization integration:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get organization checks
   */
  async getOrganizationChecks(organizationId, userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/checks?userId=${userId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch checks')
      }
      
      return data
    } catch (error) {
      console.error('Error getting organization checks:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Delete an organization
   */
  async deleteOrganization(organizationId, userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete organization')
      }
      
      return data
    } catch (error) {
      console.error('Error deleting organization:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Create a new check for an organization
   */
  async createOrganizationCheck(organizationId, name, description, userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/checks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          name,
          description
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create check')
      }
      
      return data
    } catch (error) {
      console.error('Error creating organization check:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Update a check
   */
  async updateOrganizationCheck(checkId, updates, userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/checks/${checkId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          ...updates
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update check')
      }
      
      return data
    } catch (error) {
      console.error('Error updating organization check:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default new OrganizationService()
