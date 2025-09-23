import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, FileSpreadsheet, Download, Plus, Minus, Calendar, ArrowLeft, Calculator } from 'lucide-react'
import * as XLSX from 'xlsx'
import ReactSpreadsheet from './UniverSpreadsheet'
import ChatInterface from './components/ChatInterface'
import { LLMService } from './services/llmService'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/LoginPage'
import UserProfile from './components/UserProfile'

function MainApp() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <ExcelApp />
}

function ExcelApp() {
  const [excelData, setExcelData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const [spreadsheetData, setSpreadsheetData] = useState([])
  const [formulaDisplayMode, setFormulaDisplayMode] = useState(0) // 0: normal, 1: highlight formulas, 2: show all formulas
  const [selectedCells, setSelectedCells] = useState([]) // Array of selected cell coordinates
  const [isChatLoading, setIsChatLoading] = useState(false)
  const toolCallHandlerRef = useRef(null)
  const llmServiceRef = useRef(null)

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
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Convert to JSON format with better error handling and formatting extraction
        let jsonData
        let formattedData
        let cellFormats = {} // Store formatting information
        
        try {
          // Try different approaches to get formatted data
          console.log('Trying different XLSX reading approaches...')
          
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
          
          console.log('Raw data sample:', jsonData.slice(0, 3))
          console.log('Formatted data sample:', formattedData.slice(0, 3))
          
          // Debug: Log the worksheet object to see what's available
          console.log('Worksheet object keys:', Object.keys(worksheet))
          console.log('Sample worksheet cells:', Object.keys(worksheet).filter(key => /^[A-Z]+[0-9]+$/.test(key)).slice(0, 5))
          
          // Extract formatting information from each cell
          if (worksheet['!ref']) {
            const range = XLSX.utils.decode_range(worksheet['!ref'])
            console.log('Worksheet range:', range)
            
            for (let row = range.s.r; row <= range.e.r; row++) {
              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
                const cell = worksheet[cellAddress]
                
                if (cell) {
                  // Debug: Log only first few cells to see what's available
                  if (row < 3 && col < 3) {
                    console.log(`Cell ${cellAddress} full object:`, cell)
                  }
                  
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
                  
                  // Check if cell value contains € symbol and treat as currency
                  if (cell.v && typeof cell.v === 'string' && cell.v.includes('€')) {
                    console.log(`€ symbol found in cell ${cellAddress} value:`, cell.v)
                    formatInfo.isCurrency = true
                    formatInfo.currencySymbol = '€'
                  }
                  
                  // ALSO check the raw cell value for € symbols (for formula results)
                  if (cell && typeof cell === 'string' && cell.includes('€')) {
                    console.log(`€ symbol found in raw cell ${cellAddress} value:`, cell)
                    formatInfo.isCurrency = true
                    formatInfo.currencySymbol = '€'
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
                    
                    // Detect currency formats
                    if (format.includes('$') || format.includes('€') || format.includes('£') || 
                        format.includes('currency') || format.includes('eur') || format.includes('usd') ||
                        format.includes('gbp') || format.includes('euro') || format.includes('dollar')) {
                      formatInfo.isCurrency = true
                      if (format.includes('$') || format.includes('usd') || format.includes('dollar')) {
                        formatInfo.currencySymbol = '$'
                      } else if (format.includes('€') || format.includes('eur') || format.includes('euro')) {
                        formatInfo.currencySymbol = '€'
                      } else if (format.includes('£') || format.includes('gbp')) {
                        formatInfo.currencySymbol = '£'
                      } else {
                        formatInfo.currencySymbol = '$' // default
                      }
                      
                      // Log only € currency detection
                      if (formatInfo.currencySymbol === '€') {
                        console.log(`€ currency formatting detected in cell ${cellAddress}`)
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
                  console.log(`Fallback: Found formula in cell ${cellAddress}: ${cell.f}`)
                  jsonData[row][col] = '=' + cell.f
                }
              }
            }
          }
        }
        
        // First pass: detect currency columns by looking for € symbols in column values
        const currencyColumns = new Set()
        jsonData.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            if (cell && typeof cell === 'string' && cell.includes('€')) {
              currencyColumns.add(colIndex)
            }
            // Also check numberFormat for currency patterns
            const fmt = cellFormats[rowIndex]?.[colIndex]?.numberFormat || ''
            if (/[€$£]|(eur|usd|gbp|currency|accounting)/i.test(fmt)) {
              currencyColumns.add(colIndex)
            }
          })
        })
        
        if (currencyColumns.size > 0) {
          console.log('Currency columns detected:', Array.from(currencyColumns).map(col => String.fromCharCode(65 + col)))
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
            
            // If this column contains currency values, treat formula cells as currency too
            if (currencyColumns.has(colIndex) && formatInfo.isFormula) {
              isCurrency = true
              currencySymbol = '€'
              cellType = 'number'
            }
            
            // Extra fallback: infer from numberFormat even if raw text has "=..."
            if (formatInfo.isFormula && !isCurrency) {
              const nf = (formatInfo.numberFormat || '').toLowerCase()
              if (nf.includes('€') || nf.includes('eur') || nf.includes('euro')) {
                isCurrency = true
                currencySymbol = '€'
              } else if (nf.includes('$') || nf.includes('usd') || nf.includes('dollar')) {
                isCurrency = true
                currencySymbol = '$'
              } else if (nf.includes('£') || nf.includes('gbp')) {
                isCurrency = true
                currencySymbol = '£'
              }
              if (isCurrency) cellType = 'number'
            }
            
            // ALSO check if the actual cell value contains € symbol
            if (cell && typeof cell === 'string' && cell.includes('€')) {
              // console: detected € in value
              isCurrency = true
              currencySymbol = '€'
              cellType = 'number'
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
                  if (typeof cell === 'number' && cell > 25569 && cell < 2958465) {
                    isDate = true
                    cellType = 'date'
                  }
                  break
                case 's': cellType = 'text'; break
                case 'b': cellType = 'boolean'; break
              }
            }
            
            // Additional date detection for Excel serial dates
            if (typeof cell === 'number' && cell > 25569 && cell < 2958465 && !isDate) {
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
                console.log(`Formula cell R${rowIndex + 1}C${colIndex + 1}:`, {
                  formula: cell,
                  formatInfo: formatInfo,
                  isCurrency: isCurrency,
                  currencySymbol: currencySymbol,
                  cellType: cellType
                })
              }
            } else {
              // Use formatted value for non-formulas
              cellValue = formattedValue
            }
            
            return {
              value: cellValue, // Formula string for formulas, formatted value for others
              rawValue: rawValue, // Keep raw value for reference
              className: '',
              // Enhanced formatting properties
              ...cellInfo
            }
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
        if (formatExamples.length > 0) {
          console.log('Formatting examples (first 4 cells):', formatExamples)
        }
        
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

  // Helper function to format cell values according to Excel formatting
  const formatCellValue = useCallback((value, cellInfo) => {
    if (!value && value !== 0) return ''
    
    // If it's a formula, return as-is
    if (cellInfo?.isFormula) {
      return value
    }
    
    // Format based on cell type and number format
    if (cellInfo?.isDate && cellInfo?.numberFormat) {
      try {
        // Convert Excel serial date to JavaScript Date
        if (typeof value === 'number' && value > 25569) { // Excel epoch starts at 1900-01-01
          const excelEpoch = new Date(1900, 0, 1)
          const jsDate = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000)
          
          // Apply basic date formatting based on the format string
          if (cellInfo.numberFormat.includes('mm/dd/yyyy') || cellInfo.numberFormat.includes('m/d/yyyy')) {
            return jsDate.toLocaleDateString('en-US')
          } else if (cellInfo.numberFormat.includes('dd/mm/yyyy') || cellInfo.numberFormat.includes('d/m/yyyy')) {
            return jsDate.toLocaleDateString('en-GB')
          } else if (cellInfo.numberFormat.includes('yyyy-mm-dd')) {
            return jsDate.toISOString().split('T')[0]
          } else if (cellInfo.numberFormat.includes('h:mm') || cellInfo.numberFormat.includes('hh:mm')) {
            return jsDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          } else {
            return jsDate.toLocaleDateString()
          }
        }
      } catch (error) {
        console.warn('Error formatting date:', error)
      }
    }
    
    // Format numbers with currency, percentage, etc.
    if (cellInfo?.cellType === 'number' && cellInfo?.numberFormat) {
      try {
        const numValue = parseFloat(value)
        if (!isNaN(numValue)) {
          // Use enhanced formatting properties
          if (cellInfo.isCurrency && cellInfo.currencySymbol) {
            const currency = cellInfo.currencySymbol === '$' ? 'USD' : 
                           cellInfo.currencySymbol === '€' ? 'EUR' : 
                           cellInfo.currencySymbol === '£' ? 'GBP' : 'USD'
            const dp = Number.isInteger(cellInfo.decimalPlaces) ? cellInfo.decimalPlaces : 2
            return new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: currency,
              minimumFractionDigits: dp,
              maximumFractionDigits: dp
            }).format(numValue)
          } else if (cellInfo.isPercentage) {
            return new Intl.NumberFormat('en-US', { 
              style: 'percent',
              minimumFractionDigits: Number.isInteger(cellInfo.decimalPlaces) ? cellInfo.decimalPlaces : 2,
              maximumFractionDigits: Number.isInteger(cellInfo.decimalPlaces) ? cellInfo.decimalPlaces : 2
            }).format(numValue / 100)
          } else if (cellInfo.decimalPlaces !== null && cellInfo.decimalPlaces !== undefined) {
            return numValue.toFixed(cellInfo.decimalPlaces)
          }
        }
      } catch (error) {
        console.warn('Error formatting number:', error)
      }
    }
    
    return value
  }, [])

  // Debug function to test formatting - call from browser console
  window.debugFormatting = () => {
    console.log('=== FORMATTING DEBUG ===')
    console.log('Excel Data:', excelData)
    console.log('Spreadsheet Data (first 3 rows):', spreadsheetData.slice(0, 3))
    
    if (excelData?.cellFormats) {
      console.log('Cell Formats:', excelData.cellFormats)
      
      // Show first few cells with formatting
      Object.keys(excelData.cellFormats).slice(0, 3).forEach(row => {
        Object.keys(excelData.cellFormats[row]).slice(0, 3).forEach(col => {
          const format = excelData.cellFormats[row][col]
          if (format.numberFormat || format.cellType) {
            console.log(`Cell R${parseInt(row)+1}C${parseInt(col)+1}:`, format)
          }
        })
      })
    }
    
    // Test a specific cell
    if (spreadsheetData.length > 0 && spreadsheetData[0].length > 0) {
      const testCell = spreadsheetData[0][0]
      console.log('Test Cell (A1):', testCell)
    }
  }

  // Debug function specifically for formula cells with currency formatting
  window.debugFormulaCurrency = () => {
    console.log('=== FORMULA CURRENCY DEBUG ===')
    if (!spreadsheetData.length) {
      console.log('No spreadsheet data available')
      return
    }
    
    let foundCurrencyFormulas = false
    spreadsheetData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell?.isFormula && cell?.isCurrency) {
          foundCurrencyFormulas = true
          console.log(`Currency formula R${rowIndex + 1}C${colIndex + 1}:`, {
            value: cell.value,
            isCurrency: cell.isCurrency,
            currencySymbol: cell.currencySymbol,
            decimalPlaces: cell.decimalPlaces,
            cellType: cell.cellType,
            numberFormat: cell.numberFormat
          })
        }
      })
    })
    
    if (!foundCurrencyFormulas) {
      console.log('No currency formula cells found')
    }
  }

  // Debug function to show all number formats found in the file
  window.debugNumberFormats = () => {
    console.log('=== NUMBER FORMATS DEBUG ===')
    if (!excelData?.cellFormats) {
      console.log('No cell formats available')
      return
    }
    
    const formats = new Set()
    Object.keys(excelData.cellFormats).forEach(row => {
      Object.keys(excelData.cellFormats[row]).forEach(col => {
        const format = excelData.cellFormats[row][col]
        if (format.numberFormat) {
          formats.add(format.numberFormat)
        }
      })
    })
    
    console.log('All number formats found:', Array.from(formats))
    
    // Show cells with currency-like formats
    Object.keys(excelData.cellFormats).forEach(row => {
      Object.keys(excelData.cellFormats[row]).forEach(col => {
        const format = excelData.cellFormats[row][col]
        if (format.numberFormat && (format.numberFormat.includes('$') || format.numberFormat.includes('€') || format.numberFormat.includes('£'))) {
          console.log(`Currency format in R${parseInt(row)+1}C${parseInt(col)+1}:`, {
            numberFormat: format.numberFormat,
            isFormula: format.isFormula,
            isCurrency: format.isCurrency,
            currencySymbol: format.currencySymbol
          })
        }
      })
    })
  }

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
    console.log('Spreadsheet data changed:', data)
    setSpreadsheetData(data)
    
    // Update LLM service with new data
    if (llmServiceRef.current) {
      llmServiceRef.current.updateSpreadsheetData(data)
    }
  }, [])

  // Initialize LLM service when spreadsheet data is available
  const hasSpreadsheetData = spreadsheetData.length > 0;
  useEffect(() => {
    if (hasSpreadsheetData) {
      llmServiceRef.current = new LLMService(spreadsheetData, setSpreadsheetData, toolCallHandlerRef.current)
    }
  }, [hasSpreadsheetData, spreadsheetData])

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

  // Handle clearing conversation history
  const handleClearHistory = useCallback(() => {
    if (llmServiceRef.current) {
      llmServiceRef.current.clearHistory()
    }
  }, [])


  // Increase decimal places for selected cells
  const increaseDecimals = useCallback(() => {
    if (selectedCells.length === 0) return
    
    setSpreadsheetData(prevData => {
      const newData = [...prevData]
      selectedCells.forEach(({ row, col }) => {
        if (newData[row] && newData[row][col]) {
          const cell = newData[row][col]
          
          // Get current decimal places setting (default to 0 if not set)
          const currentDecimals = cell.decimalPlaces || 0
          const newDecimals = Math.min(currentDecimals + 1, 10) // Max 10 decimals
          
          // Update the cell with new decimal places setting
          newData[row][col] = {
            ...cell,
            decimalPlaces: newDecimals
          }
        }
      })
      return newData
    })
  }, [selectedCells])

  // Decrease decimal places for selected cells
  const decreaseDecimals = useCallback(() => {
    if (selectedCells.length === 0) return
    
    setSpreadsheetData(prevData => {
      const newData = [...prevData]
      selectedCells.forEach(({ row, col }) => {
        if (newData[row] && newData[row][col]) {
          const cell = newData[row][col]
          
          // Get current decimal places setting (default to 0 if not set)
          const currentDecimals = cell.decimalPlaces || 0
          const newDecimals = Math.max(currentDecimals - 1, 0) // Min 0 decimals
          
          // Update the cell with new decimal places setting
          newData[row][col] = {
            ...cell,
            decimalPlaces: newDecimals
          }
        }
      })
      return newData
    })
  }, [selectedCells])

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
              console.log(`Value ${numValue} detected as likely Excel serial number (not year: ${!isLikelyYear}, not small int: ${!isSmallInteger})`)
              // Use xlsx library to convert Excel serial number to date
              try {
                // Try using XLSX.SSF.format with date format
                const dateString = XLSX.SSF.format('yyyy-mm-dd', numValue)
                console.log(`Converting Excel serial ${numValue} to date:`, dateString)
                
                if (dateString && dateString !== 'Invalid Date' && !dateString.includes('Invalid')) {
                  const jsDate = new Date(dateString)
                  console.log(`Parsed date for ${numValue}:`, jsDate)
                  
                  // Check if the resulting date is reasonable (between 1900 and 2100)
                  if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() >= 1900 && jsDate.getFullYear() <= 2100) {
                    console.log(`Setting cell value to:`, dateString)
                    newData[row][col] = {
                      ...cell,
                      value: dateString, // Store as YYYY-MM-DD format
                      isDate: true
                    }
                  } else {
                    console.log(`Date ${jsDate} is not in valid range (1900-2100), skipping conversion`)
                  }
                } else {
                  console.log(`Invalid date string returned for ${numValue}:`, dateString)
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
              if (isLikelyYear) {
                console.log(`Value ${numValue} appears to be a year, skipping date conversion`)
              } else if (isSmallInteger) {
                console.log(`Value ${numValue} is a small integer, skipping date conversion`)
              } else {
                console.log(`Value ${numValue} is not a likely Excel serial number, skipping date conversion`)
              }
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
      console.log('Spreadsheet data updated:', spreadsheetData.length, 'rows')
    }
  }, [spreadsheetData])

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <div className="relative w-5 h-5">
                {/* 4-point star with central square and triangular points */}
                {/* Central square */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white"></div>
                {/* Top point */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-b-[6px] border-l-transparent border-r-transparent border-b-white"></div>
                {/* Bottom point */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[6px] border-l-transparent border-r-transparent border-t-white"></div>
                {/* Left point */}
                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-0 h-0 border-t-[3px] border-b-[3px] border-r-[6px] border-t-transparent border-b-transparent border-r-white"></div>
                {/* Right point */}
                <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-0 h-0 border-t-[3px] border-b-[3px] border-l-[6px] border-t-transparent border-b-transparent border-l-white"></div>
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-800">Zenith</h1>
          </div>
          <UserProfile />
        </div>
      </div>
      {!excelData ? (
        // Upload state - centered layout
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {/* Upload Instructions */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Welcome to Zenith
            </h2>
            <p className="text-gray-600 text-lg">
              Upload and analyze your data with AI
            </p>
          </div>

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
                        <span>+0.0</span>
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
              onToolCall={(handler) => { toolCallHandlerRef.current = handler; }}
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
