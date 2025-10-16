import React, { useState, useCallback, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { ExternalLink, X, FileSpreadsheet, LogIn, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ReactSpreadsheet from '../Spreadsheet.jsx'
import { googleOAuthService } from '../services/googleOAuthService.js'
import { googleSheetsService } from '../services/googleSheetsService.js'

const GoogleSheetsEmbed = ({ 
  onSheetDataUpdate,
  onConfigChange,
  isVisible = true,
  onToggleVisibility,
  currentSpreadsheetId,
  userId,
  userEmail,
  currentSpreadsheetName,
  onSpreadsheetRename
}) => {
  const [config, setConfig] = useState({
    sheetUrl: '',
    sheetId: '',
    isConfigured: false,
    isPublic: false,
    refreshInterval: 30000, // 30 seconds
    autoRefresh: true
  })
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [error, setError] = useState(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)

  // Extract sheet ID from Google Sheets URL
  const extractSheetId = useCallback((url) => {
    if (!url) return ''
    
    // Clean the URL first
    let cleanUrl = url.trim()
    
    // Handle different Google Sheets URL formats
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /\/edit#gid=([a-zA-Z0-9-_]+)/,
      /\/edit\?usp=sharing.*#gid=([a-zA-Z0-9-_]+)/
    ]
    
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern)
      if (match) {
        const sheetId = match[1]
        // Validate that it looks like a Google Sheets ID (usually 44 characters)
        if (sheetId.length >= 20) {
          return sheetId
        }
      }
    }
    
    return ''
  }, [])

  // Handle configuration save
  const handleSaveConfig = useCallback(async () => {
    const sheetId = extractSheetId(config.sheetUrl)
    
    if (!sheetId) {
      setError('Invalid Google Sheets URL. Please provide a valid Google Sheets URL.')
      return
    }

    try {
      // Create or update spreadsheet record in database
      const { data: spreadsheet, error: spreadsheetError } = await supabase
        .from('spreadsheets')
        .upsert({
          id: currentSpreadsheetId,
          user_id: userId,
          name: currentSpreadsheetName || `Google Sheets - ${sheetId}`,
          google_sheet_id: sheetId,
          google_sheet_url: `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single()

      if (spreadsheetError) {
        console.error('Error creating spreadsheet record:', spreadsheetError)
        
        // If columns don't exist, show a helpful message
        if (spreadsheetError.code === 'PGRST204' || spreadsheetError.message.includes('column')) {
          setError('Google Sheets integration columns not found. Please run database migration first.')
        } else {
          setError('Failed to save spreadsheet configuration. Please try again.')
        }
        return
      }

      console.log('✅ Spreadsheet record created/updated:', spreadsheet)

      const newConfig = {
        ...config,
        sheetId,
        isConfigured: true
      }
      
      setConfig(newConfig)
      setIsConfiguring(false)
      setError(null)
      
      if (onConfigChange) {
        onConfigChange(newConfig)
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      setError('Failed to save configuration. Please try again.')
    }
  }, [config, extractSheetId, onConfigChange, currentSpreadsheetId])

  // Handle configuration cancel
  const handleCancelConfig = useCallback(() => {
    setIsConfiguring(false)
    setError(null)
  }, [])

  // Real-time sync state
  // const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  // const [lastKnownModified, setLastKnownModified] = useState(null)
  // const [syncInterval, setSyncInterval] = useState(null)
  const [lastDataHash, setLastDataHash] = useState(null)
  // const [isDataChanging, setIsDataChanging] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null) // 'saving', 'saved', 'syncing'

  // Load existing configuration on mount
  const loadExistingConfig = useCallback(async () => {
    if (!currentSpreadsheetId) return

    try {
      const { data: spreadsheet, error } = await supabase
        .from('spreadsheets')
        .select('google_sheet_id, name')
        .eq('id', currentSpreadsheetId)
        .single()

      if (error) {
        return
      }

      if (!spreadsheet || !spreadsheet.google_sheet_id) return
        
      const nextConfig = {
          sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheet.google_sheet_id}/edit`,
          sheetId: spreadsheet.google_sheet_id,
          isConfigured: true,
          isPublic: false,
          refreshInterval: 30000,
          autoRefresh: true
        }
        
      // De-duplicate updates to avoid loops
      const prev = config
      const noChange = prev.sheetId === nextConfig.sheetId && prev.sheetUrl === nextConfig.sheetUrl && prev.isConfigured === nextConfig.isConfigured
      if (noChange) return

      setConfig(nextConfig)
      if (onConfigChange) onConfigChange(nextConfig)
    } catch (error) {
      console.error('Error loading existing configuration:', error)
    } finally {
      // Always mark config as loaded, even if there was an error
      setConfigLoaded(true)
    }
  }, [currentSpreadsheetId, onConfigChange, config])

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (googleOAuthService.isAuthenticated()) {
        await googleSheetsService.initializeAuth()
        setIsAuthenticated(true)
      }
    }
    checkAuth()
  }, [])

  // Auto-sync check function
  const checkAndAutoSync = useCallback(async () => {
    if (!config.sheetId || !userId) return

    try {
      const { googleServiceAccount } = await import('../services/googleServiceAccount.js')
      
      // Use last known modified time or current time as fallback
      const lastModified = new Date().toISOString()
      
      const result = await googleServiceAccount.autoSyncFromGoogleSheets(
        config.sheetId, 
        userId, 
        lastModified
      )
      
      if (result.success && result.synced) {
        setSyncStatus('synced')
        setLastSync(new Date())
        console.log('✅ Auto-sync completed successfully')
      } else if (result.success && !result.synced) {
        console.log('✅ No changes detected - sync not needed')
      }
    } catch (error) {
      console.error('❌ Auto-sync error:', error)
    }
  }, [config.sheetId, userId])

  // Load configuration on mount
  useEffect(() => {
    setConfigLoaded(false) // Reset config loaded state
    loadExistingConfig()
    // Reset creation attempt flag when spreadsheet changes
    setHasAttemptedCreation(false)
    // Only when spreadsheet ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpreadsheetId])

  // Auto-sync when config is loaded
  useEffect(() => {
    if (config.isConfigured && config.sheetId && userId) {
      // Trigger auto-sync check after a short delay
      const timeoutId = setTimeout(() => {
        checkAndAutoSync()
      }, 2000) // 2 second delay to ensure everything is loaded

      return () => clearTimeout(timeoutId)
    }
  }, [config.isConfigured, config.sheetId, userId, checkAndAutoSync])

  // Periodic polling for changes (every 30 seconds)
  useEffect(() => {
    if (config.isConfigured && config.sheetId && userId) {
      const intervalId = setInterval(() => {
        console.log('🔄 Periodic sync check...')
        checkAndAutoSync()
      }, 30000) // Check every 30 seconds

      return () => clearInterval(intervalId)
    }
  }, [config.isConfigured, config.sheetId, userId, checkAndAutoSync])

  // Auto-create Google Sheet if user doesn't have one (with debouncing)
  const [hasAttemptedCreation, setHasAttemptedCreation] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [isCreatingSheet, setIsCreatingSheet] = useState(false)
  const lastSyncTimeRef = useRef(0)
  
  useEffect(() => {
    const autoCreateGoogleSheet = async () => {
      // Only create if we have all required data AND no existing config AND config has been loaded
      if (!currentSpreadsheetId || !userId || !userEmail) return
      if (!configLoaded) {
        console.log('⏳ Waiting for config to load before auto-creation')
        return
      }
      if (config.sheetId && config.isConfigured) {
        console.log('✅ Already have Google Sheet configured, skipping auto-creation')
        return
      }
      if (hasAttemptedCreation) {
        console.log('⏸️ Already attempted creation, skipping')
        return
      }
      
      console.log('🔄 Auto-creating Google Sheet for new spreadsheet...')
      setHasAttemptedCreation(true)
      setIsCreatingSheet(true)
      
      try {
        const response = await fetch('http://localhost:3002/api/sheets/create-for-user', {
          method: 'POST',
        headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            userEmail,
            spreadsheetName: currentSpreadsheetName || 'Untitled Spreadsheet'
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            console.log('✅ Auto-created Google Sheet:', result)
            
            // Update the database record with Google Sheet information
            try {
              const { error: updateError } = await supabase
                .from('spreadsheets')
                .update({
                  google_sheet_id: result.spreadsheetId,
                  google_sheet_url: `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`,
                  updated_at: new Date().toISOString()
                })
                .eq('id', currentSpreadsheetId)

              if (updateError) {
                console.error('❌ Error updating database with Google Sheet info:', updateError)
              } else {
                console.log('✅ Updated database with Google Sheet info')
              }
            } catch (dbError) {
              console.error('❌ Error updating database:', dbError)
            }
            
            // Update config with the new Google Sheet info
            const newConfig = {
              sheetUrl: result.spreadsheetUrl,
              sheetId: result.spreadsheetId,
              isConfigured: true,
              isPublic: false,
              refreshInterval: 30000,
              autoRefresh: true
            }
            setConfig(newConfig)
            if (onConfigChange) {
              onConfigChange(newConfig)
            }
            
            // Automatically fetch data from the new Google Sheet
            console.log('🔄 Auto-fetching data from newly created Google Sheet...')
            setTimeout(() => {
              fetchSheetData()
            }, 1000) // Small delay to ensure config is updated
            
            // Force a re-render to show the new Google Sheet immediately
            setLastSync(new Date())
            setError(null)
          }
        }
        setIsCreatingSheet(false)
      } catch (error) {
        console.warn('⚠️ Could not auto-create Google Sheet:', error)
        setHasAttemptedCreation(false) // Allow retry on error
        setIsCreatingSheet(false)
      }
    }
    
    autoCreateGoogleSheet()
  }, [currentSpreadsheetId, userId, userEmail, currentSpreadsheetName, config.sheetId, config.isConfigured, hasAttemptedCreation, configLoaded])

  // Fetch data from Google Sheets via backend API (service account)
  const fetchSheetData = useCallback(async () => {
    if (!config.sheetId || !config.isConfigured) return

    // Debounce: prevent sync from running too frequently (max once per 5 seconds)
    const now = Date.now()
    if (now - lastSyncTimeRef.current < 5000) {
      console.log('⏱️ Sync debounced - too soon since last sync')
      return
    }
    lastSyncTimeRef.current = now

    setError(null)

    try {
      // Use our backend API instead of direct Google Sheets CSV export
      const response = await fetch(`http://localhost:3002/api/sheets/read?spreadsheetId=${config.sheetId}&range=A1:Z1000`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sheet data')
      }
      
      const values = result.values || []
      
      // Handle empty sheets gracefully - create empty grid instead of throwing error
      if (!values || values.length === 0) {
        console.log('📋 Sheet is empty, creating empty grid')
        
        // Create an empty 100x10 grid
        const emptySpreadsheetData = []
        for (let rowIndex = 0; rowIndex < 100; rowIndex++) {
          const row = []
          for (let colIndex = 0; colIndex < 10; colIndex++) {
            row.push({
              value: '',
              displayValue: '',
              computedValue: '',
              isNumber: false,
              cellType: 'text'
            })
          }
          emptySpreadsheetData.push(row)
        }
        
        console.log('✅ Created empty grid for new sheet')
        
        if (onSheetDataUpdate) {
          onSheetDataUpdate(emptySpreadsheetData, [])
          console.log('✅ Empty spreadsheet data updated in app')
        }
        
        setSyncStatus('synced')
        return
      }
      
      // Convert values array to spreadsheet format
      const maxRows = Math.max(values.length, 100) // Ensure we have enough rows
      const maxCols = Math.max(...values.map(row => row.length), 10) // Ensure we have enough columns
      
      const spreadsheetData = []
      
      // Initialize the 2D array
      for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
        const row = []
        for (let colIndex = 0; colIndex < maxCols; colIndex++) {
          row.push({
            value: '',
            displayValue: '',
            computedValue: '',
            isNumber: false,
            cellType: 'text'
          })
        }
        spreadsheetData.push(row)
      }
      
      // Fill in the actual data from Google Sheets
      values.forEach((row, rowIndex) => {
        row.forEach((cellValue, colIndex) => {
          
          // Enhanced parsing for different cell types
          let parsedValue = cellValue
          let isNumber = false
          let isCurrency = false
          let currencySymbol = null
          let isFormula = false
          let cellType = 'text'
          
          // Check for formulas first
          if (cellValue && String(cellValue).startsWith('=')) {
            isFormula = true
            cellType = 'formula'
            parsedValue = cellValue // Keep the formula as-is
          }
          // Note: CSV export from Google Sheets doesn't preserve original formulas
          // Formulas are exported as their calculated values
          // To get actual formulas, we would need to use Google Sheets API
          // Check for currency values
          else if (cellValue && typeof cellValue === 'string') {
            const trimmedValue = cellValue.trim()
            
            // Note: CSV export may not preserve currency symbols from Google Sheets
            // This detection works if the CSV contains the symbols, but Google Sheets
            // might export formatted currency as plain numbers
            
            // Detect Euro (€) currency
            if (trimmedValue.startsWith('€')) {
              const numericValue = trimmedValue.slice(1).trim()
              if (!isNaN(parseFloat(numericValue))) {
                parsedValue = parseFloat(numericValue)
                isNumber = true
                isCurrency = true
                currencySymbol = '€'
                cellType = 'number'
              }
            }
            // Detect Dollar ($) currency
            else if (trimmedValue.startsWith('$')) {
              const numericValue = trimmedValue.slice(1).trim()
              if (!isNaN(parseFloat(numericValue))) {
                parsedValue = parseFloat(numericValue)
                isNumber = true
                isCurrency = true
                currencySymbol = '$'
                cellType = 'number'
              }
            }
            // Detect Pound (£) currency
            else if (trimmedValue.startsWith('£')) {
              const numericValue = trimmedValue.slice(1).trim()
              if (!isNaN(parseFloat(numericValue))) {
                parsedValue = parseFloat(numericValue)
                isNumber = true
                isCurrency = true
                currencySymbol = '£'
                cellType = 'number'
              }
            }
            // Check for percentage values
            else if (trimmedValue.endsWith('%')) {
              const numericValue = trimmedValue.slice(0, -1)
              if (!isNaN(parseFloat(numericValue))) {
                parsedValue = parseFloat(numericValue) / 100 // Convert to decimal
                isNumber = true
                cellType = 'number'
              }
            }
            // Regular number parsing
            else if (cellValue !== '' && !isNaN(cellValue) && !isNaN(parseFloat(cellValue))) {
              parsedValue = parseFloat(cellValue)
              isNumber = true
              cellType = 'number'
            }
          }
          
          // Assign cell data directly
          if (spreadsheetData[rowIndex] && spreadsheetData[rowIndex][colIndex]) {
            spreadsheetData[rowIndex][colIndex] = {
              value: parsedValue,
              displayValue: cellValue,
              computedValue: cellValue,
              isNumber: isNumber,
              isCurrency: isCurrency,
              currencySymbol: currencySymbol,
              isFormula: isFormula,
              cellType: cellType
            }
          }
        })
      })

      // Check if data has actually changed
      const currentDataHash = JSON.stringify(spreadsheetData)
      if (lastDataHash === currentDataHash) {
        console.log('📊 No changes detected, skipping sync')
        setSyncStatus(null) // Clear any previous status
        return
      }

      // Data has changed - show sync status
      setSyncStatus('syncing')
      // setIsDataChanging(true)

      setLastSync(new Date())
      setError(null)
      setLastDataHash(currentDataHash)
      
      console.log('🔄 Google Sheets sync successful:', {
        rowCount: values.length,
        dataPreview: spreadsheetData.slice(0, 3),
        totalCells: spreadsheetData.length * (spreadsheetData[0]?.length || 0),
        sampleCell: spreadsheetData[0]?.[0],
        sampleData: values.slice(0, 2),
        firstRowData: spreadsheetData[0],
        cellC1: spreadsheetData[0]?.[2], // Column C (index 2)
        cellC4: spreadsheetData[3]?.[2], // Row 4, Column C
        rawDataPreview: values.slice(0, 3), // Show raw data
        currencyCells: spreadsheetData.flat().filter(cell => cell.isCurrency),
        formulaCells: spreadsheetData.flat().filter(cell => cell.isFormula)
      })
      
      if (onSheetDataUpdate) {
        onSheetDataUpdate(spreadsheetData, values[0] || [])
        console.log('✅ Spreadsheet data updated in app')
      }
      
      // Save to database
      try {
        setSyncStatus('saving')
        await saveToDatabase(spreadsheetData, values[0] || [])
        console.log('✅ Data saved to database')
        setSyncStatus('saved')
        
        // Clear the status after a short delay
        setTimeout(() => {
          setSyncStatus(null)
          // setIsDataChanging(false)
        }, 2000)
      } catch (dbError) {
        console.error('❌ Failed to save to database:', dbError)
        setSyncStatus(null)
        // setIsDataChanging(false)
        // Don't throw - we still want the app to update
      }
      
    } catch (err) {
      console.error('Error fetching sheet data:', err)
      setError(`Failed to sync with Google Sheets: ${err.message}`)
      setSyncStatus(null)
      // setIsDataChanging(false)
    }
  }, [config.sheetId, config.isConfigured, onSheetDataUpdate])

  // Save data to database
  const saveToDatabase = useCallback(async (spreadsheetData) => {
    try {
      console.log('💾 Saving Google Sheets data to database...')
      
      // Require a valid spreadsheet ID - no fallback to dummy string
      if (!currentSpreadsheetId) {
        console.error('❌ No valid spreadsheet ID available for saving Google Sheets data')
        setError('No spreadsheet selected. Please select or create a spreadsheet first.')
        return
      }
      
      const spreadsheetId = currentSpreadsheetId
      console.log('🆔 Using spreadsheet ID:', spreadsheetId)
      console.log('🆔 Current spreadsheet ID from props:', currentSpreadsheetId)
      
      // Prepare data for insertion first (don't delete until we're sure we have data)
      const cellsToInsert = []
      
      spreadsheetData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell.value !== '' && cell.value !== null && cell.value !== undefined) {
            // Determine if this is a formula or regular value
            const isFormula = cell.isFormula || (cell.value && String(cell.value).startsWith('='))
            
            cellsToInsert.push({
              spreadsheet_id: spreadsheetId,
              row_index: rowIndex,
              col_index: colIndex,
              formula: isFormula ? cell.value : null,
              display_value: cell.displayValue,
              cell_type: cell.cellType || 'text',
              is_currency: cell.isCurrency || false,
              currency_symbol: cell.currencySymbol || null,
              is_percentage: cell.isPercentage || false,
              formatting: cell.formatting || null,
              decimal_places: cell.decimalPlaces || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        })
      })
      
      if (cellsToInsert.length === 0) {
        console.log('⚠️ No data to save to database')
        return
      }
      
      // Only clear existing data AFTER we've prepared the new data
      console.log('🗑️ Clearing existing data for spreadsheet:', spreadsheetId)
      console.log('⚠️ WARNING: This will delete all existing data for this spreadsheet!')
      console.log('📊 About to insert', cellsToInsert.length, 'new cells')
      
      const { error: deleteError } = await supabase
        .from('spreadsheet_cells')
        .delete()
        .eq('spreadsheet_id', spreadsheetId)
      
      if (deleteError) {
        console.error('Error clearing existing data:', deleteError)
        // Continue anyway - maybe the spreadsheet doesn't exist yet
      }
      
      // Insert the data in batches (Supabase has a limit)
      const batchSize = 1000
      console.log('📤 Starting database insertion of', cellsToInsert.length, 'cells in batches of', batchSize)
      
      for (let i = 0; i < cellsToInsert.length; i += batchSize) {
        const batch = cellsToInsert.slice(i, i + batchSize)
        console.log(`📦 Inserting batch ${Math.floor(i/batchSize) + 1}: ${batch.length} cells`)
        
        const { data: insertData, error: insertError } = await supabase
          .from('spreadsheet_cells')
          .insert(batch)
          .select()
        
        if (insertError) {
          console.error('❌ Error inserting batch:', insertError)
          console.error('❌ Batch data that failed:', batch.slice(0, 3)) // Show first 3 cells of failed batch
          throw insertError
        } else {
          console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} inserted successfully:`, insertData?.length || 'unknown', 'rows')
        }
      }
      
      console.log(`✅ Successfully saved ${cellsToInsert.length} cells to database`)
      
      // Verify the data was actually inserted
      const { data: verifyData, error: verifyError } = await supabase
        .from('spreadsheet_cells')
        .select('*')
        .eq('spreadsheet_id', spreadsheetId)
        .limit(5)
      
      if (verifyError) {
        console.error('❌ Error verifying inserted data:', verifyError)
      } else {
        console.log('✅ Verification: Found', verifyData?.length || 0, 'cells in database for spreadsheet', spreadsheetId)
        if (verifyData && verifyData.length > 0) {
          console.log('📊 Sample of inserted data:', verifyData[0])
        }
      }
      
      // Debug: Show sample of what was saved
      const sampleCells = cellsToInsert.slice(0, 5)
      console.log('💾 Sample cells saved to database:', sampleCells.map(cell => ({
        row: cell.row_index,
        col: cell.col_index,
        formula: cell.formula,
        display_value: cell.display_value,
        cell_type: cell.cell_type,
        is_currency: cell.is_currency,
        currency_symbol: cell.currency_symbol,
        is_number: cell.is_number
      })))
      
    } catch (error) {
      console.error('❌ Error saving to database:', error)
      throw error
    }
  }, [currentSpreadsheetId])

  // One-time initial sync after configuration; no periodic auto-sync
  useEffect(() => {
    if (!config.isConfigured) return
    fetchSheetData()
  }, [config.isConfigured]) // Removed fetchSheetData from dependencies to prevent loop

  // Inline rename handlers
  const [editName, setEditName] = useState('')
  
  const handleNameDoubleClick = () => {
    setEditName(currentSpreadsheetName || '')
    setIsRenaming(true)
  }
  
  const handleNameChange = (e) => setEditName(e.target.value)
  
  const commitRename = async () => {
    const trimmed = (editName || '').trim()
    if (!trimmed || !currentSpreadsheetId || trimmed === currentSpreadsheetName) {
      setIsRenaming(false)
      return
    }
    try {
      if (onSpreadsheetRename) {
        await onSpreadsheetRename(currentSpreadsheetId, trimmed)
      }
      
      // Also update the Google Sheet title if we have a configured Google Sheet
      if (config.sheetId && config.isConfigured) {
        try {
          const result = await googleSheetsService.updateSpreadsheetTitle(config.sheetId, trimmed)
          if (result.success) {
            console.log('✅ Successfully updated Google Sheet title')
          } else {
            console.warn('⚠️ Failed to update Google Sheet title:', result.error)
          }
        } catch (error) {
          console.warn('⚠️ Error updating Google Sheet title:', error)
          // Don't throw here - we still want the local rename to succeed
        }
      }
      
      setIsRenaming(false)
    } catch (e) {
      console.error('Error renaming spreadsheet:', e)
      setIsRenaming(false)
    }
  }
  
  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setIsRenaming(false)
  }

  // Handle Google OAuth authentication
  const handleAuthenticate = useCallback(async () => {
    try {
      setAuthLoading(true)
      setError(null)

      if (!googleOAuthService.isConfigured()) {
        setError('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID in .env')
        return
      }

      const authUrl = googleOAuthService.getAuthUrl()
      window.location.href = authUrl
    } catch (error) {
      console.error('Authentication error:', error)
      setError(`Authentication failed: ${error.message}`)
    } finally {
      setAuthLoading(false)
    }
  }, [])

  // Handle logout
  const handleLogout = useCallback(() => {
    googleOAuthService.logout()
    setIsAuthenticated(false)
    setConfig({
      sheetUrl: '',
      sheetId: '',
      isConfigured: false,
      isPublic: false,
      refreshInterval: 30000,
      autoRefresh: true
    })
    if (onConfigChange) {
      onConfigChange({
        sheetUrl: '',
        sheetId: '',
        isConfigured: false,
        isPublic: false,
        refreshInterval: 30000,
        autoRefresh: true
      })
    }
  }, [onConfigChange])

  // No auto-refresh needed for iframe - it updates automatically

  if (!isVisible) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Google Sheets Sync</h3>
              <p className="text-xs text-gray-500">Connect to Google Sheets for real-time data</p>
            </div>
          </div>
          <button
            onClick={onToggleVisibility}
            className="text-gray-400 hover:text-gray-600"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (isConfiguring) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Configure Google Sheets Embed</h3>
          <button
            onClick={handleCancelConfig}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Google Sheets URL
            </label>
            <input
              type="url"
              value={config.sheetUrl}
              onChange={(e) => setConfig(prev => ({ ...prev, sheetUrl: e.target.value }))}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1 space-y-1">
              <p>Make sure the sheet is publicly accessible (Anyone with the link can view)</p>
              {config.sheetUrl && extractSheetId(config.sheetUrl) && (
                <p className="text-green-600">✅ Valid Google Sheets URL detected</p>
              )}
              {config.sheetUrl && !extractSheetId(config.sheetUrl) && (
                <p className="text-red-600">❌ Invalid URL format. Make sure it contains &quot;/spreadsheets/d/&quot;</p>
              )}
            </div>
          </div>
          
          {/* Info notices removed as requested */}
          
          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
          
          <div className="flex space-x-2 pt-2">
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex-1"
            >
              Connect
            </button>
            <button
              onClick={handleCancelConfig}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Google Sheets Integration</h3>
              <p className="text-xs text-gray-500">Connect to Google Sheets for real-time sync</p>
            </div>
          </div>
          <button
            onClick={handleAuthenticate}
            disabled={authLoading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-1"
          >
            <LogIn className="w-3 h-3" />
            <span>{authLoading ? 'Connecting...' : 'Connect'}</span>
          </button>
        </div>
        {error && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </div>
    )
  }

  if (!config.isConfigured) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Google Sheets Embed</h3>
              <p className="text-xs text-gray-500">Configure your Google Sheet for sync</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsConfiguring(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
          >
            Configure
          </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs hover:bg-gray-200"
            >
              Logout
          </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-0 h-full flex flex-col">
      {/* Card Container matches ChatInterface white area */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        {/* Header inside the card so the light grey border wraps around */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex items-center space-x-2">
              {isRenaming ? (
                <input
                  type="text"
                  value={editName}
                  onChange={handleNameChange}
                  onBlur={commitRename}
                  onKeyDown={handleNameKeyDown}
                  className="text-sm font-medium text-gray-900 bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <h3
                  className="text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
                  onDoubleClick={handleNameDoubleClick}
                  title="Double-click to rename"
                >
                  {currentSpreadsheetName || 'Google Sheets'}
                </h3>
              )}
              <span className="text-xs text-gray-500 ml-2">
                {syncStatus === 'syncing' && 'Synchronizing...'}
                {syncStatus === 'saving' && 'Saving...'}
                {(syncStatus === 'saved' || (!syncStatus && lastSync)) && 'Saved'}
                {!syncStatus && !lastSync && 'Google Sheets view'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {config.isConfigured && config.sheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-gray-600"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* White Content Area with Border - exactly like ChatInterface */}
        <div className="flex-1 flex flex-col">
        {/* Loading indicator for Google Sheet creation */}
        {isCreatingSheet && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="text-xs text-blue-600 flex items-center space-x-2">
              <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full"></div>
              <span>Creating Google Sheet...</span>
            </div>
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="text-xs text-red-600">
              <div className="font-medium">Connection Error:</div>
              <div className="mt-1">{error}</div>
              <div className="mt-2 text-xs text-red-500">
                • Make sure the sheet is shared with &quot;Anyone with the link can view&quot;<br/>
                • Check that the sheet has data in it
              </div>
            </div>
          </div>
        )}
        
        {/* Content area - like Messages in ChatInterface */}
        <div className="flex-1 min-h-0 p-0">
          {/* Read-only spreadsheet view from database */}
          {config.isConfigured && currentSpreadsheetId && !error && (
            <ReadOnlySheet spreadsheetId={currentSpreadsheetId} />
          )}
        </div>
        
        {/* Status Footer - like Input in ChatInterface */}
            <div className="p-4 border-t border-gray-200 bg-white text-xs text-gray-500">
          {error && (
            <span className="text-red-600">Connection failed - check settings</span>
          )}
          {!config.isConfigured && (
            <span>Configure Google Sheets to get started</span>
          )}
          {config.isConfigured && !error && (
            <span>
              {lastSync ? `updated: ${lastSync.toLocaleTimeString()}` : 'Ready'}
              {syncStatus === 'syncing' && ' - Synchronizing...'}
            </span>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

GoogleSheetsEmbed.propTypes = {
  onSheetDataUpdate: PropTypes.func,
  onConfigChange: PropTypes.func,
  isVisible: PropTypes.bool,
  onToggleVisibility: PropTypes.func,
  currentSpreadsheetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  userEmail: PropTypes.string,
  currentSpreadsheetName: PropTypes.string,
  onSpreadsheetRename: PropTypes.func
}

ReadOnlySheet.propTypes = {
  spreadsheetId: PropTypes.string
}

export default GoogleSheetsEmbed

// Internal read-only sheet renderer
function ReadOnlySheet({ spreadsheetId }) {
  const [grid, setGrid] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setErr(null)
        // Fetch cells from Supabase and build a dense 2D grid
        const { data, error } = await supabase
          .from('spreadsheet_cells')
          .select('row_index,col_index,formula,display_value,cell_type,is_currency,currency_symbol,is_percentage,formatting,decimal_places')
          .eq('spreadsheet_id', spreadsheetId)

        if (error) throw error

        const maxRow = (data?.length ? Math.max(...data.map(c => c.row_index)) : 0) || 0
        const maxCol = (data?.length ? Math.max(...data.map(c => c.col_index)) : 0) || 0
        const rows = Math.max(maxRow + 1, 20)
        const cols = Math.max(maxCol + 1, 10)

        const next = Array.from({ length: rows }, () => (
          Array.from({ length: cols }, () => ({
            value: '', displayValue: '', computedValue: '', cellType: 'text'
          }))
        ))

        for (const cell of data || []) {
          const r = cell.row_index
          const c = cell.col_index
          const val = cell.formula ? cell.formula : (cell.display_value ?? '')
          next[r][c] = {
            value: val,
            displayValue: cell.display_value ?? '',
            computedValue: cell.display_value ?? '',
            cellType: cell.cell_type || 'text',
            isCurrency: !!cell.is_currency,
            currencySymbol: cell.currency_symbol || null,
            isPercentage: !!cell.is_percentage,
            formatting: cell.formatting || null,
            decimalPlaces: cell.decimal_places ?? null,
            isFormula: !!cell.formula
          }
        }

        if (!cancelled) setGrid(next)
      } catch (e) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [spreadsheetId])

  if (loading) return <div className="text-xs text-gray-500">Loading...</div>
  if (err) return <div className="text-xs text-red-600">{err}</div>

  return (
    <div className="h-full">
      <ReactSpreadsheet
        data={grid}
        allSheetsData={{}}
        currentSheetName={'Sheet1'}
        onDataChange={() => {}}
        formulaDisplayMode={0}
        selectedCells={[]}
        onSelectedCellsChange={() => {}}
        highlightedBlock={null}
        readOnly={true}
      />
    </div>
  )
}

GoogleSheetsEmbed.propTypes = {
  onSheetDataUpdate: PropTypes.func,
  onConfigChange: PropTypes.func,
  isVisible: PropTypes.bool,
  onToggleVisibility: PropTypes.func,
  currentSpreadsheetId: PropTypes.string,
  userId: PropTypes.string,
  userEmail: PropTypes.string,
  currentSpreadsheetName: PropTypes.string,
  onSpreadsheetRename: PropTypes.func
}
