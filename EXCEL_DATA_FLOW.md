# Excel Data Storage and Loading Flow

This document explains how values are stored and loaded when you upload an Excel file in the application.

## Overview

The application uses a two-tier data storage system to handle Excel files:
1. **Raw Excel Data** - Preserves original file structure and metadata
2. **Spreadsheet Format** - Optimized for React component rendering and editing

## File Upload Process

When you upload an Excel file, the following sequence occurs:

### 1. File Validation
```javascript
const validTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
]
```
- Supports `.xlsx`, `.xls`, and `.csv` files
- Validates file type and extension

### 2. File Reading
```javascript
const reader = new FileReader()
reader.readAsArrayBuffer(file)
```
- Uses FileReader API to read the file as ArrayBuffer
- Converts to Uint8Array for XLSX library processing

### 3. Workbook Processing
```javascript
const workbook = XLSX.read(data, { type: 'array' })
const firstSheetName = workbook.SheetNames[0]
const worksheet = workbook.Sheets[firstSheetName]
```
- Uses XLSX library to parse the Excel file
- Extracts the first sheet by default
- Preserves all sheet names for navigation

## Data Storage Structure

### Raw Excel Data (`excelData` state)
```javascript
setExcelData({
  sheetName: firstSheetName,
  data: jsonData,
  allSheets: workbook.SheetNames,
  worksheet: worksheet
})
```

**Contains:**
- `sheetName`: Name of the currently displayed sheet
- `data`: Raw JSON array of cell values
- `allSheets`: Array of all available sheet names
- `worksheet`: Original XLSX worksheet object for reference

### Spreadsheet Format (`spreadsheetData` state)
```javascript
const spreadsheetFormat = jsonData.map(row => 
  row.map(cell => ({
    value: cell || '',
    className: ''
  }))
)
```

**Each cell object contains:**
- `value`: The actual cell content (string, number, or formula)
- `className`: CSS class for styling (initially empty)
- `decimalPlaces`: Number of decimal places (added when formatting)
- `isDate`: Boolean flag for date cells (added when formatting as date)

## Value Types and Processing

### Regular Values
- **Numbers**: Stored as numbers or strings depending on context
- **Text**: Stored as strings
- **Empty cells**: Stored as empty strings `''`

### Formula Preservation
The application maintains Excel formulas through a two-step process:

1. **Initial Conversion**: Convert sheet to JSON with `raw: true`
2. **Formula Detection**: Iterate through cells to find formulas

```javascript
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
```

**Formula Storage:**
- Formulas are stored as strings starting with `=`
- Example: `=SUM(A1:A10)` or `=IF(B1>0,"Positive","Negative")`

### Date Value Handling
Dates can be processed in multiple formats:

1. **Excel Serial Numbers**: Automatically converted to YYYY-MM-DD format
2. **Date Strings**: Stored as strings with `isDate: true` flag
3. **Date Objects**: Used internally for calculations

**Date Detection Logic:**
```javascript
const isLikelyYear = numValue >= 1900 && numValue <= 2100 && numValue % 1 === 0
const isSmallInteger = numValue >= 1 && numValue <= 100 && numValue % 1 === 0
const isLikelyExcelSerial = numValue >= 1 && numValue <= 2958465 && !isLikelyYear && !isSmallInteger
```

## Data Loading and Display

### Virtual Rendering
The spreadsheet uses virtualization for efficient rendering of large datasets:

```javascript
const visibleData = useMemo(() => {
  if (!data || data.length === 0) return []

  const startRow = Math.max(0, visibleRange.startRow)
  const endRow = Math.min(visibleRange.endRow, data.length)
  const startCol = Math.max(0, visibleRange.startCol)
  const endCol = Math.min(visibleRange.endCol, data[0]?.length || 0)

  return data.slice(startRow, endRow).map(row =>
    row.slice(startCol, endCol)
  )
}, [data, visibleRange])
```

**Benefits:**
- Only renders visible cells
- Handles large datasets efficiently
- Smooth scrolling performance

### Formula Evaluation
Formulas are evaluated on-demand with intelligent caching:

```javascript
// Formula cache to store calculated results
const formulaCacheRef = useRef(new Map())
const formulaDependenciesRef = useRef(new Map())
const lastDataHashRef = useRef('')
```

**Features:**
- **Caching**: Results are cached to avoid recalculation
- **Dependency Tracking**: Tracks which cells depend on others
- **Circular Reference Detection**: Prevents infinite loops
- **Real-time Updates**: Recalculates when dependencies change

## Data Persistence and Export

### Download Process
When exporting back to Excel:

```javascript
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
```

**Process:**
1. Extract cell values from spreadsheet format
2. Convert to XLSX worksheet format
3. Create new workbook with original sheet name
4. Download as `.xlsx` file with `_edited` suffix

## Key Features

### Formula Support
- **Excel Functions**: SUM, AVERAGE, COUNT, MAX, MIN, IF, etc.
- **Date Functions**: TODAY, NOW, DATE, YEAR, MONTH, DAY, EOMONTH, EDATE
- **Text Functions**: CONCATENATE, LEN, UPPER, LOWER, LEFT, RIGHT, MID, FIND
- **Logical Functions**: ISNUMBER, ISTEXT, ISBLANK
- **Math Functions**: ABS, SQRT, POWER, ROUND, ROUNDUP, ROUNDDOWN

### Formatting Options
- **Decimal Places**: Adjustable precision for numeric values
- **Date Formatting**: Automatic detection and conversion of Excel serial numbers
- **Cell Styling**: CSS classes for visual formatting

### Multi-sheet Support
- Loads all sheets from the Excel file
- Displays first sheet by default
- Preserves sheet names for navigation
- Currently shows sheet list but doesn't support switching

### Performance Optimizations
- **Virtual Scrolling**: Only renders visible cells
- **Formula Caching**: Avoids redundant calculations
- **Debounced Updates**: Prevents excessive re-renders
- **Memoization**: Optimizes component re-rendering

## Data Flow Summary

1. **Upload** → File validation and reading
2. **Parse** → XLSX library converts to workbook
3. **Extract** → Convert worksheet to JSON array
4. **Preserve** → Maintain formulas and special formatting
5. **Transform** → Convert to React-friendly format
6. **Store** → Save in application state
7. **Render** → Display with virtual scrolling
8. **Edit** → Real-time updates with formula evaluation
9. **Export** → Convert back to Excel format for download

This architecture ensures faithful representation of Excel functionality while providing a modern, responsive web interface for viewing and editing spreadsheet data.
