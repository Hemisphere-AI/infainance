/**
 * Organization Service
 * Handles organization and integration management
 */

import { createClient } from '@supabase/supabase-js'

class OrganizationService {
  constructor() {
    this.supabaseUrl = process.env.VITE_SUPABASE_URL
    // Use service role key for backend operations to bypass RLS
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase configuration missing')
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey)
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId) {
    try {
      const { data, error } = await this.supabase
        .from('organization_users')
        .select(`
          organization_id,
          organizations (
            id,
            name,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)

      if (error) throw error

      return {
        success: true,
        organizations: data?.map(item => item.organizations) || []
      }
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
  async createOrganization(userId, organizationName) {
    try {
      // Start a transaction-like operation
      const { data: organization, error: orgError } = await this.supabase
        .from('organizations')
        .insert({
          name: organizationName
        })
        .select('id, name, created_at, updated_at')
        .single()

      if (orgError) throw orgError

      // Add user to the organization
      const { error: userError } = await this.supabase
        .from('organization_users')
        .insert({
          organization_id: organization.id,
          user_id: userId
        })

      if (userError) throw userError

      return {
        success: true,
        organization
      }
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
  async updateOrganization(organizationId, newName, userId) {
    try {
      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      const { data, error } = await this.supabase
        .from('organizations')
        .update({ name: newName })
        .eq('id', organizationId)
        .select('id, name, updated_at')
        .single()

      if (error) throw error

      return {
        success: true,
        organization: data
      }
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
      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      const { data, error } = await this.supabase
        .from('organization_integrations')
        .select('id, integration_name, is_active, created_at, updated_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return {
        success: true,
        integrations: data || []
      }
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
  async upsertOrganizationIntegration(organizationId, integrationName, apiKey, config = {}, userId) {
    try {
      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      // First, try to find existing integration
      const { data: existing, error: findError } = await this.supabase
        .from('organization_integrations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('integration_name', integrationName)
        .single()

      let data, error

      if (existing) {
        // Update existing integration
        const result = await this.supabase
          .from('organization_integrations')
          .update({
            api_key: apiKey,
            config: config,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select('id, integration_name, is_active, created_at, updated_at')
          .single()
        
        data = result.data
        error = result.error
      } else {
        // Create new integration
        const result = await this.supabase
          .from('organization_integrations')
          .insert({
            organization_id: organizationId,
            integration_name: integrationName,
            api_key: apiKey,
            config: config,
            is_active: true
          })
          .select('id, integration_name, is_active, created_at, updated_at')
          .single()
        
        data = result.data
        error = result.error
      }

      if (error) throw error

      return {
        success: true,
        integration: data
      }
    } catch (error) {
      console.error('Error upserting organization integration:', error)
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
      // Get the integration to verify organization access
      const { data: integration, error: integrationError } = await this.supabase
        .from('organization_integrations')
        .select('organization_id')
        .eq('id', integrationId)
        .single()

      if (integrationError) throw integrationError

      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', integration.organization_id)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      const { error } = await this.supabase
        .from('organization_integrations')
        .delete()
        .eq('id', integrationId)

      if (error) throw error

      return {
        success: true
      }
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
      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      const { data, error } = await this.supabase
        .from('checks')
        .select('id, name, description, status, is_checked, organization_id, created_at, updated_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return {
        success: true,
        checks: data || []
      }
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
      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      // Delete the organization (this will cascade delete related records due to foreign keys)
      const { error } = await this.supabase
        .from('organizations')
        .delete()
        .eq('id', organizationId)

      if (error) throw error

      return {
        success: true
      }
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
  async createOrganizationCheck(organizationId, checkName, checkDescription, userId) {
    try {
      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      const { data, error } = await this.supabase
        .from('checks')
        .insert({
          organization_id: organizationId,
          name: checkName,
          description: checkDescription || '',
          status: 'active'
        })
        .select('id, organization_id, name, description, status, is_checked, created_at, updated_at')
        .single()

      if (error) throw error

      return {
        success: true,
        check: data
      }
    } catch (error) {
      console.error('Error creating organization check:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Update a check for an organization
   */
  async updateOrganizationCheck(checkId, updates, userId) {
    try {
      // First, get the check to verify user has access to its organization
      const { data: check, error: checkError } = await this.supabase
        .from('checks')
        .select('organization_id')
        .eq('id', checkId)
        .single()

      if (checkError || !check) {
        throw new Error('Check not found')
      }

      // Verify user has access to this organization
      const { data: membership, error: membershipError } = await this.supabase
        .from('organization_users')
        .select('organization_id')
        .eq('organization_id', check.organization_id)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('User does not have access to this organization')
      }

      // Update the check
      const { data, error } = await this.supabase
        .from('checks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', checkId)
        .select('id, organization_id, name, description, status, is_checked, created_at, updated_at')
        .single()

      if (error) throw error

      return {
        success: true,
        check: data
      }
    } catch (error) {
      console.error('Error updating organization check:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default OrganizationService
