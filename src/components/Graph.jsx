import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { MoreHorizontal, Edit, Trash2, Plus } from 'lucide-react'

const Graph = ({ 
  data, 
  title, 
  xAxisRange, 
  yAxisRange, 
  onConfigChange, 
  isEditing = false, 
  onEditToggle,
  onDelete,
  onAddGraph,
  spreadsheetData = [],
  allSheetsData = {},
  currentSheetName = 'Sheet1'
}) => {
  const [editMode, setEditMode] = useState(isEditing)
  const [showMenu, setShowMenu] = useState(false)
  const [config, setConfig] = useState({
    title: title || '',
    xAxisRange: xAxisRange || '',
    yAxisRange: yAxisRange || ''
  })
  const [xAxisLabels, setXAxisLabels] = useState([])
  const previousGraphDataRef = useRef([])
  const lastSpreadsheetDataRef = useRef([])

  // Helper function to parse cell reference to row/col indices
  const parseCellPosition = useCallback((cellRef) => {
    const match = cellRef.match(/([A-Z]+)(\d+)/)
    if (!match) return null
    
    const [, col, row] = match
    const colIndex = col.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
    const rowIndex = parseInt(row) - 1
    
    return { row: rowIndex, col: colIndex }
  }, [])

  // Helper function to check if a cell is within a range
  const isCellInRange = useCallback((cellRef, range) => {
    if (!range || !cellRef) return false
    
    const cellPos = parseCellPosition(cellRef)
    if (!cellPos) return false
    
    const [start, end] = range.split(':')
    if (!start || !end) return false
    
    const startPos = parseCellPosition(start)
    const endPos = parseCellPosition(end)
    if (!startPos || !endPos) return false
    
    return cellPos.row >= startPos.row && cellPos.row <= endPos.row &&
           cellPos.col >= startPos.col && cellPos.col <= endPos.col
  }, [parseCellPosition])

  // Helper function to extract cell references from a formula
  const extractCellReferences = useCallback((formula) => {
    if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) return []
    
    const expression = formula.slice(1)
    const references = []
    
    // Handle ranges (e.g., A1:B3, $A$1:$B$3)
    const rangeRegex = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/g
    let rangeMatch
    while ((rangeMatch = rangeRegex.exec(expression)) !== null) {
      const [, startCol, startRow, endCol, endRow] = rangeMatch
      const startColIndex = startCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
      const endColIndex = endCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
      const startRowIndex = parseInt(startRow) - 1
      const endRowIndex = parseInt(endRow) - 1
      
      // Add all cells in the range
      for (let row = startRowIndex; row <= endRowIndex; row++) {
        for (let col = startColIndex; col <= endColIndex; col++) {
          references.push({ row, col })
        }
      }
    }
    
    // Handle individual cell references (e.g., A1, $A$1)
    const cellRefRegex = /\$?([A-Z]+)\$?(\d+)/g
    let match
    while ((match = cellRefRegex.exec(expression)) !== null) {
      const [, col, row] = match
      const colIndex = col.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
      const rowIndex = parseInt(row) - 1
      
      // Check if this cell is already included in a range
      const isInRange = references.some(ref => ref.row === rowIndex && ref.col === colIndex)
      if (!isInRange) {
        references.push({ row: rowIndex, col: colIndex })
      }
    }
    
    return references
  }, [])

  // Check if spreadsheet data has changed in cells that affect this graph
  const hasRelevantChanges = useCallback((currentData, previousData) => {
    console.log('🔍 Checking for changes in graph ranges:', { 
      xAxisRange: config.xAxisRange, 
      yAxisRange: config.yAxisRange,
      hasPreviousData: !!previousData,
      currentDataLength: currentData?.length,
      previousDataLength: previousData?.length
    })
    
    if (!previousData || previousData.length === 0) {
      console.log('✅ No previous data, triggering update')
      return true
    }
    
    // Check if data structure changed
    if (currentData.length !== previousData.length) {
      console.log('✅ Data structure changed, triggering update')
      return true
    }
    
    // Check each cell in the graph's ranges
    const rangesToCheck = [config.xAxisRange, config.yAxisRange].filter(Boolean)
    const cellsToCheck = new Set()
    
    for (const range of rangesToCheck) {
      const [start, end] = range.split(':')
      if (!start || !end) continue
      
      const startPos = parseCellPosition(start)
      const endPos = parseCellPosition(end)
      if (!startPos || !endPos) continue
      
      // Add all cells in this range to check list
      for (let row = startPos.row; row <= endPos.row; row++) {
        for (let col = startPos.col; col <= endPos.col; col++) {
          cellsToCheck.add(`${row}-${col}`)
        }
      }
    }
    
    console.log('🔍 Direct cells to check:', Array.from(cellsToCheck))
    
    // Recursively check cells referenced by formulas (multiple levels deep)
    const checkReferencedCells = (cellsToCheck) => {
      const newCellsToCheck = new Set(cellsToCheck)
      let hasNewCells = true
      
      while (hasNewCells) {
        hasNewCells = false
        const currentCells = Array.from(newCellsToCheck)
        
        for (const cellKey of currentCells) {
          const [row, col] = cellKey.split('-').map(Number)
          const cell = currentData[row]?.[col]
          
          if (cell?.value && String(cell.value).startsWith('=')) {
            // Extract cell references from this formula
            const references = extractCellReferences(cell.value)
            references.forEach(ref => {
              const refKey = `${ref.row}-${ref.col}`
              if (!newCellsToCheck.has(refKey)) {
                newCellsToCheck.add(refKey)
                hasNewCells = true
              }
            })
          }
        }
      }
      
      return newCellsToCheck
    }
    
    // Start with cells in the graph's ranges
    const initialCellsToCheck = new Set(cellsToCheck)
    
    // Recursively find all dependent cells
    const allCellsToCheck = checkReferencedCells(initialCellsToCheck)
    
    console.log('🔍 All cells to check (including dependencies):', Array.from(allCellsToCheck))
    
    // Check all relevant cells for changes
    for (const cellKey of allCellsToCheck) {
      const [row, col] = cellKey.split('-').map(Number)
      const currentCell = currentData[row]?.[col]
      const previousCell = previousData[row]?.[col]
      
      // Check if cell value or display value changed
      const cellValueChanged = currentCell?.value !== previousCell?.value
      const cellDisplayValueChanged = currentCell?.displayValue !== previousCell?.displayValue
      
      // Consider any change in value or displayValue as a relevant change
      if (cellValueChanged || cellDisplayValueChanged) {
        
        // Determine if this is a direct or indirect change
        const isDirectChange = cellsToCheck.has(cellKey)
        const changeType = isDirectChange ? 'direct' : 'indirect'
        
        console.log(`📊 Graph updating: Cell ${String.fromCharCode(65 + col)}${row + 1} changed (${changeType} reference)`, {
          currentValue: currentCell?.value,
          previousValue: previousCell?.value,
          currentDisplayValue: currentCell?.displayValue,
          previousDisplayValue: previousCell?.displayValue
        })
        return true
      }
    }
    
    console.log('❌ No relevant changes detected')
    return false
  }, [config.xAxisRange, config.yAxisRange, parseCellPosition, extractCellReferences])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.relative')) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  // Parse cell reference to get value from spreadsheet
  const parseCellReference = useCallback((cellRef) => {
    if (!cellRef) {
      return ''
    }
    
    // Handle inter-sheet references like 'Sheet2'!A1
    const interSheetMatch = cellRef.match(/^'([^']+)'!(.+)$/)
    if (interSheetMatch) {
      const [, sheetName, cellAddress] = interSheetMatch
      return parseCellReference(cellAddress, sheetName)
    }
    
    // Parse cell reference like A1, B2, etc.
    const cellRefRegex = /([A-Z]+)(\d+)/
    const match = cellRef.match(cellRefRegex)
    if (!match) {
      return ''
    }
    
    const [, col, row] = match
    const colIndex = col.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
    const rowIndex = parseInt(row) - 1
    
    // Get data from appropriate sheet
    let sheetData = spreadsheetData
    if (currentSheetName !== 'Sheet1') {
      const sheetInfo = allSheetsData[currentSheetName]
      if (sheetInfo && sheetInfo.spreadsheetData) {
        sheetData = sheetInfo.spreadsheetData
      }
    }
    
    const cell = sheetData[rowIndex]?.[colIndex]
    
    if (!cell) {
      return ''
    }
    
    // Return the display value or calculated result
    const result = cell.value || ''
    return result
  }, [spreadsheetData, allSheetsData, currentSheetName])

  // Parse range to get array of values
  const parseRange = useCallback((range, isXAxis = false) => {
    if (!range) {
      return []
    }
    
    // Handle inter-sheet references
    const interSheetMatch = range.match(/^'([^']+)'!(.+)$/)
    if (interSheetMatch) {
      const [, sheetName, cellRange] = interSheetMatch
      return parseRange(cellRange, isXAxis)
    }
    
    const [start, end] = range.split(':')
    if (!start || !end) {
      return []
    }
    
    // Parse start and end cells
    const startMatch = start.match(/([A-Z]+)(\d+)/)
    const endMatch = end.match(/([A-Z]+)(\d+)/)
    
    if (!startMatch || !endMatch) {
      return []
    }
    
    const [, startCol, startRow] = startMatch
    const [, endCol, endRow] = endMatch
    
    const startColIndex = startCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
    const endColIndex = endCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
    const startRowIndex = parseInt(startRow) - 1
    const endRowIndex = parseInt(endRow) - 1
    
    const values = []
    const cellDetails = []
    
    console.log(`🔍 Parsing ${isXAxis ? 'X' : 'Y'}-axis range:`, range, 'from', startRowIndex, startColIndex, 'to', endRowIndex, endColIndex)
    
    for (let r = startRowIndex; r <= endRowIndex; r++) {
      for (let c = startColIndex; c <= endColIndex; c++) {
        const cell = spreadsheetData[r]?.[c]
        const cellRef = String.fromCharCode(65 + c) + (r + 1)
        
        console.log(`🔍 Checking cell ${cellRef}:`, {
          hasCell: !!cell,
          value: cell?.value,
          displayValue: cell?.displayValue,
          computedValue: cell?.computedValue,
          isFormula: cell?.value?.toString().startsWith('=')
        })
        
        if (cell && cell.value !== undefined && cell.value !== '') {
        // Get the display value (calculated result for formulas)
        let displayValue = cell.value
        let numValue = parseFloat(displayValue)
        
        // If it's a formula, we need to get the evaluated result
        if (String(cell.value).startsWith('=')) {
          // For formulas, we need to get the calculated result
          // The spreadsheet should have already calculated this, so we look for the computed value
          // Check if there's a computed/display value in the cell object
          if (cell.computedValue !== undefined && cell.computedValue !== null) {
            displayValue = cell.computedValue
            numValue = parseFloat(displayValue)
            console.log(`✅ Using computedValue for ${cellRef}:`, displayValue)
          } else if (cell.displayValue !== undefined && cell.displayValue !== null && cell.displayValue !== '') {
            displayValue = cell.displayValue
            numValue = parseFloat(displayValue)
            console.log(`✅ Using displayValue for ${cellRef}:`, displayValue)
          } else {
            // If no computed/display value, skip this cell during recalculation
            // This prevents showing incorrect data (0 values) during recalculation
            console.log(`⚠️ No computed/display value for ${cellRef}, skipping`)
            if (isXAxis) {
              values.push(values.length) // Still add index for X-axis
            }
            continue
          }
        } else {
          // For non-formula cells, use displayValue if available, otherwise use value
          if (cell.displayValue !== undefined && cell.displayValue !== null && cell.displayValue !== '') {
            displayValue = cell.displayValue
            numValue = parseFloat(displayValue)
          }
        }
          
          cellDetails.push({
            cellRef,
            row: r,
            col: c,
            rawValue: cell.value,
            displayValue: displayValue,
            parsedValue: numValue,
            isNumber: !isNaN(numValue)
          })
          
        if (isXAxis) {
          // For X-axis, use index position (0, 1, 2, 3...) for positioning
          values.push(values.length) // Use the current length as the index
        } else {
          // For Y-axis, use numeric values
          if (!isNaN(numValue)) {
            values.push(numValue)
            console.log(`✅ Added Y-value for ${cellRef}:`, numValue)
          } else {
            console.log(`❌ Invalid Y-value for ${cellRef}:`, numValue)
          }
        }
        } else {
          console.log(`❌ Empty cell ${cellRef}`)
          cellDetails.push({
            cellRef,
            row: r,
            col: c,
            rawValue: cell?.value || 'empty',
            parsedValue: null,
            isNumber: false
          })
          
          if (isXAxis) {
            // For X-axis, still add index even for empty cells
            values.push(values.length)
          }
        }
      }
    }
    
    console.log(`📊 Final ${isXAxis ? 'X' : 'Y'}-axis values:`, values)
    return values
  }, [spreadsheetData])

  // Parse range to get array of cell values (for X-axis labels)
  const parseRangeValues = useCallback((range) => {
    if (!range) {
      return []
    }
    
    // Handle inter-sheet references
    const interSheetMatch = range.match(/^'([^']+)'!(.+)$/)
    if (interSheetMatch) {
      const [, sheetName, cellRange] = interSheetMatch
      return parseRangeValues(cellRange)
    }
    
    const [start, end] = range.split(':')
    if (!start || !end) {
      return []
    }
    
    // Parse start and end cells
    const startMatch = start.match(/([A-Z]+)(\d+)/)
    const endMatch = end.match(/([A-Z]+)(\d+)/)
    
    if (!startMatch || !endMatch) {
      return []
    }
    
    const [, startCol, startRow] = startMatch
    const [, endCol, endRow] = endMatch
    
    const startColIndex = startCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
    const endColIndex = endCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
    const startRowIndex = parseInt(startRow) - 1
    const endRowIndex = parseInt(endRow) - 1
    
    const values = []
    const cellDetails = []
    
    for (let r = startRowIndex; r <= endRowIndex; r++) {
      for (let c = startColIndex; c <= endColIndex; c++) {
        const cell = spreadsheetData[r]?.[c]
        const cellRef = String.fromCharCode(65 + c) + (r + 1)
        
        const cellValue = cell?.value || ''
        cellDetails.push({
          cellRef,
          row: r,
          col: c,
          rawValue: cellValue,
          displayValue: String(cellValue)
        })
        
        values.push(String(cellValue))
      }
    }
    
    return values
  }, [spreadsheetData])

  // Get graph data based on configuration
  const graphData = useMemo(() => {
    if (!config.xAxisRange || !config.yAxisRange) {
      return []
    }
    
    // Check if spreadsheet data is loaded and has content
    if (!spreadsheetData || spreadsheetData.length === 0) {
      // Return previous data if available to prevent flickering
      return previousGraphDataRef.current
    }
    
    // Check if we need to update based on actual cell value changes
    let needsUpdate = hasRelevantChanges(spreadsheetData, lastSpreadsheetDataRef.current)
    
    // Also force update if data reference changed (new data object from parent)
    if (spreadsheetData !== lastSpreadsheetDataRef.current) {
      console.log('🔄 Data reference changed, forcing update')
      needsUpdate = true
    }
    
    if (!needsUpdate && previousGraphDataRef.current.length > 0) {
      // Still update X-axis labels even if we skip recalculation
      const xLabels = parseRangeValues(config.xAxisRange)
      setXAxisLabels(xLabels)
      return previousGraphDataRef.current
    }
    
    console.log('✅ Graph updating with new data')
    
    const xValues = parseRange(config.xAxisRange, true) // true = isXAxis
    const yValues = parseRange(config.yAxisRange, false) // false = isYAxis
    
    console.log('🔍 Parsed values:', { xValues, yValues, xLength: xValues.length, yLength: yValues.length })
    
    // Get X-axis labels (actual cell values)
    const xLabels = parseRangeValues(config.xAxisRange)
    setXAxisLabels(xLabels)
    
    // If Y-axis values are empty (formulas being recalculated), use previous data
    if (yValues.length === 0 && previousGraphDataRef.current.length > 0) {
      console.log('⚠️ Y-axis values empty (formulas recalculating), using previous data')
      return previousGraphDataRef.current
    }
    
    // Ensure both arrays have the same length
    const minLength = Math.min(xValues.length, yValues.length)
    
    if (minLength === 0) {
      console.log('❌ No data points - returning empty array', { xValues, yValues })
      return []
    }
    
    const data = xValues.slice(0, minLength).map((x, index) => ({
      x: x,
      y: yValues[index]
    }))
    
    console.log('📊 Graph data updated:', data.length, 'points')
    
    // Store the current data for future fallback
    previousGraphDataRef.current = data
    
    // Update the reference for next comparison AFTER we've processed the new data
    lastSpreadsheetDataRef.current = spreadsheetData
    
    return data
  }, [config.xAxisRange, config.yAxisRange, parseRange, parseRangeValues, spreadsheetData, hasRelevantChanges])

  // Generate nice tick values for Y-axis
  const generateNiceTicks = useCallback((min, max) => {
    if (min === max) {
      return [min, min + 1, min + 2]
    }
    
    const range = max - min
    const roughStep = range / 5 // Aim for about 5 ticks
    
    // Find the best step size from our preferred values
    const preferredSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const normalizedStep = roughStep / magnitude
    
    let bestStep = 1
    for (const step of preferredSteps) {
      if (step * magnitude >= roughStep) {
        bestStep = step * magnitude
        break
      }
    }
    
    // Generate ticks
    const startTick = Math.floor(min / bestStep) * bestStep
    const ticks = []
    
    for (let tick = startTick; tick <= max + bestStep; tick += bestStep) {
      if (tick >= min - bestStep * 0.1) { // Small tolerance for floating point
        ticks.push(tick)
      }
    }
    
    return ticks
  }, [])

  // Calculate axis scales dynamically
  const axisScales = useMemo(() => {
    if (graphData.length === 0) {
      return { xMin: 0, xMax: 10, yMin: 0, yMax: 10, yTicks: [0, 2, 4, 6, 8, 10] }
    }
    
    const xValues = graphData.map(d => d.x).filter(v => !isNaN(v))
    const yValues = graphData.map(d => d.y).filter(v => !isNaN(v))
    
    if (xValues.length === 0 || yValues.length === 0) {
      return { xMin: 0, xMax: 10, yMin: 0, yMax: 10, yTicks: [0, 2, 4, 6, 8, 10] }
    }
    
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    // Validate min/max values
    if (isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) {
      return { xMin: 0, xMax: 10, yMin: 0, yMax: 10, yTicks: [0, 2, 4, 6, 8, 10] }
    }
    
    // Add some padding
    const xPadding = Math.max((xMax - xMin) * 0.1, 0.1)
    const yPadding = Math.max((yMax - yMin) * 0.1, 0.1)
    
    // For Y-axis: if minimum value is not negative (>= 0), start at 0
    const adjustedYMin = yMin >= 0 ? 0 : yMin - yPadding
    
    // Add 20% padding to maximum Y-axis value
    const adjustedYMax = yMax + (yMax * 0.2)
    
    // Generate nice Y-axis ticks
    const yTicks = generateNiceTicks(adjustedYMin, adjustedYMax)
    
    const scales = {
      xMin: xMin - xPadding,
      xMax: xMax + xPadding,
      yMin: adjustedYMin,
      yMax: adjustedYMax,
      yTicks: yTicks
    }
    
    return scales
  }, [graphData, generateNiceTicks])

  // Convert data point to SVG coordinates
  const toSVGCoords = useCallback((x, y, width, height) => {
    const { xMin, xMax, yMin, yMax } = axisScales
    
    // Validate inputs
    if (isNaN(x) || isNaN(y) || isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) {
      return { x: 0, y: height }
    }
    
    // Avoid division by zero
    const xRange = xMax - xMin
    const yRange = yMax - yMin
    
    if (xRange === 0 || yRange === 0) {
      return { x: width / 2, y: height / 2 }
    }
    
    const svgX = ((x - xMin) / xRange) * width
    const svgY = height - ((y - yMin) / yRange) * height
    
    // Validate output
    if (isNaN(svgX) || isNaN(svgY)) {
      return { x: 0, y: height }
    }
    
    return { x: svgX, y: svgY }
  }, [axisScales])

  // Generate SVG path for line
  const generateLinePath = useCallback((data, width, height) => {
    if (data.length === 0) return ''
    
    const points = data.map(point => {
      const coords = toSVGCoords(point.x, point.y, width, height)
      
      // Skip invalid coordinates
      if (isNaN(coords.x) || isNaN(coords.y)) {
        return null
      }
      
      return `${coords.x},${coords.y}`
    }).filter(Boolean)
    
    if (points.length === 0) return ''
    
    return `M ${points.join(' L ')}`
  }, [toSVGCoords])

  // Generate SVG path for area fill
  const generateAreaPath = useCallback((data, width, height) => {
    if (data.length === 0) return ''
    
    const linePath = generateLinePath(data, width, height)
    if (!linePath) return ''
    
    const { yMin, yMax } = axisScales
    
    // Validate axis scales
    if (isNaN(yMin) || isNaN(yMax) || yMax === yMin) {
      return linePath
    }
    
    // Use the actual bottom of the chart area (where the X-axis is)
    const bottomY = 180 // This should match the X-axis Y position
    
    // Create a proper area path that goes from the line to the bottom
    // Start from the first point, follow the line, then close to bottom
    const firstPoint = data[0]
    if (!firstPoint) return ''
    
    const firstCoords = toSVGCoords(firstPoint.x, firstPoint.y, width, height)
    const lastPoint = data[data.length - 1]
    const lastCoords = toSVGCoords(lastPoint.x, lastPoint.y, width, height)
    
    return `M ${firstCoords.x},${bottomY} ${linePath} L ${lastCoords.x},${bottomY} Z`
  }, [generateLinePath, axisScales, toSVGCoords])

  // Handle edit mode toggle
  const handleEditToggle = () => {
    setEditMode(!editMode)
    if (onEditToggle) {
      onEditToggle(!editMode)
    }
  }

  // Handle configuration save
  const handleSaveConfig = () => {
    if (onConfigChange) {
      onConfigChange(config)
    }
    setEditMode(false)
  }

  // Handle configuration cancel
  const handleCancelConfig = () => {
    setConfig({ title, xAxisRange, yAxisRange })
    setEditMode(false)
  }

  // Update config when props change
  useEffect(() => {
    setConfig({ title, xAxisRange, yAxisRange })
  }, [title, xAxisRange, yAxisRange])

  if (editMode) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden p-3 shadow-sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Title (Cell Ref)
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
              onKeyDown={(e) => {
                // Allow all normal keyboard input including backspace
                e.stopPropagation()
              }}
              placeholder="e.g., A1"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              X-Axis Range
            </label>
            <input
              type="text"
              value={config.xAxisRange}
              onChange={(e) => setConfig(prev => ({ ...prev, xAxisRange: e.target.value }))}
              onKeyDown={(e) => {
                // Allow all normal keyboard input including backspace
                e.stopPropagation()
              }}
              placeholder="e.g., A1:A10"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Y-Axis Range
            </label>
            <input
              type="text"
              value={config.yAxisRange}
              onChange={(e) => setConfig(prev => ({ ...prev, yAxisRange: e.target.value }))}
              onKeyDown={(e) => {
                // Allow all normal keyboard input including backspace
                e.stopPropagation()
              }}
              placeholder="e.g., B1:B10"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          
          {/* Buttons */}
          <div className="flex space-x-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleSaveConfig}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-md text-xs hover:bg-primary-700 flex-1 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancelConfig}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs hover:bg-gray-200 flex-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
      {/* Header - Menu button and Add Graph button */}
      <div className="flex flex-col items-end p-1 space-y-1">
        {/* Menu button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-50 transition-colors"
            title="Graph options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowMenu(false)
                    handleEditToggle()
                  }}
                  className="flex items-center w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Edit className="w-3 h-3 mr-2" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    if (onDelete) {
                      onDelete()
                    }
                  }}
                  className="flex items-center w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Add Graph button */}
        <button
          onClick={() => {
            if (onAddGraph) {
              onAddGraph()
            }
          }}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-50 transition-colors"
          title="Add Graph"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      {/* Graph Title - Above Graph */}
      <div className="px-2 py-1">
        <div className="bg-white px-2 py-1 rounded-md shadow-sm border border-gray-200 inline-block">
          <span className="text-sm font-medium text-gray-700">
            {config.title ? parseCellReference(config.title) : 'Graph'}
          </span>
        </div>
      </div>
      
      {/* Graph Content */}
      <div className="w-full h-48 relative">
        
        {graphData.length > 0 ? (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 200"
            className="rounded-md"
            preserveAspectRatio="xMidYMid meet"
          >
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f8fafc" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              
              {/* Line */}
              <path
                d={generateLinePath(graphData, 800, 200)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Data points */}
              {graphData.map((point, index) => {
                const coords = toSVGCoords(point.x, point.y, 800, 200)
                
                // Skip rendering if coordinates are invalid
                if (isNaN(coords.x) || isNaN(coords.y)) {
                  return null
                }
                
                return (
                  <circle
                    key={index}
                    cx={coords.x}
                    cy={coords.y}
                    r="3"
                    fill="#3b82f6"
                  />
                )
              }).filter(Boolean)}
              
              {/* X-axis line */}
              <line x1="20" y1="180" x2="780" y2="180" stroke="#374151" strokeWidth="1"/>
              
              {/* Y-axis line */}
              <line x1="20" y1="20" x2="20" y2="180" stroke="#374151" strokeWidth="1"/>
              
              {/* Zero baseline (if Y-axis includes 0) */}
              {(() => {
                const { yMin, yMax } = axisScales
                if (yMin <= 0 && yMax >= 0) {
                  const zeroYPos = 180 - ((0 - yMin) / (yMax - yMin)) * 160
                  return (
                    <line 
                      x1="20" 
                      y1={zeroYPos} 
                      x2="780" 
                      y2={zeroYPos} 
                      stroke="#e5e7eb" 
                      strokeWidth="1" 
                      strokeDasharray="2,2"
                    />
                  )
                }
                return null
              })()}
              
              {/* X-axis labels and ticks */}
              {(() => {
                const tickCount = Math.min(xAxisLabels.length, graphData.length)
                const ticks = []
                
                for (let i = 0; i < tickCount; i++) {
                  const xPos = 20 + (760 * i / (tickCount - 1))
                  const label = xAxisLabels[i] || `Point ${i + 1}`
                  
                  // Add tick mark
                  ticks.push(
                    <line
                      key={`x-tick-${i}`}
                      x1={xPos}
                      y1="180"
                      x2={xPos}
                      y2="185"
                      stroke="#9ca3af"
                      strokeWidth="0.5"
                    />
                  )
                  
                  // Add label with actual cell value
                  ticks.push(
                    <text
                      key={`x-label-${i}`}
                      x={xPos}
                      y="195"
                      textAnchor="middle"
                      fontSize="10"
                      fill="#6b7280"
                    >
                      {label}
                    </text>
                  )
                }
                
                return ticks
              })()}
              
              {/* Y-axis labels and ticks */}
              {(() => {
                const { yMin, yMax, yTicks } = axisScales
                const ticks = []
                
                yTicks.forEach((yValue, i) => {
                  // Calculate Y position on the chart
                  const yPos = 180 - ((yValue - yMin) / (yMax - yMin)) * 160
                  
                  // Skip if position is outside chart bounds
                  if (yPos < 20 || yPos > 180) return
                  
                  // Add tick mark
                  ticks.push(
                    <line
                      key={`y-tick-${i}`}
                      x1="20"
                      y1={yPos}
                      x2="15"
                      y2={yPos}
                      stroke="#9ca3af"
                      strokeWidth="0.5"
                    />
                  )
                  
                  // Add label with appropriate formatting
                  const formattedValue = yValue % 1 === 0 ? yValue.toString() : yValue.toFixed(1)
                  ticks.push(
                    <text
                      key={`y-label-${i}`}
                      x="10"
                      y={yPos + 3}
                      textAnchor="end"
                      fontSize="10"
                      fill="#6b7280"
                    >
                      {formattedValue}
                    </text>
                  )
                })
                
                return ticks
              })()}
              
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-2xl mb-1">📊</div>
              <p className="text-xs">No data to display</p>
              <p className="text-xs text-gray-300">Configure the graph to see data</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

Graph.propTypes = {
  data: PropTypes.array,
  title: PropTypes.string,
  xAxisRange: PropTypes.string,
  yAxisRange: PropTypes.string,
  onConfigChange: PropTypes.func,
  isEditing: PropTypes.bool,
  onEditToggle: PropTypes.func,
  onDelete: PropTypes.func,
  onAddGraph: PropTypes.func,
  spreadsheetData: PropTypes.array,
  allSheetsData: PropTypes.object,
  currentSheetName: PropTypes.string
}

export default Graph
