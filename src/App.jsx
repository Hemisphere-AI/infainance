import React, { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Upload, FileSpreadsheet, Download, Plus, Minus, Calendar, ArrowLeft, Calculator, Network } from 'lucide-react'
import * as XLSX from 'xlsx'
import ReactSpreadsheet from './UniverSpreadsheet'
import ChatInterface from './components/ChatInterface'
import { LLMService } from './services/llmService'
import { DependencyAnalyzer } from './services/indexService'

// Helper function to parse node keys (from indexService.js)
function parseKey(k) {
  const idx = k.indexOf("!");
  return { sheet: k.slice(0, idx), addr: k.slice(idx + 1) };
}

// Helper function to check if user is a test user
function isTestUser(user) {
  if (!user || !user.email) return false;
  const demoUser = import.meta.env.VITE_DEMO_USER;
  return demoUser && user.email === demoUser;
}
import { AuthProvider } from './contexts/AuthContext.jsx'
import { useAuth } from './hooks/useAuth'
import LoginPage from './components/LoginPage'
import LandingPage from './components/LandingPage'
import TermsOfService from './components/TermsOfService'
import PrivacyPolicy from './components/PrivacyPolicy'
import UserProfile from './components/UserProfile'

function MainApp() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route 
          path="/app" 
          element={user ? <ExcelApp /> : <Navigate to="/login" replace />} 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

function ExcelApp() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [excelData, setExcelData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const [spreadsheetData, setSpreadsheetData] = useState([])
  const [formulaDisplayMode, setFormulaDisplayMode] = useState(0) // 0: normal, 1: highlight formulas, 2: show all formulas
  const [selectedCells, setSelectedCells] = useState([]) // Array of selected cell coordinates
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [decimalButtonClicked, setDecimalButtonClicked] = useState(false)
  const [averageDecimals, setAverageDecimals] = useState(0)
  const [dependencyFrames, setDependencyFrames] = useState(null)
  const toolCallHandlerRef = useRef(null)
  const llmServiceRef = useRef(null)
  const addBotMessageRef = useRef(null)
  
  // Handle tool call registration from ChatInterface
  const handleToolCallRegistration = useCallback((handler) => {
    toolCallHandlerRef.current = handler;
  }, [])

  // Handle bot message registration from ChatInterface
  const handleBotMessageRegistration = useCallback((handler) => {
    addBotMessageRef.current = handler;
  }, [])

  const handleFile = useCallback((file) => {
    setError('')
    
    if (!file) return
    
    // Check if file is Excel format
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please upload a valid Excel file (.xlsx, .xls, or .csv)')
      return
    }

    setFileName(file.name)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellStyles: true,  // Enable cell styles
          cellNF: true,     // Enable number formats
          cellHTML: false   // Disable HTML conversion
        })
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Convert to JSON format with better error handling and formatting extraction
        let jsonData
        let formattedData
        let cellFormats = {} // Store formatting information
        
        try {
          // Try different approaches to get formatted data
          
          // Approach 1: Raw data
          jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: true
          })
          
          // Approach 2: Try to get formatted data
          formattedData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: false
          })
          
          // Debug: Log the worksheet object to see what's available
          
          
          // Extract formatting information from each cell
          if (worksheet['!ref']) {
            const range = XLSX.utils.decode_range(worksheet['!ref'])
            
            for (let row = range.s.r; row <= range.e.r; row++) {
              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
                const cell = worksheet[cellAddress]
                
                if (cell) {
                  
                  // Store formatting information with enhanced detection
                  const formatInfo = {
                    numberFormat: cell.z || null, // Number format string (e.g., "mm/dd/yyyy", "$#,##0.00")
                    cellType: cell.t || null,    // Cell type (n=number, s=string, b=boolean, d=date, e=error)
                    isFormula: !!cell.f,         // Whether cell contains a formula
                    formula: cell.f || null,     // The actual formula
                    style: cell.s || null,       // Cell style information
                    rawValue: cell.v || null,    // Raw cell value
                    displayValue: cell.w || null, // Display value
                    // Enhanced formatting detection
                    isDate: false,               // Will be set based on format analysis
                    isCurrency: false,           // Will be set based on format analysis
                    isPercentage: false,         // Will be set based on format analysis
                    decimalPlaces: null,         // Will be extracted from format
                    currencySymbol: null         // Will be extracted from format
                  }
                  
                  // Check if cell value contains currency symbols and treat as currency
                  if (cell.v && typeof cell.v === 'string') {
                    if (cell.v.includes('€')) {
                      formatInfo.isCurrency = true
                      formatInfo.currencySymbol = '€'
                    } else if (cell.v.includes('$')) {
                      formatInfo.isCurrency = true
                      formatInfo.currencySymbol = '$'
                    } else if (cell.v.includes('£')) {
                      formatInfo.isCurrency = true
                      formatInfo.currencySymbol = '£'
                    }
                  }
                  
                  // ALSO check the raw cell value for currency symbols (for formula results)
                  // BUT NOT for formula cells - they should use numberFormat instead
                  if (cell && typeof cell === 'string' && !cell.f) {
                    if (cell.includes('€')) {
                      formatInfo.isCurrency = true
                      formatInfo.currencySymbol = '€'
                    } else if (cell.includes('$')) {
                      formatInfo.isCurrency = true
                      formatInfo.currencySymbol = '$'
                    } else if (cell.includes('£')) {
                      formatInfo.isCurrency = true
                      formatInfo.currencySymbol = '£'
                    }
                  }
                  
                  // Enhanced format analysis
                  if (formatInfo.numberFormat) {
                    const format = formatInfo.numberFormat.toLowerCase()
                    
                    // Detect date formats
                    if (format.includes('mm') && format.includes('dd') && format.includes('yyyy')) {
                      formatInfo.isDate = true
                    } else if (format.includes('h') && format.includes('mm')) {
                      formatInfo.isDate = true
                    }
                    
                    // Detect currency formats - improved detection with Euro priority
                    if (format.includes('$') || format.includes('€') || format.includes('£') || 
                        format.includes('currency') || format.includes('eur') || format.includes('usd') ||
                        format.includes('gbp') || format.includes('euro') || format.includes('dollar') ||
                        format.includes('accounting') || format.includes('money')) {
                      formatInfo.isCurrency = true
                      
                      // PRIORITY: Check for Euro first (to handle [$€] format correctly)
                      if (format.includes('€') || format.includes('eur') || format.includes('euro')) {
                        formatInfo.currencySymbol = '€'
                      } else if (format.includes('£') || format.includes('gbp')) {
                        formatInfo.currencySymbol = '£'
                      } else if (format.includes('$') || format.includes('usd') || format.includes('dollar')) {
                        formatInfo.currencySymbol = '$'
                      } else {
                        formatInfo.currencySymbol = '€' // default to euro instead of dollar
                      }
                      
                    }
                    
                    // Detect percentage formats
                    if (format.includes('%')) {
                      formatInfo.isPercentage = true
                    }
                    
                    // Extract decimal places from format
                    const decimalMatch = format.match(/\.(0+)/)
                    if (decimalMatch) {
                      formatInfo.decimalPlaces = decimalMatch[1].length
                    }
                  }
                  
                  // Store format info by row/col for easy lookup
                  if (!cellFormats[row]) cellFormats[row] = {}
                  cellFormats[row][col] = formatInfo
                  
                  // Replace the value with the formula if it exists
                  if (cell.f && jsonData[row] && jsonData[row][col] !== undefined) {
                    jsonData[row][col] = '=' + cell.f
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('Error processing formulas, falling back to basic conversion:', error)
          // Fallback to basic conversion - but still try to preserve formulas
          jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: true // Keep raw: true to preserve formulas
          })
          formattedData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: false
          })
          
          // Try to extract formulas in fallback mode
          if (worksheet['!ref']) {
            const range = XLSX.utils.decode_range(worksheet['!ref'])
            for (let row = range.s.r; row <= range.e.r; row++) {
              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
                const cell = worksheet[cellAddress]
                if (cell && cell.f && jsonData[row] && jsonData[row][col] !== undefined) {
                  jsonData[row][col] = '=' + cell.f
                }
              }
            }
          }
        }
        
        // First pass: detect currency columns by looking for currency symbols in column values
        const currencyColumns = new Set()
        const currencySymbols = new Map() // Track which symbol is used in each column
        
        jsonData.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            if (cell && typeof cell === 'string') {
              if (cell.includes('€')) {
                currencyColumns.add(colIndex)
                currencySymbols.set(colIndex, '€')
              } else if (cell.includes('$')) {
                currencyColumns.add(colIndex)
                currencySymbols.set(colIndex, '$')
              } else if (cell.includes('£')) {
                currencyColumns.add(colIndex)
                currencySymbols.set(colIndex, '£')
              }
            }
            // Also check numberFormat for currency patterns
            const fmt = cellFormats[rowIndex]?.[colIndex]?.numberFormat || ''
            if (/[€$£]|(eur|usd|gbp|currency|accounting)/i.test(fmt)) {
              currencyColumns.add(colIndex)
              // Extract currency symbol from format - PRIORITY: Euro first
              if (fmt.includes('€') || fmt.includes('eur')) {
                currencySymbols.set(colIndex, '€')
              } else if (fmt.includes('£') || fmt.includes('gbp')) {
                currencySymbols.set(colIndex, '£')
              } else if (fmt.includes('$') || fmt.includes('usd')) {
                currencySymbols.set(colIndex, '$')
              } else {
                currencySymbols.set(colIndex, '€') // default to euro
              }
            }
          })
        })
        
        if (currencyColumns.size > 0) {
          // Currency columns detected and processed
        }
        
        // Convert to react-spreadsheet format with formatting information
        const spreadsheetFormat = jsonData.map((row, rowIndex) => 
          row.map((cell, colIndex) => {
            const formatInfo = cellFormats[rowIndex]?.[colIndex] || {}
            
            // Determine cell type and formatting using enhanced detection
            let cellType = 'text'
            let isDate = formatInfo.isDate || false
            let numberFormat = formatInfo.numberFormat
            let decimalPlaces = formatInfo.decimalPlaces
            let isCurrency = formatInfo.isCurrency || false
            let isPercentage = formatInfo.isPercentage || false
            let currencySymbol = formatInfo.currencySymbol
            
            // CRITICAL FIX: For formula cells, check the original cell's numberFormat first
            if (formatInfo.isFormula) {
              
              // Use the formatting information from the original cell
              if (formatInfo.isCurrency) {
                isCurrency = formatInfo.isCurrency
                currencySymbol = formatInfo.currencySymbol
                cellType = 'number'
              }
              
              // If not already detected as currency, check numberFormat
              if (!isCurrency && formatInfo.numberFormat) {
                const nf = formatInfo.numberFormat.toLowerCase()
                if (nf.includes('€') || nf.includes('eur') || nf.includes('euro')) {
                  isCurrency = true
                  currencySymbol = '€'
                  cellType = 'number'
                } else if (nf.includes('$') || nf.includes('usd') || nf.includes('dollar')) {
                  isCurrency = true
                  currencySymbol = '$'
                  cellType = 'number'
                } else if (nf.includes('£') || nf.includes('gbp')) {
                  isCurrency = true
                  currencySymbol = '£'
                  cellType = 'number'
                }
              }
            }
            
            // PRIORITY: Check if the actual cell value contains currency symbols FIRST
            // BUT NOT for formula cells - they should use numberFormat instead
            if (cell && typeof cell === 'string' && !formatInfo.isFormula) {
              if (cell.includes('€')) {
                isCurrency = true
                currencySymbol = '€'
                cellType = 'number'
              } else if (cell.includes('$')) {
                isCurrency = true
                currencySymbol = '$'
                cellType = 'number'
              } else if (cell.includes('£')) {
                isCurrency = true
                currencySymbol = '£'
                cellType = 'number'
              }
            }
            
            // FALLBACK: If this column contains currency values, treat formula cells as currency too
            if (currencyColumns.has(colIndex) && formatInfo.isFormula && !isCurrency) {
              isCurrency = true
              currencySymbol = currencySymbols.get(colIndex) || '€' // Use the detected symbol for this column
              cellType = 'number'
            }
            
            // CRITICAL: Ensure currency symbols are preserved and not overridden
            if (isCurrency && !currencySymbol) {
              // If we detected currency but no symbol, try to get it from the cell value
              if (cell && typeof cell === 'string') {
                if (cell.includes('€')) {
                  currencySymbol = '€'
                } else if (cell.includes('$')) {
                  currencySymbol = '$'
                } else if (cell.includes('£')) {
                  currencySymbol = '£'
                } else {
                  currencySymbol = '€' // Default to euro
                }
              } else {
                currencySymbol = '€' // Default to euro
              }
            }
            
            // Use enhanced format analysis results
            if (formatInfo.isDate) {
              cellType = 'date'
            } else if (formatInfo.isCurrency || formatInfo.isPercentage || 
                      (formatInfo.numberFormat && (formatInfo.numberFormat.includes('#') || formatInfo.numberFormat.includes('0')))) {
              cellType = 'number'
            }
            
            // Override with cell type if available
            if (formatInfo.cellType) {
              switch (formatInfo.cellType) {
                case 'd': cellType = 'date'; isDate = true; break
                case 'n': 
                  cellType = 'number'; 
                  // If it's a number and looks like a date (Excel serial date), mark as date
                  // BUT NOT if it's already detected as currency
                  if (typeof cell === 'number' && cell > 25569 && cell < 2958465 && !isCurrency) {
                    isDate = true
                    cellType = 'date'
                  }
                  break
                case 's': cellType = 'text'; break
                case 'b': cellType = 'boolean'; break
              }
            }
            
            // Additional date detection for Excel serial dates
            // BUT NOT if it's already detected as currency
            if (typeof cell === 'number' && cell > 25569 && cell < 2958465 && !isDate && !isCurrency) {
              // This looks like an Excel serial date
              isDate = true
              cellType = 'date'
              if (!numberFormat) {
                numberFormat = 'mm/dd/yyyy' // Default date format
              }
            }
            
            const cellInfo = {
              numberFormat: numberFormat,
              cellType: cellType,
              isDate: isDate,
              decimalPlaces: decimalPlaces,
              isCurrency: isCurrency,
              isPercentage: isPercentage,
              currencySymbol: currencySymbol,
              isFormula: formatInfo.isFormula || false,
              formula: formatInfo.formula || null,
              originalFormat: formatInfo
            }
            
            
            // Use formatted data if available, otherwise use raw
            const formattedValue = formattedData && formattedData[rowIndex] ? formattedData[rowIndex][colIndex] : cell || ''
            const rawValue = cell || ''
            
            // For formulas, we need to store the formula string but also preserve the calculated result
            let cellValue
            if (formatInfo.isFormula) {
              // Store the formula string (with = prefix)
              cellValue = cell
              // For formula cells, we need to ensure they get the proper cellType for formatting
              // If the original cell had a numeric type, preserve it for formula formatting
              if (formatInfo.cellType === 'n' || formatInfo.cellType === 'number') {
                cellType = 'number'
              }
              
              // CRITICAL: For formula cells, preserve ALL formatting properties from the original cell
              // This ensures currency formatting is maintained for formula cells
              if (formatInfo.isCurrency) {
                isCurrency = formatInfo.isCurrency
                currencySymbol = formatInfo.currencySymbol
              }
              if (formatInfo.isPercentage) {
                isPercentage = formatInfo.isPercentage
              }
              if (formatInfo.decimalPlaces !== null) {
                decimalPlaces = formatInfo.decimalPlaces
              }
              if (formatInfo.numberFormat) {
                numberFormat = formatInfo.numberFormat
              }
              
              // Debug: Log formula cell formatting properties
              if (rowIndex < 3 && colIndex < 3) {
                // Debug logging for first few cells
              }
            } else {
              // Use formatted value for non-formulas
              cellValue = formattedValue
            }
            
            const finalCell = {
              value: cellValue, // Formula string for formulas, formatted value for others
              rawValue: rawValue, // Keep raw value for reference
              className: '',
              // Enhanced formatting properties
              ...cellInfo
            }
            
            // Debug: Log final cell properties for currency cells
            if (finalCell.isCurrency && rowIndex < 3 && colIndex < 3) {
              // Debug logging for currency cells
            }
            
            return finalCell
          })
        )
        
        
        // Log some formatting examples (reduced logging)
        const formatExamples = []
        for (let row = 0; row < Math.min(2, Object.keys(cellFormats).length); row++) {
          if (cellFormats[row]) {
            for (let col = 0; col < Math.min(2, Object.keys(cellFormats[row]).length); col++) {
              if (cellFormats[row][col]?.numberFormat) {
                formatExamples.push({
                  position: `R${row + 1}C${col + 1}`,
                  format: cellFormats[row][col].numberFormat,
                  type: cellFormats[row][col].cellType,
                  value: jsonData[row]?.[col]
                })
              }
            }
          }
        }
        // Format examples processed
        
        setExcelData({
          sheetName: firstSheetName,
          data: jsonData,
          allSheets: workbook.SheetNames,
          worksheet: worksheet,
          cellFormats: cellFormats // Include formatting information
        })
        
        
        setSpreadsheetData(spreadsheetFormat)
      } catch (err) {
        setError('Error reading Excel file. Please make sure the file is not corrupted.')
        console.error('Error reading Excel:', err)
      }
    }
    
    reader.readAsArrayBuffer(file)
  }, [])

  // Auto-upload Map2.xlsx for test users
  useEffect(() => {
    const autoUploadForTestUser = async () => {
      if (isTestUser(user) && !excelData) {
        try {
          // Fetch the Map2.xlsx file from assets
          const response = await fetch('/Map2.xlsx');
          if (response.ok) {
            const blob = await response.blob();
            const file = new File([blob], 'Map2.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // Process the file using the existing handleFile function
            await handleFile(file);
            
            console.log('Auto-uploaded Map2.xlsx for test user');
          } else {
            console.warn('Could not fetch Map2.xlsx for auto-upload');
          }
        } catch (error) {
          console.error('Error auto-uploading Map2.xlsx:', error);
        }
      }
    };

    autoUploadForTestUser();
  }, [user, excelData, handleFile])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0]
    handleFile(file)
  }, [handleFile])

  const clearData = useCallback(() => {
    setExcelData(null)
    setFileName('')
    setError('')
    setSpreadsheetData([])
  }, [])





  const downloadAsExcel = useCallback(() => {
    if (!spreadsheetData.length) return
    
    // Convert spreadsheet data back to array format
    const dataArray = spreadsheetData.map(row => 
      row.map(cell => cell.value)
    )
    
    const worksheet = XLSX.utils.aoa_to_sheet(dataArray)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, excelData?.sheetName || 'Sheet1')
    
    XLSX.writeFile(workbook, `${fileName.replace(/\.[^/.]+$/, '')}_edited.xlsx`)
  }, [spreadsheetData, fileName, excelData])

  const handleSpreadsheetChange = useCallback((data) => {
    setSpreadsheetData(data)
    
    // Update LLM service with new data
    if (llmServiceRef.current) {
      llmServiceRef.current.updateSpreadsheetData(data)
    }
  }, [])

  // Initialize LLM service when spreadsheet data is available
  const hasSpreadsheetData = spreadsheetData.length > 0;
  
  // Create LLM service immediately when we have data
  if (hasSpreadsheetData && !llmServiceRef.current) {
    llmServiceRef.current = new LLMService(spreadsheetData, setSpreadsheetData, toolCallHandlerRef.current, user)
  }
  
  // Update LLM service when tool call handler changes
  useEffect(() => {
    if (hasSpreadsheetData && llmServiceRef.current) {
      llmServiceRef.current = new LLMService(spreadsheetData, setSpreadsheetData, toolCallHandlerRef.current, user)
    }
  }, [hasSpreadsheetData, spreadsheetData, user])

  // Handle chat messages
  const handleChatMessage = useCallback(async (message) => {
    if (!llmServiceRef.current) {
      return "Please upload a spreadsheet first to start chatting with the AI assistant."
    }

    setIsChatLoading(true)
    try {
      const response = await llmServiceRef.current.chat(message)
      return response
    } catch (error) {
      console.error('Chat error:', error)
      return `Error: ${error.message}. Please check your OpenAI API key in the .env file.`
    } finally {
      setIsChatLoading(false)
    }
  }, [])

  // Handle cancellation
  const handleCancel = useCallback(() => {
    if (llmServiceRef.current) {
      llmServiceRef.current.cancel()
    }
    // Reset loading state immediately
    setIsChatLoading(false)
  }, [])

  // Handle clearing conversation history
  const handleClearHistory = useCallback(() => {
    if (llmServiceRef.current) {
      llmServiceRef.current.clearHistory()
    }
  }, [])



  // Reset decimal button state when selection changes
  useEffect(() => {
    setDecimalButtonClicked(false)
    setAverageDecimals(0)
  }, [selectedCells])


  // Increase decimal places for selected cells
  const increaseDecimals = useCallback(() => {
    if (selectedCells.length === 0) return
    
    setSpreadsheetData(prevData => {
      const newData = [...prevData]
      
      if (!decimalButtonClicked) {
        // First click: Calculate average decimal places and set all cells to that average
        let totalDecimals = 0
        let cellCount = 0
        selectedCells.forEach(({ row, col }) => {
          if (newData[row] && newData[row][col]) {
            const cell = newData[row][col]
            const currentDecimals = cell.decimalPlaces || 0
            totalDecimals += currentDecimals
            cellCount++
          }
        })
        
        const calculatedAverage = cellCount > 0 ? Math.round(totalDecimals / cellCount) : 0
        setAverageDecimals(calculatedAverage)
        
        selectedCells.forEach(({ row, col }) => {
          if (newData[row] && newData[row][col]) {
            const cell = newData[row][col]
            newData[row][col] = {
              ...cell,
              decimalPlaces: calculatedAverage
            }
          }
        })
        
        setDecimalButtonClicked(true)
      } else {
        // Subsequent clicks: Add 1 decimal place to the stored average
        const targetDecimals = Math.min(averageDecimals + 1, 10)
        
        selectedCells.forEach(({ row, col }) => {
          if (newData[row] && newData[row][col]) {
            const cell = newData[row][col]
            newData[row][col] = {
              ...cell,
              decimalPlaces: targetDecimals
            }
          }
        })
        
        setAverageDecimals(targetDecimals)
      }
      
      return newData
    })
  }, [selectedCells, decimalButtonClicked, averageDecimals])

  // Decrease decimal places for selected cells
  const decreaseDecimals = useCallback(() => {
    if (selectedCells.length === 0) return
    
    setSpreadsheetData(prevData => {
      const newData = [...prevData]
      
      if (!decimalButtonClicked) {
        // First click: Calculate average decimal places and set all cells to that average
        let totalDecimals = 0
        let cellCount = 0
        selectedCells.forEach(({ row, col }) => {
          if (newData[row] && newData[row][col]) {
            const cell = newData[row][col]
            const currentDecimals = cell.decimalPlaces || 0
            totalDecimals += currentDecimals
            cellCount++
          }
        })
        
        const calculatedAverage = cellCount > 0 ? Math.round(totalDecimals / cellCount) : 0
        setAverageDecimals(calculatedAverage)
        
        selectedCells.forEach(({ row, col }) => {
          if (newData[row] && newData[row][col]) {
            const cell = newData[row][col]
            newData[row][col] = {
              ...cell,
              decimalPlaces: calculatedAverage
            }
          }
        })
        
        setDecimalButtonClicked(true)
      } else {
        // Subsequent clicks: Remove 1 decimal place from the stored average
        const targetDecimals = Math.max(averageDecimals - 1, 0)
        
        selectedCells.forEach(({ row, col }) => {
          if (newData[row] && newData[row][col]) {
            const cell = newData[row][col]
            newData[row][col] = {
              ...cell,
              decimalPlaces: targetDecimals
            }
          }
        })
        
        setAverageDecimals(targetDecimals)
      }
      
      return newData
    })
  }, [selectedCells, decimalButtonClicked, averageDecimals])

  // Generate Green-to-Red colors in order (30 colors)
  const generateGreenToRedColors = useCallback(() => {
    const colors = []
    
    for (let i = 0; i < 30; i++) {
      // Green (120°) to Red (0°) progression
      const hue = 120 - (i / 29) * 120 // 120° (green) to 0° (red)
      const saturation = 70 + (i % 3) * 10 // Vary saturation slightly
      const lightness = 50 + (i % 2) * 5   // Vary lightness slightly
      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`)
    }
    
    return colors
  }, [])

  // Generate AI bot message with indexing results
  const generateIndexingResultsMessage = useCallback((result) => {
    const totalLayers = result.layers.length
    const totalCells = result.layers.reduce((sum, layer) => sum + layer.length, 0)
    const formulaCells = result.layers.flat().filter(nodeKey => {
      const meta = result.graph.nodeMeta?.get(nodeKey)
      return meta && meta.formula
    }).length
    
    let message = `**Analysis Summary:**\n`
    message += `• **${totalLayers}** dependency layers identified\n`
    message += `• **${totalCells}** total cells analyzed\n`
    message += `• **${formulaCells}** formula cells found\n\n`
    


    // Extract formula information and dependencies
    const getFormulaDescription = (formula) => {
      if (!formula || !formula.startsWith('=')) return 'Data';
      
      const cleanFormula = formula.replace(/[=]/g, '').toUpperCase();
      
      if (cleanFormula.includes('SUM(')) return 'Sum calculation';
      if (cleanFormula.includes('AVERAGE(')) return 'Average calculation';
      if (cleanFormula.includes('COUNT(')) return 'Count calculation';
      if (cleanFormula.includes('MAX(')) return 'Maximum calculation';
      if (cleanFormula.includes('MIN(')) return 'Minimum calculation';
      if (cleanFormula.includes('+')) return 'Addition';
      if (cleanFormula.includes('-')) return 'Subtraction';
      if (cleanFormula.includes('*')) return 'Multiplication';
      if (cleanFormula.includes('/')) return 'Division';
      
      return 'Formula calculation';
    };

    // Build dependency relationships
    message += `**Dependency Relationships:**\n`
    
    // Collect all dependency relationships
    const allRelationships = [];
    const processedPairs = new Set();
    
    // Go through all layers to find relationships
    result.layers.forEach((layer, layerIndex) => {
      layer.forEach(nodeKey => {
        const { addr } = parseKey(nodeKey);
        const meta = result.graph.nodeMeta?.get(nodeKey);
        
        if (meta && meta.formula) {
          // Find what this cell depends on
          const precedents = result.graph.precedents.get(nodeKey);
          if (precedents) {
            precedents.forEach(precNodeKey => {
              const { addr: precAddr } = parseKey(precNodeKey);
              const relationshipKey = `${precAddr} → ${addr}`;
              
              if (!processedPairs.has(relationshipKey)) {
                processedPairs.add(relationshipKey);
                
                // Get the exact formula
                const formula = meta.formula;
                const formulaDesc = getFormulaDescription(formula);
                
                allRelationships.push({
                  from: precAddr,
                  to: addr,
                  formula: formula,
                  description: formulaDesc,
                  layer: layerIndex
                });
              }
            });
          }
        }
      });
    });
    
    // Group relationships by target cell (what they feed into)
    const relationshipsByTarget = {};
    allRelationships.forEach(rel => {
      if (!relationshipsByTarget[rel.to]) {
        relationshipsByTarget[rel.to] = [];
      }
      relationshipsByTarget[rel.to].push(rel);
    });
    
    // Display all relationships
    Object.keys(relationshipsByTarget).forEach(targetCell => {
      const relationships = relationshipsByTarget[targetCell];
      const targetMeta = result.graph.nodeMeta?.get(
        Array.from(result.graph.allNodes).find(nodeKey => {
          const { addr } = parseKey(nodeKey);
          return addr === targetCell;
        })
      );
      
      const targetFormula = targetMeta ? targetMeta.formula : 'Data';
      const targetDesc = getFormulaDescription(targetFormula);
      
      message += `\n**${targetCell}** (${targetDesc}):\n`;
      message += `  Formula: ${targetFormula}\n`;
      message += `  Depends on:\n`;
      
      relationships.forEach(rel => {
        const sourceMeta = result.graph.nodeMeta?.get(
          Array.from(result.graph.allNodes).find(nodeKey => {
            const { addr } = parseKey(nodeKey);
            return addr === rel.from;
          })
        );
        const sourceFormula = sourceMeta ? sourceMeta.formula : 'Data';
        const sourceDesc = getFormulaDescription(sourceFormula);
        
        message += `    • ${rel.from} (${sourceDesc}) → ${rel.to}\n`;
        if (sourceFormula !== 'Data') {
          message += `      Source formula: ${sourceFormula}\n`;
        }
      });
    });

    // Add date patterns information
    if (result.dateFrames && result.dateFrames.length > 0) {
      message += `\n**📅 Date Patterns Detected:**\n`;
      
      const datePatternsByType = {};
      result.dateFrames.forEach(frame => {
        if (!datePatternsByType[frame.type]) {
          datePatternsByType[frame.type] = [];
        }
        datePatternsByType[frame.type].push(frame.range);
      });
      
      Object.keys(datePatternsByType).forEach(type => {
        const ranges = datePatternsByType[type];
        message += `  • ${type.charAt(0).toUpperCase() + type.slice(1)} date ranges: ${ranges.join(', ')}\n`;
      });
      
      message += `  • Date patterns are highlighted in green on the spreadsheet\n`;
    }
    
    return message
  }, [])

  // Handle dependency analysis with visual highlighting (toggle functionality)
  const handleDependencyAnalysis = useCallback(() => {
    // If already showing dependency frames, clear them
    if (dependencyFrames) {
      setDependencyFrames(null)
      return
    }

    if (!spreadsheetData || spreadsheetData.length === 0) {
      alert('No spreadsheet data available for analysis. Please upload a spreadsheet first.')
      return
    }

    try {
      // Use the proper DependencyAnalyzer from indexService
      const analyzer = new DependencyAnalyzer()
      const result = analyzer.analyzeSpreadsheetData(spreadsheetData)
      
      // Calculate max depth from outputs to inputs (output-centric layering)
      const maxDepth = Math.max(0, result.layers.length - 1)
      
      // Create frame highlighting data using green-to-red colors
      const greenToRedColors = generateGreenToRedColors()
      
      const frames = []
      result.frames.forEach((frame) => {
        // Output-based layer indexing: outputs (layer 0) should be red, inputs green
        const depthFromOutput = frame.layer
        let colorIndex = greenToRedColors.length - 1
        if (maxDepth > 0) {
          colorIndex = Math.floor(((maxDepth - depthFromOutput) / maxDepth) * (greenToRedColors.length - 1))
        }
        const color = greenToRedColors[colorIndex]
        
        // Process horizontal frames
        frame.horizontal.forEach(span => {
          frames.push({
            range: span,
            color: color,
            type: 'horizontal',
            layer: frame.layer,
            depthFromInput: depthFromOutput
          })
        })
        
        // Process vertical frames  
        frame.vertical.forEach(span => {
          frames.push({
            range: span,
            color: color,
            type: 'vertical', 
            layer: frame.layer,
            depthFromInput: depthFromOutput
          })
        })
      })
      
      // Combine regular frames with date frames
      const allFrames = [...frames, ...(result.dateFrames || [])];
      setDependencyFrames(allFrames)
      
      // Generate and send AI bot message with indexing results
      const indexingMessage = generateIndexingResultsMessage(result)
      
      // Add the message to chat interface directly
      if (addBotMessageRef.current) {
        addBotMessageRef.current(indexingMessage)
      }
      
    } catch (error) {
      console.error('Dependency analysis error:', error)
      alert(`Analysis failed: ${error.message}`)
    }
  }, [spreadsheetData, dependencyFrames, generateGreenToRedColors, generateIndexingResultsMessage])


  // Format selected cells as dates
  const formatAsDate = useCallback(() => {
    if (selectedCells.length === 0) return
    
    setSpreadsheetData(prevData => {
      const newData = [...prevData]
      selectedCells.forEach(({ row, col }) => {
        if (newData[row] && newData[row][col]) {
          const cell = newData[row][col]
          const value = cell.value
          
          // Check if the value looks like an Excel serial number
          const numValue = parseFloat(value)
          if (!isNaN(numValue) && numValue > 0) {
            // More sophisticated check for Excel serial numbers
            // Excel serial numbers typically start from 1 (Jan 1, 1900) and go up to ~2958465 (Dec 31, 9999)
            // But we need to be smarter about detection:
            // 1. Numbers that are clearly years (like 2025) should not be converted
            // 2. Numbers that are clearly small integers (like 1-100) are likely not serial numbers
            // 3. Numbers in the range 1000-10000 could be years or small serial numbers
            // 4. Numbers > 10000 are more likely to be serial numbers
            
            const isLikelyYear = numValue >= 1900 && numValue <= 2100 && numValue % 1 === 0
            const isSmallInteger = numValue >= 1 && numValue <= 100 && numValue % 1 === 0
            const isLikelyExcelSerial = numValue >= 1 && numValue <= 2958465 && !isLikelyYear && !isSmallInteger
            
            if (isLikelyExcelSerial) {
              // Use xlsx library to convert Excel serial number to date
              try {
                // Try using XLSX.SSF.format with date format
                const dateString = XLSX.SSF.format('yyyy-mm-dd', numValue)
                
                if (dateString && dateString !== 'Invalid Date' && !dateString.includes('Invalid')) {
                  const jsDate = new Date(dateString)
                  
                  // Check if the resulting date is reasonable (between 1900 and 2100)
                  if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() >= 1900 && jsDate.getFullYear() <= 2100) {
                    newData[row][col] = {
                      ...cell,
                      value: dateString, // Store as YYYY-MM-DD format
                      isDate: true
                    }
                  }
                }
              } catch (error) {
                // If xlsx conversion fails, try manual calculation
                console.warn('XLSX date conversion failed, trying manual calculation:', error)
                try {
                  // Manual Excel date conversion
                  const excelEpoch = new Date(1900, 0, 1) // January 1, 1900
                  const daysSinceEpoch = numValue - 1 // Excel serial 1 = Jan 1, 1900
                  const jsDate = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
                  
                  if (jsDate.getFullYear() >= 1900 && jsDate.getFullYear() <= 2100) {
                    newData[row][col] = {
                      ...cell,
                      value: jsDate.toISOString().split('T')[0],
                      isDate: true
                    }
                  }
                } catch (manualError) {
                  console.warn('Manual date conversion also failed:', manualError)
                }
              }
            } else {
              // Skip conversion for years, small integers, or non-serial numbers
            }
          }
        }
      })
      return newData
    })
  }, [selectedCells])

  // Debug effect to log spreadsheet data changes (reduced logging)
  useEffect(() => {
    if (spreadsheetData.length > 0) {
      // Data updated
    }
  }, [spreadsheetData])

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <svg fill="#000000" height="32px" width="32px" viewBox="0 0 470 470" xmlns="http://www.w3.org/2000/svg">
                <path d="M464.37,227.737l-137.711-35.46l55.747-94.413c1.74-2.946,1.265-6.697-1.155-9.117c-2.42-2.42-6.169-2.894-9.117-1.154
                  l-94.413,55.747L242.263,5.63C241.41,2.316,238.422,0,235,0s-6.41,2.316-7.263,5.63l-35.46,137.711L97.865,87.593
                  c-2.947-1.742-6.697-1.267-9.117,1.154c-2.419,2.42-2.895,6.171-1.155,9.117l55.747,94.413L5.63,227.737
                  C2.316,228.59,0,231.578,0,235s2.316,6.41,5.63,7.263l137.711,35.46l-55.747,94.413c-1.74,2.946-1.265,6.697,1.155,9.117
                  c1.445,1.445,3.365,2.196,5.306,2.196c1.308,0,2.625-0.342,3.811-1.042l94.413-55.747l35.46,137.71
                  c0.854,3.313,3.841,5.63,7.263,5.63s6.41-2.316,7.263-5.63l35.46-137.711l94.413,55.748c1.187,0.701,2.503,1.042,3.811,1.042
                  c1.94,0,3.86-0.751,5.306-2.196c2.419-2.42,2.895-6.171,1.155-9.117l-55.747-94.413l137.71-35.46
                  c3.314-0.853,5.63-3.841,5.63-7.263S467.684,228.59,464.37,227.737z M287.743,287.744l23.796-6.128l43.142,73.065l-73.065-43.143
                  L287.743,287.744z M313.44,265.638c-0.035,0.009-0.07,0.019-0.106,0.027l-29.473,7.59l-22.344-22.345
                  c-2.929-2.928-7.678-2.928-10.606,0c-2.929,2.93-2.929,7.678,0,10.607l22.344,22.344l-7.59,29.478
                  c-0.008,0.033-0.018,0.065-0.025,0.099L235,432.423l-30.644-119.01c-0.004-0.016-7.61-29.552-7.61-29.552l87.115-87.116
                  l29.302,7.546c0.047,0.012,119.26,30.709,119.26,30.709L313.44,265.638z M287.743,182.256l-6.127-23.795l73.065-43.143
                  l-43.142,73.064L287.743,182.256z M265.644,156.587c0.004,0.016,7.61,29.552,7.61,29.552L235,224.393l-38.254-38.254l7.59-29.478
                  c0.008-0.033,0.018-0.065,0.025-0.099L235,37.577L265.644,156.587z M182.257,182.256l-23.796,6.128l-43.142-73.065l73.065,43.143
                  L182.257,182.256z M186.139,196.745L224.393,235l-38.254,38.255L37.577,235L186.139,196.745z M182.257,287.744l6.127,23.795
                  l-73.065,43.143l43.142-73.064L182.257,287.744z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800">Zenith</h1>
          </button>
          <UserProfile />
        </div>
      </div>
      {!excelData ? (
        // Upload state - centered layout
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">

          {/* Upload Area */}
          <div className="max-w-2xl mx-auto">
            <div
              className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                isDragOver
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary-600" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Drop your Excel file here
                  </h3>
                  <p className="text-gray-500 mb-4">
                    or click to browse files
                  </p>
                  <p className="text-sm text-gray-400">
                    Supports .xlsx, .xls, and .csv files
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="max-w-2xl mx-auto mt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Spreadsheet state - full layout with chat
        <div className="flex-1 flex flex-col lg:flex-row px-4 py-4 min-h-0 max-w-full overflow-hidden layout-container">
          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 lg:mr-4 mb-4 lg:mb-0 min-w-0">

          {/* Excel Preview */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* Spreadsheet Component */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0 max-w-full">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={clearData}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Go back to upload screen"
                    >
                      <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      <h4 className="text-sm font-medium text-gray-700">
                        {fileName}
                      </h4>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    {/* Decimal formatting buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={decreaseDecimals}
                        disabled={selectedCells.length === 0}
                        className="px-1 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        title={`Decrease decimal places (${selectedCells.length} cells selected)`}
                      >
                        <Minus className="w-4 h-4" />
                        <span>0.</span>
                      </button>
                      <button
                        onClick={increaseDecimals}
                        disabled={selectedCells.length === 0}
                        className="px-1 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        title={`Increase decimal places (${selectedCells.length} cells selected)`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>0.00</span>
                      </button>
                      
                      {/* Date formatting button */}
                      <button
                        onClick={formatAsDate}
                        disabled={selectedCells.length === 0}
                        className="px-1 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        title={`Format as date (${selectedCells.length} cells selected)`}
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Date</span>
                      </button>
                      
                      {/* Dependency analysis button (toggle) */}
                      <button
                        onClick={handleDependencyAnalysis}
                        className={`px-1 py-1 text-xs rounded border transition-colors flex items-center justify-center w-6 h-6 ${
                          dependencyFrames
                            ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title={dependencyFrames ? "Clear dependency highlighting" : "Analyze formula dependencies"}
                      >
                        <Network className="w-4 h-4" />
                      </button>
                      
                    </div>
                    
                    {/* Formula display mode button */}
                    <button
                      onClick={() => setFormulaDisplayMode((prev) => (prev + 1) % 3)}
                      className={`px-1 py-1 text-xs rounded border transition-colors flex items-center justify-center w-6 h-6 ${
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
                      <Calculator className="w-5 h-5" />
                    </button>
                    
                    {/* Download button */}
                    <button
                      onClick={downloadAsExcel}
                      className="px-1 py-1 text-xs rounded border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center w-6 h-6"
                      title="Download Excel file"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                  
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden min-h-0">
                {spreadsheetData.length > 0 ? (
                  <ReactSpreadsheet 
                    data={spreadsheetData}
                    onDataChange={handleSpreadsheetChange}
                    formulaDisplayMode={formulaDisplayMode}
                    selectedCells={selectedCells}
                    onSelectedCellsChange={setSelectedCells}
                    dependencyFrames={dependencyFrames}
                  />
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No data to display</p>
                    <p className="text-sm mt-2">Data length: {spreadsheetData.length}</p>
                    <p className="text-sm">Excel data length: {excelData?.data?.length || 0}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sheet Navigation */}
            {excelData.allSheets.length > 1 && (
              <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Available Sheets:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {excelData.allSheets.map((sheet, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        sheet === excelData.sheetName
                          ? 'bg-primary-100 text-primary-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sheet}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
          </div>
          
          {/* Chat Interface */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col space-y-4 max-h-full overflow-hidden chat-container">
            <ChatInterface 
              onSendMessage={handleChatMessage}
              isLoading={isChatLoading}
              onClearHistory={handleClearHistory}
              onToolCall={handleToolCallRegistration}
              onAddBotMessage={handleBotMessageRegistration}
              llmService={llmServiceRef.current}
              onCancel={handleCancel}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}

export default App
