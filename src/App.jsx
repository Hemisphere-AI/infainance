import React, { useState, useCallback, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
// import { FileSpreadsheet } from 'lucide-react'
// import { CheckSquare } from 'lucide-react' // Unused import
import PropTypes from 'prop-types'
// TODO: enable chat interface when chatting with AI Agent is possible
// import ChatInterface from './components/ChatInterface'
import Sidebar from './components/Sidebar'
// import Checks from './components/Checks' // Unused import
import CheckResult from './components/CheckResult'
import Organizations from './components/Organizations'
// TODO: enable when in platform spreadsheets are available
// import GoogleSheetsEmbed from './components/GoogleSheetsEmbed'
import { SupabaseAuthProvider, useSupabaseAuth } from './contexts/SupabaseAuthContext'
// TODO: enable when in platform spreadsheets are available
// import { useSpreadsheet, useUserSpreadsheets } from './hooks/useSpreadsheet'
import LoginPage from './components/LoginPage'
import LandingPage from './components/LandingPage'
import TermsOfService from './components/TermsOfService'
import PrivacyPolicy from './components/PrivacyPolicy'
import UserProfile from './components/UserProfile'
import GoogleOAuthCallback from './components/GoogleOAuthCallback'
// TODO: enable when in platform spreadsheets are available
// import { LLMService } from './services/llmService'
import { supabase } from './lib/supabase'
import organizationService from './services/organizationService'


function MainApp() {
  // Let Supabase handle OAuth hash fragments naturally
  useEffect(() => {
    // Don't clean up hash fragments - let Supabase handle OAuth tokens
  }, [])

  return (
    <SupabaseAuthProvider>
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/oauth2/callback" element={<GoogleOAuthCallback />} />
        <Route 
          path="/app" 
            element={<SpreadsheetApp />} 
        />
        <Route 
          path="/organization/:organizationId" 
            element={<SpreadsheetApp />} 
        />
        <Route 
          path="/organization/:organizationId/check/:checkId" 
            element={<SpreadsheetApp />} 
        />
        <Route 
          path="/check/:checkId" 
            element={<SpreadsheetApp />} 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </SupabaseAuthProvider>
  )
}

function SpreadsheetApp() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const navigate = useNavigate()
  
  // Debug authentication state
  useEffect(() => {
  }, [user, authLoading])
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  if (authLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return <MainSpreadsheetApp user={user} />
}

function MainSpreadsheetApp({ user }) {
  const navigate = useNavigate()
  const { checkId, organizationId } = useParams()
  
  // Organizations and Checks state
  const [organizations, setOrganizations] = useState([])
  const [currentOrganizationId, setCurrentOrganizationId] = useState(null)
  const [checks, setChecks] = useState([])
  const [currentCheckId, setCurrentCheckId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)


  // Handle URL parameter for check selection
  useEffect(() => {
    if (checkId && checkId !== currentCheckId) {
      setCurrentCheckId(checkId)
    } else if (!checkId && currentCheckId) {
      setCurrentCheckId(null)
    }
  }, [checkId, currentCheckId])

  // Handle URL parameter changes for organizationId
  useEffect(() => {
    if (organizationId && organizationId !== currentOrganizationId) {
      setCurrentOrganizationId(organizationId)
    }
  }, [organizationId, currentOrganizationId])


  // Load user's organizations
  useEffect(() => {
    let isMounted = true
    const loadUserOrganizations = async () => {
      try {
        const result = await organizationService.getUserOrganizations(user.id)
        if (!isMounted) return
        
        if (result.success) {
          setOrganizations(result.organizations || [])
          // Use organizationId from URL if available, otherwise auto-select first organization
          if (result.organizations?.length > 0) {
            if (organizationId && result.organizations.find(org => org.id === organizationId)) {
              setCurrentOrganizationId(organizationId)
            } else if (!currentOrganizationId) {
              setCurrentOrganizationId(result.organizations[0].id)
            }
            
            // Load checks for all organizations (for sidebar)
            // Only load for organizations that don't already have checks loaded
            result.organizations.forEach(org => {
              const hasChecks = checks.some(check => check.organization_id === org.id)
              if (!hasChecks) {
                loadOrganizationChecks(org.id)
              }
            })
          }
        } else {
          console.error('Failed to load organizations:', result.error)
        }
      } catch (err) {
        console.error('Failed to load user organizations:', err)
      }
    }

    if (user?.id) {
      loadUserOrganizations()
    }

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, organizationId]) // Removed currentOrganizationId to break circular dependency

  // Load checks for organization
  const loadOrganizationChecks = useCallback(async (organizationId = currentOrganizationId) => {
    if (!organizationId || !user?.id) {
      return
    }

    try {
      const result = await organizationService.getOrganizationChecks(organizationId, user.id)
      
      if (result.success) {
        setChecks(prev => {
          // Remove existing checks for this organization and add new ones
          const otherChecks = prev.filter(check => check.organization_id !== organizationId)
          return [...otherChecks, ...(result.checks || [])]
        })
        // Only auto-select first check if we're on a check-specific route and this is the current organization
        // Don't auto-select when just viewing organization page
        if (result.checks?.length > 0 && !currentCheckId && checkId && organizationId === currentOrganizationId) {
          setCurrentCheckId(result.checks[0].id)
        } else if (result.checks?.length === 0 && organizationId === currentOrganizationId) {
          setCurrentCheckId(null)
        }
      } else {
        console.error('Failed to load checks:', result.error)
      }
    } catch (err) {
      console.error('Failed to load organization checks:', err)
    }
  }, [currentOrganizationId, user?.id, checkId, currentCheckId])

  // Only load checks when currentOrganizationId changes, not on every render
  useEffect(() => {
    if (currentOrganizationId) {
      loadOrganizationChecks(currentOrganizationId)
    }
  }, [currentOrganizationId, user?.id, loadOrganizationChecks])


  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  // Organization management functions
  const handleCreateOrganization = useCallback(async () => {
    try {
      const defaultName = `Organization ${organizations.length + 1}`
      const result = await organizationService.createOrganization(user.id, defaultName)
      
      if (result.success) {
        setOrganizations(prev => [...prev, result.organization])
        setCurrentOrganizationId(result.organization.id)
        navigate(`/organization/${result.organization.id}`)
      } else {
        console.error('Failed to create organization:', result.error)
      }
    } catch (err) {
      console.error('Failed to create organization:', err)
    }
  }, [organizations.length, user.id, navigate])

  const handleOrganizationSelect = useCallback((organizationId) => {
    setCurrentOrganizationId(organizationId)
    // Don't clear current check - let the useEffect handle loading checks for the new organization
    navigate(`/organization/${organizationId}`)
  }, [navigate])

  const handleRenameOrganization = useCallback(async (organizationId, newName) => {
    try {
      const result = await organizationService.updateOrganization(organizationId, newName, user.id)
      
      if (result.success) {
        setOrganizations(prev => prev.map(org => 
          org.id === organizationId 
            ? { ...org, name: newName, updated_at: new Date().toISOString() }
            : org
        ))
      } else {
        console.error('Failed to rename organization:', result.error)
      }
    } catch (err) {
      console.error('Failed to rename organization:', err)
    }
  }, [user.id])

  const handleDeleteOrganization = useCallback(async (organizationId) => {
    try {
      if (!user?.id) return;
      
      const result = await organizationService.deleteOrganization(organizationId, user.id);
      
      if (result.success) {
        setOrganizations(prev => prev.filter(org => org.id !== organizationId));
        
        // If this was the current organization, clear it
        if (currentOrganizationId === organizationId) {
          setCurrentOrganizationId(null);
          setChecks([]);
          setCurrentCheckId(null);
          navigate('/app');
        }
      } else {
        console.error('Failed to delete organization:', result.error);
      }
    } catch (err) {
      console.error('Error deleting organization:', err);
    }
  }, [user?.id, currentOrganizationId, navigate])


  // Check management functions
  const handleCreateCheck = useCallback(async (organizationId = currentOrganizationId) => {
    try {
      if (!organizationId) {
        console.error('No organization selected')
        return
      }

      const defaultName = `Check ${checks.length + 1}`
      const result = await organizationService.createOrganizationCheck(
        organizationId, 
        defaultName, 
        '', 
        user.id
      )
      
      if (result.success) {
        setChecks(prev => [...prev, result.check])
        setCurrentCheckId(result.check.id)
        navigate(`/check/${result.check.id}`)
      } else {
        console.error('Failed to create check:', result.error)
      }
    } catch (err) {
      console.error('Failed to create check:', err)
    }
  }, [checks.length, user.id, navigate, currentOrganizationId])

  const handleCheckSelect = useCallback((checkId) => {
    setCurrentCheckId(checkId)
    navigate(`/check/${checkId}`)
  }, [navigate])

  const handleRenameCheck = useCallback(async (checkId, newName) => {
    try {
      if (!user?.id) return

      const result = await organizationService.updateOrganizationCheck(checkId, { name: newName }, user.id)
      
      if (result.success) {
        // Update local state with the response from the server
        setChecks(prev => prev.map(check => 
          check.id === checkId 
            ? { ...check, name: newName, updated_at: result.check.updated_at }
            : check
        ))
      } else {
        console.error('Failed to rename check:', result.error)
      }
    } catch (err) {
      console.error('Failed to rename check:', err)
    }
  }, [user?.id])

  const handleDeleteCheck = useCallback(async (checkId) => {
    try {
      const { error } = await supabase
        .from('checks')
        .delete()
        .eq('id', checkId)
        .eq('organization_id', currentOrganizationId)
      if (error) throw error
      setChecks(prev => prev.filter(check => check.id !== checkId))
      if (currentCheckId === checkId) {
        setCurrentCheckId(null)
        navigate('/app')
      }
    } catch (err) {
      console.error('Failed to delete check:', err)
    }
  }, [currentCheckId, currentOrganizationId, navigate])

  const handleToggleCheck = useCallback(async (checkId) => {
    try {
      const target = checks.find(c => c.id === checkId)
      if (!target) return
      
      // Toggle between 'passed' (checked) and 'active' (unchecked) status
      const nextStatus = target.status === 'passed' ? 'active' : 'passed'

      const { error } = await supabase
        .from('checks')
        .update({ status: nextStatus })
        .eq('id', checkId)
        .eq('organization_id', currentOrganizationId)
      if (error) throw error
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, status: nextStatus, updated_at: new Date().toISOString() }
          : check
      ))
    } catch (err) {
      console.error('Failed to toggle check:', err)
    }
  }, [checks, currentOrganizationId])

  const handleUpdateDescription = useCallback(async (checkId, newDescription) => {
    try {
      const { error } = await supabase
        .from('checks')
        .update({ description: newDescription })
        .eq('id', checkId)
        .eq('organization_id', currentOrganizationId)
      if (error) throw error
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, description: newDescription, updated_at: new Date().toISOString() }
          : check
      ))
    } catch (err) {
      console.error('Failed to update description:', err)
    }
  }, [currentOrganizationId])

  const handleUpdateAcceptanceCriteria = useCallback(async (checkId, newAcceptanceCriteria) => {
    try {
      const { error } = await supabase
        .from('checks')
        .update({ acceptance_criteria: newAcceptanceCriteria })
        .eq('id', checkId)
        .eq('organization_id', currentOrganizationId)
      if (error) throw error
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, acceptance_criteria: newAcceptanceCriteria, updated_at: new Date().toISOString() }
          : check
      ))
    } catch (err) {
      console.error('Failed to update acceptance criteria:', err)
    }
  }, [currentOrganizationId])


  const handleRunAnalysis = useCallback(async (checkId) => {
    // This function will be called by the Checks component
    // The actual analysis will be triggered by the MCPIntegration component
    console.log('Run analysis requested for check:', checkId)
  }, [])


  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <img 
                src="/north-star-svgrepo-com.svg" 
                alt="Logo" 
                className="w-8 h-8"
              />
              <span className="text-lg font-semibold text-gray-800">Zenith</span>
            </div>
          </div>
          
          <div className="flex items-center">
            <UserProfile />
          </div>
        </div>
      </div>

      {/* Main content area with sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          organizations={organizations.filter(org => org.id && org.name && org.created_at && org.updated_at)}
          checks={checks.filter(check => check.organization_id)}
          currentCheckId={currentCheckId}
          currentOrganizationId={currentOrganizationId}
          onOrganizationSelect={handleOrganizationSelect}
          onCheckSelect={handleCheckSelect}
          onCreateOrganization={handleCreateOrganization}
          onCreateCheck={handleCreateCheck}
          onRenameOrganization={handleRenameOrganization}
          onRenameCheck={handleRenameCheck}
          onDeleteOrganization={handleDeleteOrganization}
          onDeleteCheck={handleDeleteCheck}
          onToggleCheck={handleToggleCheck}
          onLoadOrganizationChecks={loadOrganizationChecks}
          isOpen={sidebarOpen}
          onToggle={handleSidebarToggle}
        />

        {/* Content area */}
        <div className="flex-1 flex flex-col lg:flex-row px-4 py-4 min-h-0 overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 lg:mr-4 mb-4 lg:mb-0 min-w-0">
            <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden">
              {currentCheckId ? (
                <CheckResult 
                  checks={checks}
                  currentCheckId={currentCheckId}
                  organizationId={currentOrganizationId}
                  onCheckSelect={handleCheckSelect}
                  onCreateCheck={handleCreateCheck}
                  onRenameCheck={handleRenameCheck}
                  onDeleteCheck={handleDeleteCheck}
                  onToggleCheck={handleToggleCheck}
                  onUpdateDescription={handleUpdateDescription}
                  onUpdateAcceptanceCriteria={handleUpdateAcceptanceCriteria}
                  onRunAnalysis={handleRunAnalysis}
                  onRefreshChecks={loadOrganizationChecks}
                  user={user}
                />
              ) : currentOrganizationId ? (
                <Organizations 
                  organizations={organizations}
                  currentOrganizationId={currentOrganizationId}
                  onRenameOrganization={handleRenameOrganization}
                  user={user}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm8 0a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select an organization</h3>
                    <p className="text-gray-500">Choose an organization from the sidebar to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

MainSpreadsheetApp.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    email: PropTypes.string,
    name: PropTypes.string
  }).isRequired
}

export default MainApp
