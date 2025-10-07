import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { ExternalLink, Settings, X, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

const GoogleSheetsEmbed = ({ 
  onSheetDataUpdate,
  onConfigChange,
  isVisible = true,
  onToggleVisibility,
  currentSpreadsheetId,
  userId
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
          name: `Google Sheets - ${sheetId}`,
          google_sheet_id: sheetId,
          google_sheet_url: config.sheetUrl,
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
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [syncInterval, setSyncInterval] = useState(null)
  const [lastDataHash, setLastDataHash] = useState(null)
  const [isDataChanging, setIsDataChanging] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null) // 'saving', 'saved', 'syncing'

  // Load existing configuration on mount
  const loadExistingConfig = useCallback(async () => {
    if (!currentSpreadsheetId) return

    try {
      const { data: spreadsheet, error } = await supabase
        .from('spreadsheets')
        .select('google_sheet_id, google_sheet_url, name')
        .eq('id', currentSpreadsheetId)
        .single()

      if (error) {
        console.log('No existing Google Sheets configuration found')
        return
      }

      if (spreadsheet && spreadsheet.google_sheet_id) {
        console.log('📋 Loading existing Google Sheets configuration:', spreadsheet)
        
        const existingConfig = {
          sheetUrl: spreadsheet.google_sheet_url || '',
          sheetId: spreadsheet.google_sheet_id,
          isConfigured: true,
          isPublic: false,
          refreshInterval: 30000,
          autoRefresh: true
        }
        
        setConfig(existingConfig)
        
        if (onConfigChange) {
          onConfigChange(existingConfig)
        }
      }
    } catch (error) {
      console.error('Error loading existing configuration:', error)
    }
  }, [currentSpreadsheetId, onConfigChange])

  // Load configuration on mount
  React.useEffect(() => {
    loadExistingConfig()
  }, [loadExistingConfig])

  // Fetch data from Google Sheets (automatic sync)
  const fetchSheetData = useCallback(async () => {
    if (!config.sheetId || !config.isConfigured) return

    setError(null)

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv&gid=0`
      
      const response = await fetch(csvUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'text/csv'
        }
      })
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Sheet is not publicly accessible. Please make sure the sheet is shared with "Anyone with the link can view" permission.')
        }
        throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`)
      }
      
      const csvText = await response.text()
      
      if (!csvText || csvText.trim() === '') {
        throw new Error('No data found in the sheet. Please make sure the sheet has content.')
      }
      
      // Parse CSV data
      const lines = csvText.split('\n').filter(line => line.trim() !== '')
      
      if (lines.length === 0) {
        throw new Error('No data rows found in the sheet.')
      }
      
      // Simple CSV parsing
      const parseCSVLine = (line) => {
        const result = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }
      
      const headers = parseCSVLine(lines[0])
      const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line)
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || ''
          return obj
        }, {})
      }).filter(row => Object.values(row).some(value => value !== ''))

      // Transform to spreadsheet format (properly structured for your app)
      // Create a 2D array that matches the expected format
      const maxRows = Math.max(rows.length, 100) // Ensure we have enough rows
      const maxCols = Math.max(headers.length, 10) // Ensure we have enough columns
      
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
      // First, add the header row (row 0)
      headers.forEach((header, colIndex) => {
        if (spreadsheetData[0] && spreadsheetData[0][colIndex]) {
          spreadsheetData[0][colIndex] = {
            value: header,
            displayValue: header,
            computedValue: header,
            isNumber: false,
            cellType: 'text'
          }
        }
      })
      
      // Then add the data rows (starting from row 1)
      rows.forEach((row, rowIndex) => {
        headers.forEach((header, colIndex) => {
          const cellValue = row[header] || ''
          
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
          
          // Use rowIndex + 1 because we're starting from the second row (index 1)
          if (spreadsheetData[rowIndex + 1] && spreadsheetData[rowIndex + 1][colIndex]) {
            spreadsheetData[rowIndex + 1][colIndex] = {
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
      setIsDataChanging(true)

      setLastSync(new Date())
      setError(null)
      setLastDataHash(currentDataHash)
      
      console.log('🔄 Google Sheets sync successful:', {
        headers,
        rowCount: rows.length,
        dataPreview: spreadsheetData.slice(0, 3),
        totalCells: spreadsheetData.length * headers.length,
        sampleCell: spreadsheetData[0]?.[0],
        sampleData: rows.slice(0, 2),
        firstRowData: spreadsheetData[0],
        cellC1: spreadsheetData[0]?.[2], // Column C (index 2)
        cellC4: spreadsheetData[3]?.[2], // Row 4, Column C
        rawCSVPreview: lines.slice(0, 3), // Show raw CSV data
        currencyCells: spreadsheetData.flat().filter(cell => cell.isCurrency),
        formulaCells: spreadsheetData.flat().filter(cell => cell.isFormula)
      })
      
      if (onSheetDataUpdate) {
        onSheetDataUpdate(spreadsheetData, headers)
        console.log('✅ Spreadsheet data updated in app')
      }
      
      // Save to database
      try {
        setSyncStatus('saving')
        await saveToDatabase(spreadsheetData, headers)
        console.log('✅ Data saved to database')
        setSyncStatus('saved')
        
        // Clear the status after a short delay
        setTimeout(() => {
          setSyncStatus(null)
          setIsDataChanging(false)
        }, 2000)
      } catch (dbError) {
        console.error('❌ Failed to save to database:', dbError)
        setSyncStatus(null)
        setIsDataChanging(false)
        // Don't throw - we still want the app to update
      }
      
    } catch (err) {
      console.error('Error fetching sheet data:', err)
      setError(`Failed to sync with Google Sheets: ${err.message}`)
      setSyncStatus(null)
      setIsDataChanging(false)
    }
  }, [config.sheetId, config.isConfigured, onSheetDataUpdate])

  // Save data to database
  const saveToDatabase = useCallback(async (spreadsheetData, headers) => {
    try {
      console.log('💾 Saving Google Sheets data to database...')
      
      // Use the current spreadsheet ID from the parent component
      const spreadsheetId = currentSpreadsheetId || 'google-sheets-sync'
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
              is_number: cell.isNumber || false,
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

  // Auto-sync effect (always enabled when configured)
  React.useEffect(() => {
    if (!config.isConfigured) return

    // Initial sync
    fetchSheetData()
    
    // Set up periodic sync (every 10 seconds for real-time feel)
    const interval = setInterval(() => {
      fetchSheetData()
    }, 10000) // Every 10 seconds

    setSyncInterval(interval)

    return () => {
      clearInterval(interval)
      setSyncInterval(null)
    }
  }, [config.isConfigured, fetchSheetData])

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
                <p className="text-red-600">❌ Invalid URL format. Make sure it contains "/spreadsheets/d/"</p>
              )}
            </div>
          </div>
          
          <div className="text-xs text-gray-500 bg-green-50 p-2 rounded">
            <strong>Auto-Sync Enabled:</strong> Changes in Google Sheets will automatically sync to your app and database every 10 seconds.
          </div>
          
          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
            <strong>Note:</strong> CSV export may not preserve currency formatting or formulas. For full formatting support, consider using the Google Sheets API.
          </div>
          
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            <strong>⚠️ Warning:</strong> Google Sheets sync will replace ALL existing data in your spreadsheet. Make sure to backup important data before connecting.
          </div>
          
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
              onClick={() => {
                const sheetId = extractSheetId(config.sheetUrl)
                if (sheetId) {
                  // Test the connection
                  const testUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`
                  window.open(testUrl, '_blank')
                }
              }}
              className="px-4 py-2 bg-green-100 text-green-600 rounded-md text-sm hover:bg-green-200 flex-1"
            >
              Test Link
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
              <p className="text-xs text-gray-500">Embed live Google Sheets in your app</p>
            </div>
          </div>
          <button
            onClick={() => setIsConfiguring(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
          >
            Configure
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <ExternalLink className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">Google Sheets</h3>
            <p className="text-xs text-gray-500">
              {syncStatus === 'syncing' && 'Synchronizing...'}
              {syncStatus === 'saving' && 'Saving...'}
              {syncStatus === 'saved' && 'Saved'}
              {!syncStatus && lastSync && 'Auto-sync active'}
              {!syncStatus && !lastSync && 'Google Sheets view'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsConfiguring(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="text-xs text-red-600">
            <div className="font-medium">Connection Error:</div>
            <div className="mt-1">{error}</div>
            <div className="mt-2 text-xs text-red-500">
              • Make sure the sheet is shared with "Anyone with the link can view"<br/>
              • Check that the sheet has data in it
            </div>
          </div>
        </div>
      )}
      
      
      
      {/* Google Sheets Embed */}
      {config.isConfigured && config.sheetId && !error && (
        <div className="relative">
          <iframe
            src={`https://docs.google.com/spreadsheets/d/${config.sheetId}/edit?usp=sharing&rm=minimal&widget=true&headers=false&embedded=true`}
            width="100%"
            height="600"
            frameBorder="0"
            className="w-full"
            title="Google Sheets Embed"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => {
              console.log('Google Sheets iframe loaded')
            }}
            onError={() => {
              console.error('Google Sheets iframe failed to load')
              setError('Failed to load Google Sheets. Please check the URL and permissions.')
            }}
          />
        </div>
      )}
      
      {/* Status Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        {error && (
          <span className="text-red-600">Connection failed - check settings</span>
        )}
        {!config.isConfigured && (
          <span>Configure Google Sheets to get started</span>
        )}
        {config.isConfigured && !error && (
          <span>
            {lastSync ? `Last sync: ${lastSync.toLocaleTimeString()}` : 'Starting sync...'} 
            {syncStatus && ` - ${syncStatus}`}
            {!syncStatus && lastSync && ' - Auto-sync active'}
          </span>
        )}
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
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
}

export default GoogleSheetsEmbed
