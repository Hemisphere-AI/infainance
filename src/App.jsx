import React, { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
// import { FileSpreadsheet } from 'lucide-react'
import { CheckSquare } from 'lucide-react'
import PropTypes from 'prop-types'
// TODO: enable chat interface when chatting with AI Agent is possible
// import ChatInterface from './components/ChatInterface'
import Sidebar from './components/Sidebar'
import Checks from './components/Checks'
import CheckResult from './components/CheckResult'
import OrganizationManagement from './components/OrganizationManagement'
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

// Editable spreadsheet name component
const EditableSpreadsheetName = ({ name, onRename }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(name)
  const inputRef = useRef(null)

  useEffect(() => {
    setEditName(name)
  }, [name])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = () => {
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (editName.trim() && editName.trim() !== name) {
      await onRename(editName.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditName(name)
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="text-sm font-medium text-gray-700 bg-transparent border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    )
  }

  return (
    <h4 
      className="text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
      onDoubleClick={handleDoubleClick}
      title="Double-click to rename"
    >
      {name}
    </h4>
  )
}

EditableSpreadsheetName.propTypes = {
  name: PropTypes.string.isRequired,
  onRename: PropTypes.func.isRequired
}

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
  
  // TODO: enable when in platform spreadsheets are available
  // const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState(null)
  // const [spreadsheetData, setSpreadsheetData] = useState([])
  
  // Organizations and Checks state
  const [organizations, setOrganizations] = useState([])
  const [currentOrganizationId, setCurrentOrganizationId] = useState(null)
  const [checks, setChecks] = useState([])
  const [currentCheckId, setCurrentCheckId] = useState(null)
  
  // TODO: enable chat interface when chatting with AI Agent is possible
  // const [isChatLoading, setIsChatLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // const [chatCollapsed, setChatCollapsed] = useState(false)
  // TODO: enable chat interface when chatting with AI Agent is possible
  // const [saveStatus, setSaveStatus] = useState({ type: null, message: null }) // 'saving', 'success', 'error'
  // TODO: enable when in platform spreadsheets are available
  // const [googleSheetsConfig, setGoogleSheetsConfig] = useState({
  //   sheetUrl: '',
  //   sheetId: '',
  //   isConfigured: false,
  //   isPublic: false,
  //   refreshInterval: 30000,
  //   autoRefresh: true
  // })
  // TODO: enable when in platform spreadsheets are available
  // const [googleSheetsVisible, setGoogleSheetsVisible] = useState(true)
  // TODO: enable when in platform spreadsheets are available
  // const toolCallHandlerRef = useRef(null)
  // TODO: enable chat interface when chatting with AI Agent is possible
  // const addBotMessageRef = useRef(null)
  // const llmServiceRef = useRef(null)

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

  // Function to load checks for sidebar (defined before useEffect)
  const loadOrganizationChecksForSidebar = useCallback(async (organizationId) => {
    if (!organizationId || !user?.id) {
      return;
    }

    try {
      const result = await organizationService.getOrganizationChecks(organizationId, user.id);
      if (result.success) {
        setChecks(prev => {
          // Remove existing checks for this organization and add new ones
          const otherChecks = prev.filter(check => check.organization_id !== organizationId);
          return [...otherChecks, ...(result.checks || [])];
        });
      } else {
        console.error('Failed to load checks for organization:', result.error);
      }
    } catch (err) {
      console.error('Error loading checks for organization:', err);
    }
  }, [user?.id])

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
            
            // Load checks for all organizations
            result.organizations.forEach(org => {
              loadOrganizationChecksForSidebar(org.id)
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
  }, [user?.id, currentOrganizationId, loadOrganizationChecksForSidebar])

  // Load checks for current organization
  useEffect(() => {
    let isMounted = true
    const loadOrganizationChecks = async () => {
      if (!currentOrganizationId || !user?.id) {
        return
      }

      try {
        const result = await organizationService.getOrganizationChecks(currentOrganizationId, user.id)
        if (!isMounted) return
        
        if (result.success) {
          setChecks(prev => {
            // Remove existing checks for this organization and add new ones
            const otherChecks = prev.filter(check => check.organization_id !== currentOrganizationId)
            return [...otherChecks, ...(result.checks || [])]
          })
          // Auto-select first check if none selected
          if (result.checks?.length > 0 && !currentCheckId) {
            setCurrentCheckId(result.checks[0].id)
          } else if (result.checks?.length === 0) {
            setCurrentCheckId(null)
          }
        } else {
          console.error('Failed to load checks:', result.error)
        }
      } catch (err) {
        console.error('Failed to load organization checks:', err)
      }
    }

    loadOrganizationChecks()

    return () => {
      isMounted = false
    }
  }, [currentOrganizationId, user?.id])

  // TODO: enable when in platform spreadsheets are available
  // Load user's spreadsheets
  // const { 
  //   spreadsheets, 
  //   loading: spreadsheetsLoading, 
  //   createSpreadsheet,
  //   renameSpreadsheet,
  //   deleteSpreadsheet
  // } = useUserSpreadsheets(user.id)

  // Load current spreadsheet
  // const { 
  //   spreadsheet, 
  //   loading: spreadsheetLoading, 
  //   saving, 
  //   saveSpreadsheet,
  //   updateName
  // } = useSpreadsheet(currentSpreadsheetId, user.id)

  // TODO: enable when in platform spreadsheets are available
  // Debug current spreadsheet ID changes
  // useEffect(() => {
  // }, [currentSpreadsheetId])

  // Initialize with first spreadsheet or create new one
  // useEffect(() => {
  //   if (spreadsheets.length > 0 && !currentSpreadsheetId) {
  //     setCurrentSpreadsheetId(spreadsheets[0].id)
  //   } else if (spreadsheets.length === 0 && !spreadsheetsLoading) {
  //     // Create a new spreadsheet for the user
  //     createSpreadsheet('Untitled Spreadsheet').then((newSpreadsheet) => {
  //       setCurrentSpreadsheetId(newSpreadsheet.id)
  //     }).catch((error) => {
  //       console.error('Error creating spreadsheet:', error)
  //     })
  //   }
  // }, [spreadsheets, currentSpreadsheetId, spreadsheetsLoading, createSpreadsheet, user.id])

  // Auto-show Google Sheets integration when user has a spreadsheet
  // useEffect(() => {
  //   if (currentSpreadsheetId && user?.id) {
  //     setGoogleSheetsVisible(true)
  //   }
  // }, [currentSpreadsheetId, user?.id])

  // Load initial spreadsheet data (only when spreadsheet ID changes, not when user edits)
  // useEffect(() => {
  //   if (spreadsheet?.data && Array.isArray(spreadsheet.data)) {
  //     setSpreadsheetData(spreadsheet.data)
  //   } else if (spreadsheet && (!spreadsheet.data || !Array.isArray(spreadsheet.data))) {
  //     setSpreadsheetData([])
  //   }
  // }, [spreadsheet?.id]) // Only trigger when spreadsheet ID changes, not on data changes

  // Handle spreadsheet data changes
  // const handleSpreadsheetChange = useCallback(async (newData) => {
  //   setSpreadsheetData(newData)
    
  //   // Update LLM service with new data
  //   if (llmServiceRef.current) {
  //     llmServiceRef.current.updateSpreadsheetData(newData)
  //   }
    
  //   // Debounce saves to avoid too many database calls
  //   if (currentSpreadsheetId) {
  //     try {
  //       // TODO: enable chat interface when chatting with AI Agent is possible
  //       // setSaveStatus({ type: 'saving', message: 'Saving changes...' })
  //       await saveSpreadsheet(newData)
  //       // setSaveStatus({ type: 'success', message: 'Changes saved successfully' })
        
  //       // Clear success message after 2 seconds
  //       // setTimeout(() => {
  //       //   setSaveStatus({ type: null, message: null })
  //       // }, 2000)
  //     } catch (error) {
  //       console.error('❌ Error saving spreadsheet:', error)
  //       // setSaveStatus({ type: 'error', message: 'Failed to save changes. Please try again.' })
        
  //       // Clear error message after 5 seconds
  //       // setTimeout(() => {
  //       //   setSaveStatus({ type: null, message: null })
  //       // }, 5000)
  //     }
  //   }
  // }, [currentSpreadsheetId, saveSpreadsheet])

  // Initialize LLM service when user and spreadsheet data are available
  // useEffect(() => {
  //   if (user && spreadsheetData) {
  //     llmServiceRef.current = new LLMService(
  //       spreadsheetData,
  //       handleSpreadsheetChange,
  //       toolCallHandlerRef.current,
  //       user,
  //       googleSheetsConfig
  //     )
  //   }
  // }, [user, spreadsheetData, handleSpreadsheetChange, googleSheetsConfig])

  // TODO: enable chat interface when chatting with AI Agent is possible
  // Handle tool call registration from ChatInterface
  // const handleToolCallRegistration = useCallback((handler) => {
  //   toolCallHandlerRef.current = handler
  // }, [])

  // Handle bot message registration from ChatInterface
  // const handleBotMessageRegistration = useCallback((handler) => {
  //   addBotMessageRef.current = handler
  // }, [])

  // TODO: enable chat interface when chatting with AI Agent is possible
  // Handle sending messages from ChatInterface
  // const handleSendMessage = useCallback(async (message) => {
  //   if (!llmServiceRef.current) {
  //     console.error('LLM service not initialized')
  //     return 'Error: LLM service not available'
  //   }

  //   try {
  //     setIsChatLoading(true)
  //     const response = await llmServiceRef.current.chat(message)
      
  //     // Update token quota status after successful completion
  //     if (llmServiceRef.current) {
  //       // Add a small delay to ensure token cache is fully updated
  //       setTimeout(async () => {
  //         try {
  //           const updatedQuotaStatus = await llmServiceRef.current.getTokenQuotaStatus();
  //           // Dispatch a custom event to notify UserProfile component
  //           window.dispatchEvent(new CustomEvent('tokenQuotaUpdated', { 
  //             detail: updatedQuotaStatus 
  //           }));
  //         } catch (error) {
  //           console.error('Error updating token quota status:', error);
  //         }
  //       }, 100);
  //     }
      
  //     return response
  //   } catch (error) {
  //     console.error('Error in LLM service:', error)
  //     return `Error: ${error.message}`
  //   } finally {
  //     setIsChatLoading(false)
  //   }
  // }, [])

  // Handle canceling LLM requests
  // const handleCancel = useCallback(() => {
  //   if (llmServiceRef.current) {
  //     llmServiceRef.current.cancel()
  //   }
  //   setIsChatLoading(false)
  // }, [])

  // TODO: enable when in platform spreadsheets are available
  // Create new spreadsheet
  // const handleCreateSpreadsheet = useCallback(async () => {
  //   try {
  //     // Create local spreadsheet first
  //     const newSpreadsheet = await createSpreadsheet('Untitled Spreadsheet')
  //     setCurrentSpreadsheetId(newSpreadsheet.id)
  //     setSpreadsheetData([])
      
  //     // Note: Google Sheet creation is now handled automatically by GoogleSheetsEmbed
  //     // when the component detects a new spreadsheet without a Google Sheet
  //     console.log('✅ Local spreadsheet created, Google Sheet will be auto-created')
  //   } catch (error) {
  //     console.error('Error creating spreadsheet:', error)
  //   }
  // }, [createSpreadsheet])

  // TODO: enable when in platform spreadsheets are available
  // Handle spreadsheet selection
  // const handleSpreadsheetSelect = useCallback((spreadsheetId) => {
  //   if (spreadsheetId !== currentSpreadsheetId) {
  //     setCurrentSpreadsheetId(spreadsheetId)
  //     // Let the useEffect handle data loading when spreadsheet ID changes
  //   }
  // }, [currentSpreadsheetId])

  // Handle spreadsheet rename
  // const handleSpreadsheetRename = useCallback(async (spreadsheetId, newName) => {
  //   try {
  //     // Update the current spreadsheet name if it's the one being renamed
  //     if (spreadsheetId === currentSpreadsheetId) {
  //       await updateName(newName)
  //     }
  //     // Also update the spreadsheets list
  //     await renameSpreadsheet(spreadsheetId, newName)
      
  //     // Also update the Google Sheet title if this spreadsheet has a Google Sheet configured
  //     try {
  //       const { data: spreadsheet, error } = await supabase
  //         .from('spreadsheets')
  //         .select('google_sheet_id')
  //         .eq('id', spreadsheetId)
  //         .single()
        
  //       if (!error && spreadsheet?.google_sheet_id) {
  //         const { googleSheetsService } = await import('./services/googleSheetsService.js')
  //         const result = await googleSheetsService.updateSpreadsheetTitle(spreadsheet.google_sheet_id, newName)
  //         if (result.success) {
  //           console.log('✅ Successfully updated Google Sheet title from sidebar rename')
  //         } else {
  //           console.warn('⚠️ Failed to update Google Sheet title from sidebar rename:', result.error)
  //         }
  //       }
  //     } catch (error) {
  //       console.warn('⚠️ Error updating Google Sheet title from sidebar rename:', error)
  //       // Don't throw here - we still want the local rename to succeed
  //     }
  //   } catch (error) {
  //     console.error('Error renaming spreadsheet:', error)
  //   }
  // }, [renameSpreadsheet, updateName, currentSpreadsheetId])

  // Handle Google Sheets config change
  // const handleGoogleSheetsConfigChange = useCallback((config) => {
  //   setGoogleSheetsConfig(config)
  //   // Update LLM service with new Google Sheets config
  //   if (llmServiceRef.current) {
  //     llmServiceRef.current.updateGoogleSheetsConfig(config)
  //   }
  // }, [])

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

  const handleLoadOrganizationChecks = useCallback(async (organizationId) => {
    if (!organizationId || !user?.id) {
      return;
    }

    try {
      const result = await organizationService.getOrganizationChecks(organizationId, user.id);
      if (result.success) {
        setChecks(prev => {
          // Remove existing checks for this organization and add new ones
          const otherChecks = prev.filter(check => check.organization_id !== organizationId);
          return [...otherChecks, ...(result.checks || [])];
        });
      } else {
        console.error('Failed to load checks for organization:', result.error);
      }
    } catch (err) {
      console.error('Error loading checks for organization:', err);
    }
  }, [user?.id])

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
      const nextChecked = !target.is_checked

      const { error } = await supabase
        .from('checks')
        .update({ is_checked: nextChecked })
        .eq('id', checkId)
        .eq('organization_id', currentOrganizationId)
      if (error) throw error
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, is_checked: nextChecked, updated_at: new Date().toISOString() }
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

  const handleRunAnalysis = useCallback(async (checkId) => {
    // This function will be called by the Checks component
    // The actual analysis will be triggered by the MCPIntegration component
    console.log('Run analysis requested for check:', checkId)
  }, [])

  // TODO: enable chat interface when chatting with AI Agent is possible
  // const handleChatToggle = useCallback(() => {
  //   setChatCollapsed(prev => !prev)
  // }, [])

  // TODO: enable when in platform spreadsheets are available
  // Handle spreadsheet delete
  // const handleSpreadsheetDelete = useCallback(async (spreadsheetId) => {
  //   try {
  //     await deleteSpreadsheet(spreadsheetId)
  //     // If we deleted the current spreadsheet, switch to the first available one
  //     if (currentSpreadsheetId === spreadsheetId) {
  //       const remainingSpreadsheets = spreadsheets.filter(s => s.id !== spreadsheetId)
  //       if (remainingSpreadsheets.length > 0) {
  //         setCurrentSpreadsheetId(remainingSpreadsheets[0].id)
  //       } else {
  //         // Create a new spreadsheet if none remain
  //         const newSpreadsheet = await createSpreadsheet('Untitled Spreadsheet')
  //         setCurrentSpreadsheetId(newSpreadsheet.id)
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error deleting spreadsheet:', error)
  //   }
  // }, [deleteSpreadsheet, currentSpreadsheetId, spreadsheets, createSpreadsheet])

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
          onLoadOrganizationChecks={handleLoadOrganizationChecks}
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
                  onCheckSelect={handleCheckSelect}
                  onCreateCheck={handleCreateCheck}
                  onRenameCheck={handleRenameCheck}
                  onDeleteCheck={handleDeleteCheck}
                  onToggleCheck={handleToggleCheck}
                  onUpdateDescription={handleUpdateDescription}
                  onRunAnalysis={handleRunAnalysis}
                  user={user}
                />
              ) : currentOrganizationId && user?.id ? (
                <OrganizationManagement 
                  organization={organizations.find(org => org.id === currentOrganizationId && org.created_at && org.updated_at)}
                  onOrganizationUpdate={(updatedOrg) => {
                    setOrganizations(prev => prev.map(org => 
                      org.id === updatedOrg.id ? updatedOrg : org
                    ))
                  }}
                  onIntegrationUpdate={() => {
                    // Integration updated, could refresh data if needed
                  }}
                />
              ) : organizations.length === 0 ? (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm8 0a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Start by creating a new organization</h3>
                    <p className="text-gray-500 mb-4">Create an organization to manage your checks and integrations</p>
                    <button
                      onClick={handleCreateOrganization}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Create Organization
                    </button>
                  </div>
                </div>
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

          {/* TODO: enable chat interface when chatting with AI Agent is possible */}
          {/* Chat interface */}
          {/* <div className="flex-shrink-0 w-full lg:w-auto">
            <ChatInterface 
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
              onToolCall={handleToolCallRegistration}
              onCancel={handleCancel}
              llmService={llmServiceRef.current}
              onAddBotMessage={handleBotMessageRegistration}
              isCollapsed={chatCollapsed}
              onToggleCollapse={handleChatToggle}
            />
          </div> */}
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
