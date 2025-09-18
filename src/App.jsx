import React, { useState, useCallback, useEffect } from 'react'
import { Upload, FileSpreadsheet, X, Download, Plus, Minus, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'
import ReactSpreadsheet from './UniverSpreadsheet'

function App() {
  const [excelData, setExcelData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const [spreadsheetData, setSpreadsheetData] = useState([])
  const [formulaDisplayMode, setFormulaDisplayMode] = useState(0) // 0: normal, 1: highlight formulas, 2: show all formulas
  const [selectedCells, setSelectedCells] = useState([]) // Array of selected cell coordinates

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
        
        // Convert to JSON format with better error handling
        let jsonData
        try {
          // First try to get formulas
          jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: true
          })
          
          // Now try to preserve formulas by checking each cell
          if (worksheet['!ref']) {
            const range = XLSX.utils.decode_range(worksheet['!ref'])
            for (let row = range.s.r; row <= range.e.r; row++) {
              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
                const cell = worksheet[cellAddress]
                
                if (cell && cell.f && jsonData[row] && jsonData[row][col] !== undefined) {
                  // Replace the value with the formula
                  jsonData[row][col] = '=' + cell.f
                }
              }
            }
          }
        } catch (error) {
          console.warn('Error processing formulas, falling back to basic conversion:', error)
          // Fallback to basic conversion
          jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: false
          })
        }
        
        // Convert to react-spreadsheet format
        const spreadsheetFormat = jsonData.map(row => 
          row.map(cell => ({
            value: cell || '',
            className: ''
          }))
        )
        
        console.log('Original data:', jsonData.slice(0, 5)) // Debug first 5 rows
        console.log('Spreadsheet format:', spreadsheetFormat.slice(0, 5)) // Debug first 5 rows
        
        setExcelData({
          sheetName: firstSheetName,
          data: jsonData,
          allSheets: workbook.SheetNames,
          worksheet: worksheet
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








  // Debug effect to log spreadsheet data changes
  useEffect(() => {
    console.log('Spreadsheet data updated:', spreadsheetData.length, 'rows')
    if (spreadsheetData.length > 0) {
      console.log('First row:', spreadsheetData[0])
    }
  }, [spreadsheetData])

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {!excelData ? (
        // Upload state - centered layout
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Excel Preview App
            </h1>
            <p className="text-gray-600 text-lg">
              Upload and preview your Excel files with ease
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
        // Spreadsheet state - full layout
        <div className="flex-1 flex flex-col px-4 py-4 min-h-0">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Excel Preview App
            </h1>
            <p className="text-gray-600 text-lg">
              Upload and preview your Excel files with ease
            </p>
          </div>

          {/* Excel Preview */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* File Info and Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {fileName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Sheet: {excelData.sheetName} • {spreadsheetData.length} rows • {spreadsheetData[0]?.length || 0} columns
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Click any cell to start editing
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={downloadAsExcel}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    onClick={clearData}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Spreadsheet Component */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">
                    Excel Spreadsheet View
                  </h4>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    {/* Decimal formatting buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={decreaseDecimals}
                        disabled={selectedCells.length === 0}
                        className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        title={`Decrease decimal places (${selectedCells.length} cells selected)`}
                      >
                        <Minus className="w-3 h-3" />
                        <span>0.</span>
                      </button>
                      <button
                        onClick={increaseDecimals}
                        disabled={selectedCells.length === 0}
                        className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        title={`Increase decimal places (${selectedCells.length} cells selected)`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>0.00</span>
                      </button>
                      
                      {/* Date formatting button */}
                      <button
                        onClick={formatAsDate}
                        disabled={selectedCells.length === 0}
                        className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        title={`Format as date (${selectedCells.length} cells selected)`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Date</span>
                      </button>
                      
                      {selectedCells.length > 0 && (
                        <span className="text-xs text-gray-500 ml-1">
                          {selectedCells.length} selected
                        </span>
                      )}
                    </div>
                    
                    {/* Formula display mode button */}
                    <button
                      onClick={() => setFormulaDisplayMode((prev) => (prev + 1) % 3)}
                      className={`px-2 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
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
                      <span className="text-sm">∑</span>
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
      )}
    </div>
  )
}

export default App
