import React, { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Download, Calculator, BarChart3 } from 'lucide-react'
import * as XLSX from 'xlsx'
import PropTypes from 'prop-types'
import ReactSpreadsheet from './Spreadsheet'
import ChatInterface from './components/ChatInterface'
import Sidebar from './components/Sidebar'
import GraphContainer from './components/GraphContainer'
import { SupabaseAuthProvider, useSupabaseAuth } from './contexts/SupabaseAuthContext'
import { useSpreadsheet, useUserSpreadsheets } from './hooks/useSpreadsheet'
import LoginPage from './components/LoginPage'
import LandingPage from './components/LandingPage'
import TermsOfService from './components/TermsOfService'
import PrivacyPolicy from './components/PrivacyPolicy'
import UserProfile from './components/UserProfile'
import { LLMService } from './services/llmService'
import { graphService } from './services/graphService'

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
  const [formulaDisplayMode, setFormulaDisplayMode] = useState(0)
  const [selectedCells, setSelectedCells] = useState([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [saveStatus, setSaveStatus] = useState({ type: null, message: null }) // 'saving', 'success', 'error'
  const [graphs, setGraphs] = useState([])
  const [graphsLoading, setGraphsLoading] = useState(false)
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

  // Load graphs for current spreadsheet
  const loadGraphs = useCallback(async () => {
    if (!currentSpreadsheetId || !user?.id) return
    
    setGraphsLoading(true)
    try {
      const graphsData = await graphService.getGraphs(currentSpreadsheetId, user.id)
      
      // Map database fields to component props
      const mappedGraphs = graphsData.map(graph => ({
        id: graph.id,
        title: graph.title,
        xAxisRange: graph.label_range,
        yAxisRange: graph.value_range,
        isEditing: false
      }))
      
      setGraphs(mappedGraphs)
    } catch (error) {
      console.error('Error loading graphs:', error)
    } finally {
      setGraphsLoading(false)
    }
  }, [currentSpreadsheetId, user?.id])

  // Load graphs when spreadsheet changes
  useEffect(() => {
    loadGraphs()
  }, [loadGraphs])

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

  // Download as spreadsheet
  const downloadAsSpreadsheet = useCallback(() => {
    if (!spreadsheetData.length) return
    
    // Create a new workbook
    const wb = {
      SheetNames: ['Sheet1'],
      Sheets: {
        'Sheet1': {}
      }
    }

    // Convert data to worksheet format
    const ws = {}
    const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } }

    spreadsheetData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell && cell.value !== undefined && cell.value !== '') {
          const cellAddress = String.fromCharCode(65 + colIndex) + (rowIndex + 1)
          ws[cellAddress] = { v: cell.value }
          
          // Update range
          if (rowIndex > range.e.r) range.e.r = rowIndex
          if (colIndex > range.e.c) range.e.c = colIndex
        }
      })
    })

    ws['!ref'] = `${String.fromCharCode(65 + range.s.c)}${range.s.r + 1}:${String.fromCharCode(65 + range.e.c)}${range.e.r + 1}`
    wb.Sheets['Sheet1'] = ws

    // Convert to Excel file
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${spreadsheet?.name || 'spreadsheet'}.xlsx`
    a.click()
    
    URL.revokeObjectURL(url)
  }, [spreadsheetData, spreadsheet])


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
            {/* Graph Container - Separate container above everything */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col mb-4">
              <GraphContainer
                spreadsheetData={spreadsheetData}
                allSheetsData={{}}
                currentSheetName="Sheet1"
                graphs={graphs}
                onGraphsChange={setGraphs}
                spreadsheetId={currentSpreadsheetId}
                userId={user?.id}
              />
            </div>

            {/* Spreadsheet area - Separate container below graphs */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col min-h-0 max-w-full">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <EditableSpreadsheetName 
                      name={spreadsheet?.name || 'Untitled Spreadsheet'}
                      onRename={(newName) => handleSpreadsheetRename(currentSpreadsheetId, newName)}
                    />
                    {saveStatus.type && (
                      <span className="text-xs text-gray-500">
                        {saveStatus.type === 'saving' && 'Saving...'}
                        {saveStatus.type === 'success' && 'Saved'}
                        {saveStatus.type === 'error' && 'Save failed'}
                      </span>
                    )}
                  </div>
                  
                  {/* Formatting buttons */}
                  <div className="flex items-center space-x-2">
                    {/* Formula display mode button */}
                    <button
                      onClick={() => setFormulaDisplayMode((prev) => (prev + 1) % 3)}
                      className={`px-2 py-1 text-xs rounded border transition-colors flex items-center space-x-1 ${
                        formulaDisplayMode === 0
                          ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                          : formulaDisplayMode === 1
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : 'bg-blue-100 border-blue-300 text-blue-700'
                      }`}
                      title={
                        formulaDisplayMode === 0
                          ? 'Click to highlight formula cells'
                          : formulaDisplayMode === 1
                          ? 'Click to show all formulas'
                          : 'Click to reset to normal view'
                      }
                    >
                      <Calculator className="w-3 h-3" />
                      <span>fx</span>
                    </button>
                    
                    {/* Download button */}
                    <button
                      onClick={downloadAsSpreadsheet}
                      className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-200 transition-colors flex items-center space-x-1"
                      title="Download spreadsheet file"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>
              </div>
                
              <div className="flex-1 overflow-hidden min-h-0">
                {spreadsheetLoading ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p>Loading spreadsheet...</p>
                  </div>
                ) : (
                  <ReactSpreadsheet 
                    data={spreadsheetData}
                    allSheetsData={{}}
                    currentSheetName="Sheet1"
                    onDataChange={handleSpreadsheetChange}
                    formulaDisplayMode={formulaDisplayMode}
                    selectedCells={selectedCells}
                    onSelectedCellsChange={setSelectedCells}
                    highlightedBlock={null}
                  />
                )}
              </div>
            </div>
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
