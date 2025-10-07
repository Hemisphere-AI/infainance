import React, { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
import PropTypes from 'prop-types'
import ChatInterface from './components/ChatInterface'
import Sidebar from './components/Sidebar'
import GoogleSheetsEmbed from './components/GoogleSheetsEmbed'
import { SupabaseAuthProvider, useSupabaseAuth } from './contexts/SupabaseAuthContext'
import { useSpreadsheet, useUserSpreadsheets } from './hooks/useSpreadsheet'
import LoginPage from './components/LoginPage'
import LandingPage from './components/LandingPage'
import TermsOfService from './components/TermsOfService'
import PrivacyPolicy from './components/PrivacyPolicy'
import UserProfile from './components/UserProfile'
import { LLMService } from './services/llmService'

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
  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState(null)
  const [spreadsheetData, setSpreadsheetData] = useState([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [saveStatus, setSaveStatus] = useState({ type: null, message: null }) // 'saving', 'success', 'error'
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState({
    sheetUrl: '',
    sheetId: '',
    isConfigured: false,
    isPublic: false,
    refreshInterval: 30000,
    autoRefresh: true
  })
  const [googleSheetsVisible, setGoogleSheetsVisible] = useState(true)
  const toolCallHandlerRef = useRef(null)
  const addBotMessageRef = useRef(null)
  const llmServiceRef = useRef(null)

  // Load user's spreadsheets
  const { 
    spreadsheets, 
    loading: spreadsheetsLoading, 
    createSpreadsheet,
    renameSpreadsheet,
    deleteSpreadsheet
  } = useUserSpreadsheets(user.id)


  // Load current spreadsheet
  const { 
    spreadsheet, 
    loading: spreadsheetLoading, 
    saving, 
    saveSpreadsheet,
    updateName
  } = useSpreadsheet(currentSpreadsheetId, user.id)

  // Debug current spreadsheet ID changes
  useEffect(() => {
  }, [currentSpreadsheetId])

  // Initialize with first spreadsheet or create new one
  useEffect(() => {
    if (spreadsheets.length > 0 && !currentSpreadsheetId) {
      setCurrentSpreadsheetId(spreadsheets[0].id)
    } else if (spreadsheets.length === 0 && !spreadsheetsLoading) {
      // Create a new spreadsheet for the user
      createSpreadsheet('Untitled Spreadsheet').then((newSpreadsheet) => {
        setCurrentSpreadsheetId(newSpreadsheet.id)
      }).catch((error) => {
        console.error('Error creating spreadsheet:', error)
      })
    }
  }, [spreadsheets, currentSpreadsheetId, spreadsheetsLoading, createSpreadsheet, user.id])

  // Load initial spreadsheet data (only when spreadsheet ID changes, not when user edits)
  useEffect(() => {
    if (spreadsheet?.data && Array.isArray(spreadsheet.data)) {
      setSpreadsheetData(spreadsheet.data)
    } else if (spreadsheet && (!spreadsheet.data || !Array.isArray(spreadsheet.data))) {
      setSpreadsheetData([])
    }
  }, [spreadsheet?.id]) // Only trigger when spreadsheet ID changes, not on data changes

  // Handle spreadsheet data changes
  const handleSpreadsheetChange = useCallback(async (newData) => {
    setSpreadsheetData(newData)
    
    // Update LLM service with new data
    if (llmServiceRef.current) {
      llmServiceRef.current.updateSpreadsheetData(newData)
    }
    
    // Debounce saves to avoid too many database calls
    if (currentSpreadsheetId) {
      try {
        setSaveStatus({ type: 'saving', message: 'Saving changes...' })
        await saveSpreadsheet(newData)
        setSaveStatus({ type: 'success', message: 'Changes saved successfully' })
        
        // Clear success message after 2 seconds
        setTimeout(() => {
          setSaveStatus({ type: null, message: null })
        }, 2000)
      } catch (error) {
        console.error('❌ Error saving spreadsheet:', error)
        setSaveStatus({ type: 'error', message: 'Failed to save changes. Please try again.' })
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          setSaveStatus({ type: null, message: null })
        }, 5000)
      }
    }
  }, [currentSpreadsheetId, saveSpreadsheet])

  // Initialize LLM service when user and spreadsheet data are available
  useEffect(() => {
    if (user && spreadsheetData) {
      llmServiceRef.current = new LLMService(
        spreadsheetData,
        handleSpreadsheetChange,
        toolCallHandlerRef.current,
        user
      )
    }
  }, [user, spreadsheetData, handleSpreadsheetChange])

  // Handle tool call registration from ChatInterface
  const handleToolCallRegistration = useCallback((handler) => {
    toolCallHandlerRef.current = handler
  }, [])

  // Handle bot message registration from ChatInterface
  const handleBotMessageRegistration = useCallback((handler) => {
    addBotMessageRef.current = handler
  }, [])

  // Handle sending messages from ChatInterface
  const handleSendMessage = useCallback(async (message) => {
    if (!llmServiceRef.current) {
      console.error('LLM service not initialized')
      return 'Error: LLM service not available'
    }

    try {
      setIsChatLoading(true)
      const response = await llmServiceRef.current.chat(message)
      
      // Update token quota status after successful completion
      if (llmServiceRef.current) {
        // Add a small delay to ensure token cache is fully updated
        setTimeout(async () => {
          try {
            const updatedQuotaStatus = await llmServiceRef.current.getTokenQuotaStatus();
            // Dispatch a custom event to notify UserProfile component
            window.dispatchEvent(new CustomEvent('tokenQuotaUpdated', { 
              detail: updatedQuotaStatus 
            }));
          } catch (error) {
            console.error('Error updating token quota status:', error);
          }
        }, 100);
      }
      
      return response
    } catch (error) {
      console.error('Error in LLM service:', error)
      return `Error: ${error.message}`
    } finally {
      setIsChatLoading(false)
    }
  }, [])

  // Handle canceling LLM requests
  const handleCancel = useCallback(() => {
    if (llmServiceRef.current) {
      llmServiceRef.current.cancel()
    }
    setIsChatLoading(false)
  }, [])

  // Create new spreadsheet
  const handleCreateSpreadsheet = useCallback(async () => {
    try {
      const newSpreadsheet = await createSpreadsheet('Untitled Spreadsheet')
      setCurrentSpreadsheetId(newSpreadsheet.id)
      setSpreadsheetData([])
    } catch (error) {
      console.error('Error creating spreadsheet:', error)
    }
  }, [createSpreadsheet])

  // Handle spreadsheet selection
  const handleSpreadsheetSelect = useCallback((spreadsheetId) => {
    if (spreadsheetId !== currentSpreadsheetId) {
      setCurrentSpreadsheetId(spreadsheetId)
      // Let the useEffect handle data loading when spreadsheet ID changes
    }
  }, [currentSpreadsheetId])

  // Handle spreadsheet rename
  const handleSpreadsheetRename = useCallback(async (spreadsheetId, newName) => {
    try {
      // Update the current spreadsheet name if it's the one being renamed
      if (spreadsheetId === currentSpreadsheetId) {
        await updateName(newName)
      }
      // Also update the spreadsheets list
      await renameSpreadsheet(spreadsheetId, newName)
    } catch (error) {
      console.error('Error renaming spreadsheet:', error)
    }
  }, [renameSpreadsheet, updateName, currentSpreadsheetId])

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const handleChatToggle = useCallback(() => {
    setChatCollapsed(prev => !prev)
  }, [])

  // Handle spreadsheet delete
  const handleSpreadsheetDelete = useCallback(async (spreadsheetId) => {
    try {
      await deleteSpreadsheet(spreadsheetId)
      // If we deleted the current spreadsheet, switch to the first available one
      if (currentSpreadsheetId === spreadsheetId) {
        const remainingSpreadsheets = spreadsheets.filter(s => s.id !== spreadsheetId)
        if (remainingSpreadsheets.length > 0) {
          setCurrentSpreadsheetId(remainingSpreadsheets[0].id)
        } else {
          // Create a new spreadsheet if none remain
          const newSpreadsheet = await createSpreadsheet('Untitled Spreadsheet')
          setCurrentSpreadsheetId(newSpreadsheet.id)
        }
      }
    } catch (error) {
      console.error('Error deleting spreadsheet:', error)
    }
  }, [deleteSpreadsheet, currentSpreadsheetId, spreadsheets, createSpreadsheet])



  if (spreadsheetsLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If no spreadsheets and not loading, show a message and create one
  if (spreadsheets.length === 0 && !spreadsheetsLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Creating your first spreadsheet...</p>
        </div>
      </div>
    )
  }

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
            <UserProfile llmService={llmServiceRef.current} />
          </div>
        </div>
      </div>

      {/* Main content area with sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          spreadsheets={spreadsheets}
          currentSpreadsheetId={currentSpreadsheetId}
          onSpreadsheetSelect={handleSpreadsheetSelect}
          onCreateSpreadsheet={handleCreateSpreadsheet}
          onRenameSpreadsheet={handleSpreadsheetRename}
          onDeleteSpreadsheet={handleSpreadsheetDelete}
          isOpen={sidebarOpen}
          onToggle={handleSidebarToggle}
        />

        {/* Content area */}
        <div className="flex-1 flex flex-col lg:flex-row px-4 py-4 min-h-0 overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 lg:mr-4 mb-4 lg:mb-0 min-w-0">
            {/* Google Sheets Embed - Above Graph Container */}
            <GoogleSheetsEmbed
              onSheetDataUpdate={(data, headers) => {
                // Update the spreadsheet data with Google Sheets data
                setSpreadsheetData(data)
                console.log('Google Sheets data updated:', { data, headers })
              }}
              onConfigChange={setGoogleSheetsConfig}
              isVisible={googleSheetsVisible}
              onToggleVisibility={() => setGoogleSheetsVisible(!googleSheetsVisible)}
              currentSpreadsheetId={currentSpreadsheetId}
              userId={user?.id}
            />


          </div>

          {/* Chat interface */}
          <div className="flex-shrink-0 w-full lg:w-auto">
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
