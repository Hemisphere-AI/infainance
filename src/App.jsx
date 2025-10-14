import React, { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
// import { FileSpreadsheet } from 'lucide-react'
import { CheckSquare } from 'lucide-react'
import PropTypes from 'prop-types'
// TODO: enable chat interface when chatting with AI Agent is possible
// import ChatInterface from './components/ChatInterface'
import Sidebar from './components/Sidebar'
import Checks from './components/Checks'
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
  // TODO: user parameter will be used when implementing database integration
  console.log('User:', user?.email) // Use user to avoid linting error
  // TODO: enable when in platform spreadsheets are available
  // const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState(null)
  // const [spreadsheetData, setSpreadsheetData] = useState([])
  
  // Checks state
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

  // Load checks for the signed-in user
  useEffect(() => {
    let isMounted = true
    const loadChecks = async () => {
      try {
        const { data, error } = await supabase
          .from('checks')
          .select('id, name, description, status, created_at, updated_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (error) throw error
        if (!isMounted) return
        setChecks(data || [])
        if ((data || []).length > 0) {
          setCurrentCheckId((data || [])[0].id)
        } else {
          setCurrentCheckId(null)
        }
      } catch (err) {
        console.error('Failed to load checks:', err)
      }
    }

    if (user?.id) {
      loadChecks()
    }

    return () => {
      isMounted = false
    }
  }, [user?.id])

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

  // Check management functions
  const handleCreateCheck = useCallback(async () => {
    try {
      const defaultName = `Check ${checks.length + 1}`
      const { data, error } = await supabase
        .from('checks')
        .insert({
          user_id: user.id,
          name: defaultName,
          description: '',
          status: 'active'
        })
        .select('id, name, description, status, created_at, updated_at')
        .single()

      if (error) throw error
      setChecks(prev => [...prev, data])
      setCurrentCheckId(data.id)
    } catch (err) {
      console.error('Failed to create check:', err)
    }
  }, [checks.length, user.id])

  const handleCheckSelect = useCallback((checkId) => {
    setCurrentCheckId(checkId)
  }, [])

  const handleRenameCheck = useCallback(async (checkId, newName) => {
    try {
      const { error } = await supabase
        .from('checks')
        .update({ name: newName })
        .eq('id', checkId)
        .eq('user_id', user.id)
      if (error) throw error
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, name: newName, updated_at: new Date().toISOString() }
          : check
      ))
    } catch (err) {
      console.error('Failed to rename check:', err)
    }
  }, [user.id])

  const handleDeleteCheck = useCallback(async (checkId) => {
    try {
      const { error } = await supabase
        .from('checks')
        .delete()
        .eq('id', checkId)
        .eq('user_id', user.id)
      if (error) throw error
      setChecks(prev => prev.filter(check => check.id !== checkId))
      if (currentCheckId === checkId) {
        setCurrentCheckId(null)
      }
    } catch (err) {
      console.error('Failed to delete check:', err)
    }
  }, [currentCheckId, user.id])

  const handleToggleCheck = useCallback(async (checkId) => {
    try {
      const target = checks.find(c => c.id === checkId)
      if (!target) return
      const nextStatus = target.status === 'completed' ? 'active' : 'completed'
      const { error } = await supabase
        .from('checks')
        .update({ status: nextStatus })
        .eq('id', checkId)
        .eq('user_id', user.id)
      if (error) throw error
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, status: nextStatus, updated_at: new Date().toISOString() }
          : check
      ))
    } catch (err) {
      console.error('Failed to toggle check:', err)
    }
  }, [checks, user.id])

  const handleUpdateDescription = useCallback(async (checkId, newDescription) => {
    try {
      const { error } = await supabase
        .from('checks')
        .update({ description: newDescription })
        .eq('id', checkId)
        .eq('user_id', user.id)
      if (error) throw error
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, description: newDescription, updated_at: new Date().toISOString() }
          : check
      ))
    } catch (err) {
      console.error('Failed to update description:', err)
    }
  }, [user.id])

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



  // TODO: enable when in platform spreadsheets are available
  // if (spreadsheetsLoading) {
  //   return (
  //     <div className="h-screen bg-gray-50 flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
  //         <p className="text-gray-600">Loading...</p>
  //       </div>
  //     </div>
  //   )
  // }

  // If no spreadsheets and not loading, show a message and create one
  // if (spreadsheets.length === 0 && !spreadsheetsLoading) {
  //   return (
  //     <div className="h-screen bg-gray-50 flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
  //         <p className="text-gray-600">Creating your first spreadsheet...</p>
  //       </div>
  //     </div>
  //   )
  // }

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
          checks={checks}
          currentCheckId={currentCheckId}
          onCheckSelect={handleCheckSelect}
          onCreateCheck={handleCreateCheck}
          onRenameCheck={handleRenameCheck}
          onDeleteCheck={handleDeleteCheck}
          isOpen={sidebarOpen}
          onToggle={handleSidebarToggle}
        />

        {/* Content area */}
        <div className="flex-1 flex flex-col lg:flex-row px-4 py-4 min-h-0 overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 lg:mr-4 mb-4 lg:mb-0 min-w-0">
            {/* Checks view */}
            {currentCheckId ? (
              <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden">
                <Checks 
                  checks={checks}
                  currentCheckId={currentCheckId}
                  onCheckSelect={handleCheckSelect}
                  onCreateCheck={handleCreateCheck}
                  onRenameCheck={handleRenameCheck}
                  onDeleteCheck={handleDeleteCheck}
                  onToggleCheck={handleToggleCheck}
                  onUpdateDescription={handleUpdateDescription}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-center">
                  <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No check selected</p>
                  <p className="text-gray-400 text-xs mt-1">Select a check from the sidebar or create a new one</p>
                </div>
              </div>
            )}


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
