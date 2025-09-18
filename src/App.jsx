import React, { useState, useCallback, useMemo } from 'react'
import { Upload, FileSpreadsheet, X, Download, Edit3, Save } from 'lucide-react'
import * as XLSX from 'xlsx'
import Spreadsheet from 'react-spreadsheet'

function App() {
  const [excelData, setExcelData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [spreadsheetData, setSpreadsheetData] = useState([])

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
        
        // Convert to JSON with formulas preserved
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '',
          raw: false // This preserves formulas
        })
        
        // Convert to react-spreadsheet format
        const spreadsheetFormat = jsonData.map(row => 
          row.map(cell => ({
            value: cell || '',
            className: ''
          }))
        )
        
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
    setIsEditing(false)
  }, [])

  const downloadAsCSV = useCallback(() => {
    if (!spreadsheetData.length) return
    
    // Convert spreadsheet data back to array format
    const dataArray = spreadsheetData.map(row => 
      row.map(cell => cell.value)
    )
    
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(dataArray))
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [spreadsheetData, fileName])

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
  }, [])

  const toggleEdit = useCallback(() => {
    setIsEditing(!isEditing)
  }, [isEditing])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
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
        {!excelData && (
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
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Excel Preview */}
        {excelData && (
          <div className="max-w-7xl mx-auto">
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
                      {isEditing ? 'Editing mode - Click cells to edit' : 'View mode - Click Edit to enable editing'}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={toggleEdit}
                    className={`flex items-center space-x-2 ${
                      isEditing 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } font-medium py-2 px-4 rounded-lg transition-colors duration-200`}
                  >
                    {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                    <span>{isEditing ? 'Save' : 'Edit'}</span>
                  </button>
                  <button
                    onClick={downloadAsExcel}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    onClick={downloadAsCSV}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV</span>
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">
                    Excel Spreadsheet View
                  </h4>
                  <div className="text-xs text-gray-500">
                    {isEditing ? '✓ Editing enabled' : '👁️ View only'}
                  </div>
                </div>
              </div>
              
              <div className="overflow-auto max-h-[70vh]">
                <Spreadsheet
                  data={spreadsheetData}
                  onChange={handleSpreadsheetChange}
                  onSelect={isEditing ? undefined : () => {}} // Disable selection in view mode
                  onActivateEdit={isEditing ? undefined : () => {}} // Disable editing in view mode
                  columnLabels={true} // Show A, B, C column headers
                  rowLabels={true} // Show 1, 2, 3 row headers
                  className="w-full"
                />
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

            {/* Instructions */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                💡 How to use:
              </h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>View Mode:</strong> Browse your Excel data with exact cell positioning (A1, B2, etc.)</li>
                <li>• <strong>Edit Mode:</strong> Click any cell to edit values and formulas</li>
                <li>• <strong>Formulas:</strong> Start with = to enter formulas (e.g., =A1+B1)</li>
                <li>• <strong>Navigation:</strong> Use arrow keys, Tab, or click to move between cells</li>
                <li>• <strong>Export:</strong> Download as Excel (.xlsx) or CSV format</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
