import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import * as XLSX from 'xlsx'

const ReactSpreadsheet = ({ data, allSheetsData = {}, currentSheetName = 'Sheet1', onDataChange, formulaDisplayMode, selectedCells = [], onSelectedCellsChange, highlightedBlock = null, dependencyFrames = null }) => {
  const [selectedCell, setSelectedCell] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [visibleRange, setVisibleRange] = useState({ startRow: 0, endRow: 50, startCol: 0, endCol: 10 })
  const [autocompleteVisible, setAutocompleteVisible] = useState(false)
  const [autocompleteOptions, setAutocompleteOptions] = useState([])
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const [isFormulaEditing, setIsFormulaEditing] = useState(false)
  const [columnWidths, setColumnWidths] = useState({})
  const [referencedCells, setReferencedCells] = useState([])
  const [referencedCellColors, setReferencedCellColors] = useState({})
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [inputValue, setInputValue] = useState('') // Local state for input value during editing
  const containerRef = useRef(null)
  const scrollTimeoutRef = useRef(null)
  const rafRef = useRef(null)
  const scrollDebounceRef = useRef(null)
  
  // Formula cache to store calculated results
  const formulaCacheRef = useRef(new Map())
  const formulaDependenciesRef = useRef(new Map()) // Maps cell to its dependencies
  const cellDependentsRef = useRef(new Map()) // Maps cell to cells that depend on it
  const lastDataHashRef = useRef('')
  const recalculationQueueRef = useRef(new Set()) // Cells that need recalculation

  // Removed console.log to prevent excessive re-renders during scrolling

  // Generate a simple hash of the data to detect changes
  const generateDataHash = useCallback((data) => {
    if (!data || data.length === 0) return ''
    return JSON.stringify(data.map(row => 
      row.map(cell => ({
        value: cell?.value || '',
        decimalPlaces: cell?.decimalPlaces,
        isCurrency: cell?.isCurrency,
        isPercentage: cell?.isPercentage,
        currencySymbol: cell?.currencySymbol,
        isFormula: cell?.isFormula,
        cellType: cell?.cellType,
        rawValue: cell?.rawValue
      }))
    ))
  }, [])

  // Clear formula cache when data changes
  const clearFormulaCache = useCallback(() => {
    formulaCacheRef.current.clear()
    formulaDependenciesRef.current.clear()
    cellDependentsRef.current.clear()
    recalculationQueueRef.current.clear()
  }, [])

  // Track dependencies for a cell
  const trackDependencies = useCallback((cellKey, dependencies) => {
    // Clear old dependencies for this cell
    const oldDependencies = formulaDependenciesRef.current.get(cellKey) || []
    oldDependencies.forEach(dep => {
      const dependents = cellDependentsRef.current.get(dep) || new Set()
      dependents.delete(cellKey)
      if (dependents.size === 0) {
        cellDependentsRef.current.delete(dep)
      } else {
        cellDependentsRef.current.set(dep, dependents)
      }
    })

    // Set new dependencies
    formulaDependenciesRef.current.set(cellKey, dependencies)
    
    // Update dependents for each dependency
    dependencies.forEach(dep => {
      if (!cellDependentsRef.current.has(dep)) {
        cellDependentsRef.current.set(dep, new Set())
      }
      cellDependentsRef.current.get(dep).add(cellKey)
    })
  }, [])

  // Get all cells that depend on a given cell (recursive)
  const getDependentCells = useCallback((cellKey) => {
    const visited = new Set()
    const dependents = new Set()
    
    const collectDependents = (key) => {
      if (visited.has(key)) return
      visited.add(key)
      
      const directDependents = cellDependentsRef.current.get(key) || new Set()
      directDependents.forEach(dep => {
        dependents.add(dep)
        collectDependents(dep)
      })
    }
    
    collectDependents(cellKey)
    return Array.from(dependents)
  }, [])

  // Trigger recalculation for a cell and its dependents
  const triggerRecalculation = useCallback((changedCellKey) => {
    // Add the changed cell and all its dependents to recalculation queue
    const cellsToRecalc = [changedCellKey, ...getDependentCells(changedCellKey)]
    
    
    cellsToRecalc.forEach(cellKey => {
      recalculationQueueRef.current.add(cellKey)
    })
    
    // Clear cache for cells that need recalculation
    cellsToRecalc.forEach(cellKey => {
      // Clear all cache entries for this cell
      for (const [cacheKey] of formulaCacheRef.current.entries()) {
        if (cacheKey.startsWith(cellKey + '-')) {
          formulaCacheRef.current.delete(cacheKey)
        }
      }
    })
  }, [getDependentCells])

  // Process recalculation queue
  const processRecalculationQueue = useCallback(() => {
    if (recalculationQueueRef.current.size === 0) return
    
    const cellsToRecalc = Array.from(recalculationQueueRef.current)
    
    // Force multiple re-renders to ensure the component updates
    setRecalcTrigger(prev => prev + 1)
    setForceUpdate(prev => prev + 1)
    
    // Force a data change to trigger parent re-render
    if (onDataChange) {
      const newData = [...data]
      onDataChange(newData)
    }
    
    // Clear the queue after triggering re-renders
    setTimeout(() => {
      recalculationQueueRef.current.clear()
      setRecalcTrigger(prev => prev + 1)
      setForceUpdate(prev => prev + 1)
    }, 50) // Give time for formulas to be evaluated
  }, [data, onDataChange])

  // Add a state to force re-renders for recalculation
  const [recalcTrigger, setRecalcTrigger] = useState(0)
  const [forceUpdate, setForceUpdate] = useState(0)

  // Extract cell references from formula - moved up to avoid hoisting issues
  const extractCellReferences = useCallback((formula) => {
    const stringFormula = String(formula || '')
    if (!stringFormula.startsWith('=')) return []
    
    const expression = stringFormula.slice(1)
    const references = []
    
    // First, handle ranges (e.g., A1:B3, $A$1:$B$3)
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
    
    // Then, handle individual cell references (e.g., A1, $A$1)
    // But exclude those that are already part of ranges
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

  // Check if data has changed and clear cache if needed
  useEffect(() => {
    const currentHash = generateDataHash(data)
    if (currentHash !== lastDataHashRef.current) {
      clearFormulaCache()
      lastDataHashRef.current = currentHash
      
      // Track changed cells for recalculation
      const changedCells = new Set()
      
      // Establish dependencies for all formulas in the data
      data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell?.value && String(cell.value).startsWith('=')) {
            // Establish dependencies for this formula cell
            const cellKey = `${rowIndex}-${colIndex}`
            const references = extractCellReferences(cell.value)
            const dependencyKeys = references.map(ref => `${ref.row}-${ref.col}`)
            trackDependencies(cellKey, dependencyKeys)
            
            // Add this formula cell to recalculation queue
            changedCells.add(cellKey)
          }
        })
      })
      
      // Trigger recalculation for all formula cells
      if (changedCells.size > 0) {
        changedCells.forEach(cellKey => {
          triggerRecalculation(cellKey)
        })
        // Process the recalculation queue
        processRecalculationQueue()
        
        // Force a re-render to ensure all dependent cells are updated
        setRecalcTrigger(prev => prev + 1)
        setForceUpdate(prev => prev + 1)
      }
    }
  }, [data, generateDataHash, clearFormulaCache, extractCellReferences, trackDependencies, triggerRecalculation, processRecalculationQueue])

  // Available formulas for autocomplete
  const availableFormulas = useMemo(() => [
    // Math & Statistical Functions
    { name: 'SUM', description: 'Adds all numbers in a range', example: 'SUM(A1:A10)' },
    { name: 'AVERAGE', description: 'Returns the average of numbers', example: 'AVERAGE(A1:A10)' },
    { name: 'COUNT', description: 'Counts numbers in a range', example: 'COUNT(A1:A10)' },
    { name: 'MAX', description: 'Returns the largest number', example: 'MAX(A1:A10)' },
    { name: 'MIN', description: 'Returns the smallest number', example: 'MIN(A1:A10)' },
    { name: 'ABS', description: 'Returns the absolute value', example: 'ABS(-5)' },
    { name: 'SQRT', description: 'Returns the square root', example: 'SQRT(16)' },
    { name: 'POWER', description: 'Returns a number raised to a power', example: 'POWER(2,3)' },
    { name: 'ROUND', description: 'Rounds a number to specified digits', example: 'ROUND(3.14159,2)' },
    { name: 'ROUNDUP', description: 'Rounds a number up to specified digits', example: 'ROUNDUP(3.14159,2)' },
    { name: 'ROUNDDOWN', description: 'Rounds a number down to specified digits', example: 'ROUNDDOWN(3.14159,2)' },
    
    // Logical Functions
    { name: 'IF', description: 'Returns one value if true, another if false', example: 'IF(A1>0,"Positive","Negative")' },
    { name: 'ISNUMBER', description: 'Returns TRUE if value is a number', example: 'ISNUMBER(A1)' },
    { name: 'ISTEXT', description: 'Returns TRUE if value is text', example: 'ISTEXT(A1)' },
    { name: 'ISBLANK', description: 'Returns TRUE if cell is empty', example: 'ISBLANK(A1)' },
    
    // Date & Time Functions
    { name: 'TODAY', description: 'Returns current date', example: 'TODAY()' },
    { name: 'NOW', description: 'Returns current date and time', example: 'NOW()' },
    { name: 'DATE', description: 'Creates a date from year, month, day', example: 'DATE(2024,1,15)' },
    { name: 'YEAR', description: 'Returns the year from a date', example: 'YEAR(A1)' },
    { name: 'MONTH', description: 'Returns the month from a date', example: 'MONTH(A1)' },
    { name: 'DAY', description: 'Returns the day from a date', example: 'DAY(A1)' },
    { name: 'EOMONTH', description: 'Returns last day of month after adding months', example: 'EOMONTH(A1,1)' },
    { name: 'EDATE', description: 'Returns same day in month after adding months', example: 'EDATE(A1,1)' },
    
    // Text Functions
    { name: 'CONCATENATE', description: 'Joins text together', example: 'CONCATENATE(A1,B1)' },
    { name: 'LEN', description: 'Returns the length of text', example: 'LEN(A1)' },
    { name: 'UPPER', description: 'Converts text to uppercase', example: 'UPPER(A1)' },
    { name: 'LOWER', description: 'Converts text to lowercase', example: 'LOWER(A1)' },
    { name: 'LEFT', description: 'Returns leftmost characters', example: 'LEFT(A1,3)' },
    { name: 'RIGHT', description: 'Returns rightmost characters', example: 'RIGHT(A1,3)' },
    { name: 'MID', description: 'Returns characters from middle', example: 'MID(A1,2,3)' },
    { name: 'FIND', description: 'Finds position of text within text', example: 'FIND("a",A1)' }
  ], [])

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        const input = document.querySelector('.editing-input')
        if (input) {
          input.focus()
          // Always position cursor at end when starting to edit
          const length = input.value.length
          input.setSelectionRange(length, length)
        }
      }, 0)
    }
  }, [editingCell])

  // Cleanup timeout and animation frame on unmount
  useEffect(() => {
    const scrollTimeout = scrollTimeoutRef.current
    const raf = rafRef.current
    const scrollDebounce = scrollDebounceRef.current
    
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      if (raf) {
        cancelAnimationFrame(raf)
      }
      if (scrollDebounce) {
        clearTimeout(scrollDebounce)
      }
    }
  }, [])


  // Virtualization: only render visible cells without artificial limits
  const visibleData = useMemo(() => {
    if (!data || data.length === 0) return []

    // No artificial limits - let it load all available data
    const startRow = Math.max(0, visibleRange.startRow)
    const endRow = Math.min(visibleRange.endRow, data.length)
    const startCol = Math.max(0, visibleRange.startCol)
    const endCol = Math.min(visibleRange.endCol, data[0]?.length || 0)

    return data.slice(startRow, endRow).map(row =>
      row.slice(startCol, endCol)
    )
  }, [data, visibleRange])

  // Handle scroll to update visible range with improved debouncing
  const handleScroll = useCallback((e) => {
    // Clear previous debounce timeout
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current)
    }
    
    // Use requestAnimationFrame for smoother scrolling
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    
    rafRef.current = requestAnimationFrame(() => {
      // Debounce scroll events to prevent excessive updates
      scrollDebounceRef.current = setTimeout(() => {
        const container = e.target
        const scrollTop = container.scrollTop
        const scrollLeft = container.scrollLeft
        
        const rowHeight = 32 // height of each row
        const avgColWidth = 120 // average width of columns
        
        // Larger buffer to ensure we load enough data
        const buffer = 100 // Increased buffer for smoother scrolling
        
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer)
        const endRow = Math.min(startRow + Math.ceil(container.clientHeight / rowHeight) + buffer, data.length)
        
        // Simplified column calculation using average width
        const startCol = Math.max(0, Math.floor(scrollLeft / avgColWidth) - buffer)
        const endCol = Math.min(startCol + Math.ceil(container.clientWidth / avgColWidth) + buffer, data[0]?.length || 0)
        
        // Only update if the range has changed significantly to prevent flickering
        setVisibleRange(prevRange => {
          // Increased thresholds to reduce update frequency
          if (Math.abs(prevRange.startRow - startRow) > 10 || 
              Math.abs(prevRange.endRow - endRow) > 10 ||
              Math.abs(prevRange.startCol - startCol) > 5 || 
              Math.abs(prevRange.endCol - endCol) > 5) {
            return { startRow, endRow, startCol, endCol }
          }
          return prevRange
        })
      }, 16) // Increased debounce time for more stable scrolling
    })
  }, [data])

  // Helper function to get column letter from index
  const getColumnLetter = useCallback((index) => {
    let result = ''
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result
      index = Math.floor(index / 26) - 1
    }
    return result
  }, [])

  // Handle column resize
  const handleColumnResize = useCallback((colIndex, newWidth) => {
    setColumnWidths(prev => ({
      ...prev,
      [colIndex]: Math.max(60, newWidth) // Minimum width of 60px, no maximum
    }))
  }, [])

  // Generate random border color for referenced cells
  const generateRandomColor = useCallback(() => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }, [])


  // Helper function to get column index from column letter
  const getColumnIndex = useCallback((colLetter) => {
    let result = 0
    for (let i = 0; i < colLetter.length; i++) {
      result = result * 26 + (colLetter.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
    }
    return result - 1
  }, [])

  // Helper function to check if a cell is in the highlighted block
  const isInHighlightedBlock = useCallback((row, col) => {
    if (!highlightedBlock) return false
    
    // Parse the range (e.g., "A1:D3")
    const rangeMatch = highlightedBlock.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
    if (!rangeMatch) return false
    
    const [, startCol, startRow, endCol, endRow] = rangeMatch
    const startColNum = getColumnIndex(startCol)
    const endColNum = getColumnIndex(endCol)
    const startRowNum = parseInt(startRow) - 1
    const endRowNum = parseInt(endRow) - 1
    
    return row >= startRowNum && row <= endRowNum && col >= startColNum && col <= endColNum
  }, [highlightedBlock, getColumnIndex])

  // Helper function to get dependency frame color for a cell
  const getDependencyFrameColor = useCallback((row, col) => {
    if (!dependencyFrames || dependencyFrames.length === 0) return null
    
    const cellAddr = getColumnLetter(col) + (row + 1)
    
    for (const frame of dependencyFrames) {
      const range = frame.range
      
      // Handle single cell (e.g., "A1")
      if (range.match(/^[A-Z]+\d+$/)) {
        if (range === cellAddr) {
          return frame.color
        }
      }
      // Handle range (e.g., "A1:C3")
      else if (range.includes(':')) {
        const rangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
        if (rangeMatch) {
          const [, startCol, startRow, endCol, endRow] = rangeMatch
          const startColNum = getColumnIndex(startCol)
          const endColNum = getColumnIndex(endCol)
          const startRowNum = parseInt(startRow) - 1
          const endRowNum = parseInt(endRow) - 1
          
          if (row >= startRowNum && row <= endRowNum && col >= startColNum && col <= endColNum) {
            return frame.color
          }
        }
      }
    }
    
    return null
  }, [dependencyFrames, getColumnLetter, getColumnIndex])


  // Handle autocomplete
  const handleAutocomplete = useCallback((value) => {
    const stringValue = String(value || '')
    if (stringValue.startsWith('=')) {
      const afterEquals = stringValue.slice(1).toUpperCase()
      const matches = availableFormulas.filter(formula => 
        formula.name.startsWith(afterEquals)
      )
      if (matches.length > 0) {
        setAutocompleteOptions(matches)
        setAutocompleteVisible(true)
        setAutocompleteIndex(0)
      } else {
        setAutocompleteVisible(false)
      }
    } else {
      setAutocompleteVisible(false)
    }
  }, [availableFormulas])

  // Handle cell value change (without triggering recalculation during typing)
  const handleCellChange = useCallback((rowIndex, colIndex, value, shouldRecalculate = false) => {
    if (onDataChange) {
      const cellKey = `${rowIndex}-${colIndex}`
      const oldValue = data[rowIndex]?.[colIndex]?.value
      const newValue = value
      
      
      // Check if the value actually changed
      const valueChanged = oldValue !== newValue
      
      const newData = [...data]
      if (!newData[rowIndex]) newData[rowIndex] = []
      if (!newData[rowIndex][colIndex]) newData[rowIndex][colIndex] = { value: '', className: '' }
      
      // Determine if this is a formula
      const stringValue = String(value || '')
      const isFormula = stringValue.startsWith('=')
      
      // Update cell with proper type and rawValue
      newData[rowIndex][colIndex] = { 
        ...newData[rowIndex][colIndex], 
        value,
        cellType: isFormula ? 'formula' : 'text',
        rawValue: isFormula ? value : undefined // For formulas, rawValue should be the formula string
      }
      onDataChange(newData)

      // Check if we're editing a formula
      setIsFormulaEditing(stringValue.startsWith('='))

      // Update referenced cells for highlighting (only during typing, not for recalculation)
      if (stringValue.startsWith('=')) {
        const references = extractCellReferences(stringValue)
        setReferencedCells(references)
        
        // Track dependencies for this formula cell
        const dependencyKeys = references.map(ref => `${ref.row}-${ref.col}`)
        trackDependencies(cellKey, dependencyKeys)
        
        // Assign the same color to all referenced cells in this formula
        const newColors = {}
        const rangeColor = generateRandomColor()
        references.forEach(ref => {
          const key = `${ref.row}-${ref.col}`
          newColors[key] = rangeColor
        })
        setReferencedCellColors(prev => ({ ...prev, ...newColors }))
      } else {
        setReferencedCells([])
        setReferencedCellColors({})
        
        // Clear dependencies for non-formula cells
        trackDependencies(cellKey, [])
      }

      // Only trigger recalculation if explicitly requested (e.g., on Enter key)
      if (shouldRecalculate && valueChanged) {
        triggerRecalculation(cellKey)
        // Process recalculation queue immediately
        processRecalculationQueue()
        
        // Force a re-render to ensure all dependent cells are updated
        setRecalcTrigger(prev => prev + 1)
        setForceUpdate(prev => prev + 1)
      } else {
      }

      // Trigger autocomplete
      handleAutocomplete(value)
    }
  }, [data, onDataChange, handleAutocomplete, extractCellReferences, generateRandomColor, trackDependencies, triggerRecalculation, processRecalculationQueue])

  // Handle mouse down for drag selection
  const handleMouseDown = useCallback((rowIndex, colIndex, event) => {
    if (event.button !== 0) return // Only handle left mouse button
    
    // If we're currently editing a formula, insert the cell reference
    if (isFormulaEditing && editingCell) {
      const cellRef = getColumnLetter(colIndex) + (rowIndex + 1)
      const newValue = inputValue + cellRef

      // Update the input value with the cell reference
      setInputValue(newValue)

      // Keep the same cell in editing mode
      setSelectedCell({ row: editingCell.row, col: editingCell.col })
      return
    }
    
    // Start drag selection
    setIsDragging(true)
    setDragStart({ row: rowIndex, col: colIndex })
    setDragEnd({ row: rowIndex, col: colIndex })
    
    // Handle multi-selection with Ctrl/Cmd key
    if (event && (event.ctrlKey || event.metaKey)) {
      const cellKey = `${rowIndex}-${colIndex}`
      const isSelected = selectedCells.some(cell => `${cell.row}-${cell.col}` === cellKey)
      
      if (isSelected) {
        // Remove from selection
        const newSelection = selectedCells.filter(cell => `${cell.row}-${cell.col}` !== cellKey)
        onSelectedCellsChange?.(newSelection)
      } else {
        // Add to selection
        const newSelection = [...selectedCells, { row: rowIndex, col: colIndex }]
        onSelectedCellsChange?.(newSelection)
      }
    } else {
      // Single selection
      setSelectedCell({ row: rowIndex, col: colIndex })
      setEditingCell({ row: rowIndex, col: colIndex })
      setInputValue(String(data[rowIndex]?.[colIndex]?.value || ''))
      onSelectedCellsChange?.([{ row: rowIndex, col: colIndex }])
      
      // Check if the cell contains a formula and highlight referenced cells
      const cellValue = String(data[rowIndex]?.[colIndex]?.value || '')
      if (cellValue.startsWith('=')) {
        const references = extractCellReferences(cellValue)
        setReferencedCells(references)
        
        // Assign the same color to all referenced cells in this formula
        const newColors = {}
        const rangeColor = generateRandomColor()
        references.forEach(ref => {
          const key = `${ref.row}-${ref.col}`
          newColors[key] = rangeColor
        })
        setReferencedCellColors(prev => ({ ...prev, ...newColors }))
      } else {
        setReferencedCells([])
        setReferencedCellColors({})
      }
    }
  }, [isFormulaEditing, editingCell, data, getColumnLetter, selectedCells, onSelectedCellsChange, extractCellReferences, generateRandomColor, inputValue])

  // Handle mouse move for drag selection
  const handleMouseMove = useCallback((event) => {
    if (!isDragging || !dragStart) return
    
    const container = containerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left + container.scrollLeft
    const y = event.clientY - rect.top + container.scrollTop
    
    // Calculate which cell we're over
    const rowHeight = 32
    const avgColWidth = 120
    
    const rowIndex = Math.max(0, Math.floor(y / rowHeight) - 1) // -1 for header row
    const colIndex = Math.max(0, Math.floor(x / avgColWidth) - 1) // -1 for row number column
    
    // Clamp to data bounds
    const maxRow = Math.min(rowIndex, data.length - 1)
    const maxCol = Math.min(colIndex, (data[0]?.length || 0) - 1)
    
    setDragEnd({ row: maxRow, col: maxCol })
  }, [isDragging, dragStart, data])

  // Handle mouse up to finish drag selection
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
      return
    }
    
    // Create selection from drag area
    const startRow = Math.min(dragStart.row, dragEnd.row)
    const endRow = Math.max(dragStart.row, dragEnd.row)
    const startCol = Math.min(dragStart.col, dragEnd.col)
    const endCol = Math.max(dragStart.col, dragEnd.col)
    
    const newSelection = []
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        newSelection.push({ row, col })
      }
    }
    
    onSelectedCellsChange?.(newSelection)
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }, [isDragging, dragStart, dragEnd, onSelectedCellsChange])


  // Handle column header click to select entire column
  const handleColumnHeaderClick = useCallback((colIndex, event) => {
    event.stopPropagation()
    const newSelection = []
    for (let row = 0; row < data.length; row++) {
      newSelection.push({ row, col: colIndex })
    }
    onSelectedCellsChange?.(newSelection)
  }, [data, onSelectedCellsChange])

  // Handle row header click to select entire row
  const handleRowHeaderClick = useCallback((rowIndex, event) => {
    event.stopPropagation()
    const newSelection = []
    for (let col = 0; col < (data[0]?.length || 0); col++) {
      newSelection.push({ row: rowIndex, col })
    }
    onSelectedCellsChange?.(newSelection)
  }, [data, onSelectedCellsChange])

  // Add mouse event listeners and optimize scroll handling
  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleMouseMove(e)
    const handleGlobalMouseUp = () => handleMouseUp()

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Add optimized scroll event listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Use passive listener for better performance
    const optimizedScrollHandler = (e) => {
      e.preventDefault = () => {} // Prevent default to avoid conflicts
      handleScroll(e)
    }

    container.addEventListener('scroll', optimizedScrollHandler, { passive: true })

    return () => {
      container.removeEventListener('scroll', optimizedScrollHandler)
    }
  }, [handleScroll])

  // Helper function to parse function arguments (handles nested parentheses)
  const parseFunctionArgs = useCallback((argsString) => {
    const args = []
    let currentArg = ''
    let parenCount = 0
    
    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i]
      
      if (char === '(') {
        parenCount++
        currentArg += char
      } else if (char === ')') {
        parenCount--
        currentArg += char
      } else if (char === ',' && parenCount === 0) {
        args.push(currentArg.trim())
        currentArg = ''
      } else {
        currentArg += char
      }
    }
    
    if (currentArg.trim()) {
      args.push(currentArg.trim())
    }
    
    return args
  }, [])

  // Helper function to process percentage values in expressions
  const processPercentageValues = useCallback((expression) => {
    // Handle percentage values (e.g., 2% -> 0.02)
    return expression.replace(/(\d+(?:\.\d+)?)%/g, (match, number) => {
      return (parseFloat(number) / 100).toString()
    })
  }, [])

  // Enhanced formula evaluator with Excel functions and caching
  const evaluateFormula = useCallback((formula, rowIndex, colIndex, visitedCells = new Set()) => {
    const stringFormula = String(formula || '')
    if (!stringFormula.startsWith('=')) return stringFormula
    
    const cellKey = `${rowIndex}-${colIndex}`
    
    
    // Check if this cell is in the recalculation queue
    const shouldRecalculate = recalculationQueueRef.current.has(cellKey)
    
    // Check cache first, but skip cache if cell needs recalculation
    const cacheKey = `${rowIndex}-${colIndex}-${stringFormula}`
    if (!shouldRecalculate && formulaCacheRef.current.has(cacheKey)) {
      return formulaCacheRef.current.get(cacheKey)
    }
    
    try {
      const expression = stringFormula.slice(1)
      
      // Enhanced number parsing that handles currency/locale formatted values robustly
      const parseNumericValue = (value) => {
        if (value === null || value === undefined) return 0
        if (typeof value === 'number') return value
        let stringVal = String(value).trim()

        // Normalize NBSP and spaces
        stringVal = stringVal.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim()

        // Handle empty strings
        if (stringVal === '') return 0

        // Handle percentage values (e.g., "2%" -> 0.02)
        const isPercent = stringVal.endsWith('%')
        if (isPercent) {
          stringVal = stringVal.slice(0, -1)
        }

        // Handle negative values
        const isNegative = stringVal.startsWith('-')
        if (isNegative) {
          stringVal = stringVal.slice(1)
        }

        // Remove currency symbols and thousands separators
        stringVal = stringVal.replace(/[$€£¥₹]/g, '').replace(/,/g, '')

        // Try to parse as number
        const parsed = parseFloat(stringVal)
        if (isNaN(parsed)) return 0
        let result = parsed
        if (isNegative) result = -result
        if (isPercent) result = result / 100
        return result
      }
      
      // Helper function to get cell value (recursively evaluates formulas)
      // Now supports inter-sheet references like 'Sheet2'!A1
      const getCellValue = (cellRef, visitedCells = new Set(), targetSheet = currentSheetName) => {
        // Handle inter-sheet references like 'Sheet2'!A1 or Sheet2!A1
        const quotedSheetMatch = cellRef.match(/^'([^']+)'!(.+)$/)
        const unquotedSheetMatch = cellRef.match(/^([A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]|[A-Za-z])!(.+)$/)
        
        if (quotedSheetMatch) {
          const [, sheetName, cellAddress] = quotedSheetMatch
          return getCellValue(cellAddress, visitedCells, sheetName)
        } else if (unquotedSheetMatch) {
          const [, sheetName, cellAddress] = unquotedSheetMatch
          return getCellValue(cellAddress, visitedCells, sheetName)
        }
        
        // Remove $ symbols from absolute references (e.g., $E$7 -> E7)
        const cleanRef = cellRef.replace(/\$/g, '')
        const cellRefRegex = /([A-Z]+)(\d+)/
        const match = cleanRef.match(cellRefRegex)
        if (!match) return 0
        
        const [, col, row] = match
        const colIndex = col.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
        const rowIndex = parseInt(row) - 1
        
        // Prevent circular references
        const referencedCellKey = `${targetSheet}-${rowIndex}-${colIndex}`
        if (visitedCells.has(referencedCellKey)) {
          return 0 // Return 0 for circular references
        }
        
        // Track this dependency
        if (!visitedCells.has(referencedCellKey)) {
          // Add to current cell's dependencies
          const currentDependencies = formulaDependenciesRef.current.get(cellKey) || []
          if (!currentDependencies.includes(referencedCellKey)) {
            currentDependencies.push(referencedCellKey)
            formulaDependenciesRef.current.set(cellKey, currentDependencies)
            
            // Update dependents for the referenced cell
            if (!cellDependentsRef.current.has(referencedCellKey)) {
              cellDependentsRef.current.set(referencedCellKey, new Set())
            }
            cellDependentsRef.current.get(referencedCellKey).add(cellKey)
          }
        }
        
        // Get cell data from the appropriate sheet
        let cell = null
        if (targetSheet === currentSheetName) {
          // Current sheet - use the main data
          cell = data[rowIndex]?.[colIndex]
        } else {
          // Other sheet - get from allSheetsData
          const sheetData = allSheetsData[targetSheet]
          if (sheetData && sheetData.spreadsheetData) {
            cell = sheetData.spreadsheetData[rowIndex]?.[colIndex]
          }
        }
        
        // If cell doesn't exist, return 0
        if (!cell) {
          return 0
        }
        
        // SIMPLIFIED: Only 3 cases to handle
        
        // CASE 1: FORMULA - Return the calculated result
        if (cell.value && String(cell.value).startsWith('=')) {
          visitedCells.add(referencedCellKey)
          const result = evaluateFormula(cell.value, rowIndex, colIndex, visitedCells)
          visitedCells.delete(referencedCellKey)
          const finalResult = parseFloat(result) || 0
          return finalResult
        }
        
        // CASE 2: RAW VALUE - Use the numeric value for calculations
        if (cell.rawValue !== undefined && cell.rawValue !== null) {
          return parseFloat(cell.rawValue) || 0
        }
        
        // CASE 3: DISPLAY VALUE - Extract numeric value from formatted string
        if (cell.value) {
          return parseNumericValue(cell.value)
        }
        
        return 0
      }
      
      // Helper function to parse range (e.g., A1:A10 or $A$1:$A$10)
      // Now supports inter-sheet references like 'Sheet2'!A1:B10
      const parseRange = (range, targetSheet = currentSheetName) => {
        
        // Handle inter-sheet references like 'Sheet2'!A1:B10
        const interSheetMatch = range.match(/^'([^']+)'!(.+)$/)
        if (interSheetMatch) {
          const [, sheetName, cellRange] = interSheetMatch
          return parseRange(cellRange, sheetName)
        }
        
        const [start, end] = range.split(':')
        // Remove $ symbols from absolute references
        const cleanStart = start.replace(/\$/g, '')
        const cleanEnd = end.replace(/\$/g, '')
        const startMatch = cleanStart.match(/([A-Z]+)(\d+)/)
        const endMatch = cleanEnd.match(/([A-Z]+)(\d+)/)
        
        if (!startMatch || !endMatch) return []
        
        const [, startCol, startRow] = startMatch
        const [, endCol, endRow] = endMatch
        
        const startColIndex = startCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
        const endColIndex = endCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
        const startRowIndex = parseInt(startRow) - 1
        const endRowIndex = parseInt(endRow) - 1
        
        // Get the appropriate data source
        let dataSource = data
        if (targetSheet !== currentSheetName) {
          const sheetData = allSheetsData[targetSheet]
          if (sheetData && sheetData.spreadsheetData) {
            dataSource = sheetData.spreadsheetData
          } else {
            return [] // Sheet not found
          }
        }
        
        const values = []
        for (let r = startRowIndex; r <= endRowIndex; r++) {
          for (let c = startColIndex; c <= endColIndex; c++) {
            // SIMPLIFIED: Use the same 3-case logic as getCellValue
            const cell = dataSource[r]?.[c]
            if (!cell) continue // Skip empty cells
            
            let numValue = 0
            
            // CASE 1: FORMULA - Return the calculated result
            if (cell.value && String(cell.value).startsWith('=')) {
              const cellKey = `${targetSheet}-${r}-${c}`
              if (!visitedCells.has(cellKey)) {
                visitedCells.add(cellKey)
                const result = evaluateFormula(cell.value, r, c, visitedCells)
                visitedCells.delete(cellKey)
                numValue = parseFloat(result) || 0
              }
            }
            // CASE 2: RAW VALUE - Use the numeric value for calculations
            else if (cell.rawValue !== undefined && cell.rawValue !== null) {
              numValue = parseFloat(cell.rawValue) || 0
            }
            // CASE 3: DISPLAY VALUE - Extract numeric value from formatted string
            else if (cell.value) {
              numValue = parseNumericValue(cell.value)
            }
            
            if (numValue !== 0 || cell.value === '0' || cell.value === 0) {
              values.push(numValue)
            }
          }
        }
        
        return values
      }
      
      // Handle basic arithmetic FIRST (before single function checks)
      if (expression.includes('+') || expression.includes('-') || expression.includes('*') || expression.includes('/')) {
        let processedExpression = expression
        
        // First, handle percentage values (e.g., 2% -> 0.02)
        processedExpression = processPercentageValues(processedExpression)
        
        // Handle SUM functions within arithmetic expressions
        const sumFunctionRegex = /SUM\([^)]+\)/g
        processedExpression = processedExpression.replace(sumFunctionRegex, (sumMatch) => {
          // Extract the range from SUM(range)
          const range = sumMatch.slice(4, -1)
          let sumResult = 0
          
          if (range.includes(':')) {
            const values = parseRange(range)
            sumResult = values.reduce((sum, val) => sum + val, 0)
          } else {
            // Single cell or comma-separated values
            const values = range.split(',').map(ref => getCellValue(ref.trim(), visitedCells))
            sumResult = values.reduce((sum, val) => sum + val, 0)
          }
          
          return sumResult
        })
        
        // Updated regex to handle absolute references with $ symbols
        // Handle both simple cell references (A1, $B$2) and inter-sheet references ('Sheet'!A1 or Sheet!A1)
        const cellRefRegex = /(?:'([^']+)'!|([A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]|[A-Za-z])!)?(\$?[A-Z]+\$?\d+)/g
        processedExpression = processedExpression.replace(cellRefRegex, (match, quotedSheetName, unquotedSheetName, cellRef) => {
          // If it's an inter-sheet reference (either quoted or unquoted), pass the full match to getCellValue
          if (quotedSheetName || unquotedSheetName) {
            const cellValue = getCellValue(match, visitedCells)
            return cellValue
          } else {
            // Simple cell reference
            const cellValue = getCellValue(cellRef, visitedCells)
            return cellValue
          }
        })
        
        const result = Function('"use strict"; return (' + processedExpression + ')')()
        const finalResult = isNaN(result) ? stringFormula : result
        
        // Cache the result
        formulaCacheRef.current.set(cacheKey, finalResult)
        return finalResult
      }
      
      // Handle SUM function - but only if it's the entire expression (not part of arithmetic)
      // Case-insensitive detection for sum, Sum, SUM, etc.
      if (/^sum\(/i.test(expression) && expression.endsWith(')') && !expression.includes('+') && !expression.includes('-') && !expression.includes('*') && !expression.includes('/')) {
        const range = expression.slice(4, -1)
        let result
        if (range.includes(':')) {
          const values = parseRange(range)
          result = values.reduce((sum, val) => sum + val, 0)
        } else {
          // Single cell or comma-separated values
          const values = range.split(',').map(ref => getCellValue(ref.trim(), visitedCells))
          result = values.reduce((sum, val) => sum + val, 0)
        }
        
        // Cache the result
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle AVERAGE function - case-insensitive
      if (/^average\(/i.test(expression) && expression.endsWith(')')) {
        const range = expression.slice(8, -1)
        let result
        if (range.includes(':')) {
          const values = parseRange(range)
          result = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
        } else {
          const values = range.split(',').map(ref => getCellValue(ref.trim(), visitedCells))
          result = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
        }
        // Cache the result
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle COUNT function - case-insensitive
      if (/^count\(/i.test(expression) && expression.endsWith(')')) {
        const range = expression.slice(6, -1)
        let result
        if (range.includes(':')) {
          const values = parseRange(range)
          result = values.length
        } else {
          const values = range.split(',').map(ref => getCellValue(ref.trim(), visitedCells))
          result = values.filter(val => val !== 0).length
        }
        // Cache the result
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle MAX function - case-insensitive
      if (/^max\(/i.test(expression) && expression.endsWith(')')) {
        const range = expression.slice(4, -1)
        let result
        if (range.includes(':')) {
          const values = parseRange(range)
          result = values.length > 0 ? Math.max(...values) : 0
        } else {
          const values = range.split(',').map(ref => getCellValue(ref.trim(), visitedCells))
          result = values.length > 0 ? Math.max(...values) : 0
        }
        // Cache the result
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle MIN function - case-insensitive
      if (/^min\(/i.test(expression) && expression.endsWith(')')) {
        const range = expression.slice(4, -1)
        let result
        if (range.includes(':')) {
          const values = parseRange(range)
          result = values.length > 0 ? Math.min(...values) : 0
        } else {
          const values = range.split(',').map(ref => getCellValue(ref.trim(), visitedCells))
          result = values.length > 0 ? Math.min(...values) : 0
        }
        // Cache the result
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle IF function - case-insensitive
      if (/^if\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(3, -1))
        if (args.length >= 2) {
          const condition = getCellValue(args[0], visitedCells)
          const trueValue = args[1]
          const falseValue = args[2] || false
          
          const result = condition ? getCellValue(trueValue, visitedCells) : getCellValue(falseValue, visitedCells)
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle EOMONTH function
      if (/^eomonth\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(8, -1))
        if (args.length >= 2) {
          const startDateValue = getCellValue(args[0], visitedCells)
          const months = parseFloat(getCellValue(args[1], visitedCells))
          
          if (!isNaN(months)) {
            let date
            
            // Handle different types of date inputs
            if (startDateValue instanceof Date) {
              // Direct Date object
              date = new Date(startDateValue)
            } else if (typeof startDateValue === 'string' && startDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Date string in YYYY-MM-DD format
              const [year, month, day] = startDateValue.split('-')
              date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            } else {
              // Try to parse as a number (Excel serial number)
              const numValue = parseFloat(startDateValue)
              if (!isNaN(numValue)) {
                // Convert Excel serial number to Date
                const excelEpoch = new Date(1900, 0, 1)
                date = new Date(excelEpoch.getTime() + (numValue - 1) * 24 * 60 * 60 * 1000)
              }
            }
            
            if (date && !isNaN(date.getTime())) {
              // Add the specified number of months, then set to the last day of that month
              // EOMONTH: Add months, then get the last day of that month
              const targetMonth = date.getMonth() + months
              date.setMonth(targetMonth + 1, 0) // Go to next month, then set day to 0 (last day of target month)
              
              const result = { type: 'date', value: date, serial: Math.floor(date.getTime() / (1000 * 60 * 60 * 24)) + 25569 }
              formulaCacheRef.current.set(cacheKey, result)
              return result
            }
          }
        }
      }
      
      // Handle EDATE function (same day in target month)
      if (/^edate\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(6, -1))
        if (args.length >= 2) {
          const startDateValue = getCellValue(args[0], visitedCells)
          const months = parseFloat(getCellValue(args[1], visitedCells))
          
          if (!isNaN(months)) {
            let date
            
            // Handle different types of date inputs
            if (startDateValue instanceof Date) {
              // Direct Date object
              date = new Date(startDateValue)
            } else if (typeof startDateValue === 'string' && startDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Date string in YYYY-MM-DD format
              const [year, month, day] = startDateValue.split('-')
              date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            } else {
              // Try to parse as a number (Excel serial number)
              const numValue = parseFloat(startDateValue)
              if (!isNaN(numValue)) {
                // Convert Excel serial number to Date
                const excelEpoch = new Date(1900, 0, 1)
                date = new Date(excelEpoch.getTime() + (numValue - 1) * 24 * 60 * 60 * 1000)
              }
            }
            
            if (date && !isNaN(date.getTime())) {
              // Add the specified number of months, keeping the same day
              date.setMonth(date.getMonth() + months)
              const result = { type: 'date', value: date, serial: Math.floor(date.getTime() / (1000 * 60 * 60 * 24)) + 25569 }
              formulaCacheRef.current.set(cacheKey, result)
              return result
            }
          }
        }
      }
      
      // Handle TODAY function
      if (expression === 'TODAY()') {
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Reset time to start of day
        const result = { type: 'date', value: today, serial: Math.floor(today.getTime() / (1000 * 60 * 60 * 24)) + 25569 }
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle NOW function
      if (expression === 'NOW()') {
        const now = new Date()
        const result = { type: 'datetime', value: now, serial: now.getTime() / (1000 * 60 * 60 * 24) + 25569 }
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle DATE function
      if (/^date\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(5, -1))
        if (args.length >= 3) {
          const year = parseInt(getCellValue(processPercentageValues(args[0]), visitedCells))
          const month = parseInt(getCellValue(processPercentageValues(args[1]), visitedCells))
          const day = parseInt(getCellValue(processPercentageValues(args[2]), visitedCells))
          
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const date = new Date(year, month - 1, day) // month is 0-indexed in JS
            const result = { type: 'date', value: date, serial: Math.floor(date.getTime() / (1000 * 60 * 60 * 24)) + 25569 }
            formulaCacheRef.current.set(cacheKey, result)
            return result
          }
        }
      }
      
      // Handle YEAR function
      if (/^year\(/i.test(expression) && expression.endsWith(')')) {
        const dateValue = getCellValue(expression.slice(5, -1), visitedCells)
        let date
        
        // Handle different types of date inputs
        if (dateValue instanceof Date) {
          // Direct Date object
          date = dateValue
        } else if (dateValue && typeof dateValue === 'object' && dateValue.type && dateValue.value) {
          // Date result from another formula
          date = dateValue.value
        } else if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Date string in YYYY-MM-DD format
          const [year, month, day] = dateValue.split('-')
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        } else {
          // Try to parse as Excel serial number
          const numValue = parseFloat(dateValue)
          if (!isNaN(numValue)) {
            // Use xlsx library to convert Excel serial number to date
            try {
              const dateString = XLSX.SSF.format('yyyy-mm-dd', numValue)
              if (dateString && dateString !== 'Invalid Date') {
                date = new Date(dateString)
              } else {
                // Fallback to manual calculation
                const excelEpoch = new Date(1900, 0, 1)
                const daysSinceEpoch = numValue - 1
                date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
              }
            } catch (error) {
              // Fallback to manual calculation
              const excelEpoch = new Date(1900, 0, 1)
              const daysSinceEpoch = numValue - 1
              date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
            }
          }
        }
        
        if (!isNaN(date.getTime())) {
          const result = date.getFullYear()
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle MONTH function
      if (/^month\(/i.test(expression) && expression.endsWith(')')) {
        const dateValue = getCellValue(expression.slice(6, -1), visitedCells)
        let date
        
        // Handle different types of date inputs
        if (dateValue instanceof Date) {
          // Direct Date object
          date = dateValue
        } else if (dateValue && typeof dateValue === 'object' && dateValue.type && dateValue.value) {
          // Date result from another formula
          date = dateValue.value
        } else if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Date string in YYYY-MM-DD format
          const [year, month, day] = dateValue.split('-')
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        } else {
          // Try to parse as Excel serial number
          const numValue = parseFloat(dateValue)
          if (!isNaN(numValue)) {
            // Use xlsx library to convert Excel serial number to date
            try {
              const dateString = XLSX.SSF.format('yyyy-mm-dd', numValue)
              if (dateString && dateString !== 'Invalid Date') {
                date = new Date(dateString)
              } else {
                // Fallback to manual calculation
                const excelEpoch = new Date(1900, 0, 1)
                const daysSinceEpoch = numValue - 1
                date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
              }
            } catch (error) {
              // Fallback to manual calculation
              const excelEpoch = new Date(1900, 0, 1)
              const daysSinceEpoch = numValue - 1
              date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
            }
          }
        }
        
        if (!isNaN(date.getTime())) {
          const result = date.getMonth() + 1 // Excel months are 1-indexed
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle DAY function
      if (/^day\(/i.test(expression) && expression.endsWith(')')) {
        const dateValue = getCellValue(expression.slice(4, -1), visitedCells)
        let date
        
        // Handle different types of date inputs
        if (dateValue instanceof Date) {
          // Direct Date object
          date = dateValue
        } else if (dateValue && typeof dateValue === 'object' && dateValue.type && dateValue.value) {
          // Date result from another formula
          date = dateValue.value
        } else if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Date string in YYYY-MM-DD format
          const [year, month, day] = dateValue.split('-')
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        } else {
          // Try to parse as Excel serial number
          const numValue = parseFloat(dateValue)
          if (!isNaN(numValue)) {
            // Use xlsx library to convert Excel serial number to date
            try {
              const dateString = XLSX.SSF.format('yyyy-mm-dd', numValue)
              if (dateString && dateString !== 'Invalid Date') {
                date = new Date(dateString)
              } else {
                // Fallback to manual calculation
                const excelEpoch = new Date(1900, 0, 1)
                const daysSinceEpoch = numValue - 1
                date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
              }
            } catch (error) {
              // Fallback to manual calculation
              const excelEpoch = new Date(1900, 0, 1)
              const daysSinceEpoch = numValue - 1
              date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
            }
          }
        }
        
        if (!isNaN(date.getTime())) {
          const result = date.getDate()
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle ROUND function
      if (/^round\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(6, -1))
        if (args.length >= 2) {
          const number = parseFloat(getCellValue(args[0], visitedCells))
          const digits = parseInt(getCellValue(args[1], visitedCells))
          
          if (!isNaN(number) && !isNaN(digits)) {
            const result = Math.round(number * Math.pow(10, digits)) / Math.pow(10, digits)
            formulaCacheRef.current.set(cacheKey, result)
            return result
          }
        }
      }
      
      // Handle ROUNDUP function
      if (/^roundup\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(8, -1))
        if (args.length >= 2) {
          const number = parseFloat(getCellValue(args[0], visitedCells))
          const digits = parseInt(getCellValue(args[1], visitedCells))
          
          if (!isNaN(number) && !isNaN(digits)) {
            const factor = Math.pow(10, digits)
            const result = Math.ceil(number * factor) / factor
            formulaCacheRef.current.set(cacheKey, result)
            return result
          }
        }
      }
      
      // Handle ROUNDDOWN function
      if (/^rounddown\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(10, -1))
        if (args.length >= 2) {
          const number = parseFloat(getCellValue(args[0], visitedCells))
          const digits = parseInt(getCellValue(args[1], visitedCells))
          
          if (!isNaN(number) && !isNaN(digits)) {
            const factor = Math.pow(10, digits)
            const result = Math.floor(number * factor) / factor
            formulaCacheRef.current.set(cacheKey, result)
            return result
          }
        }
      }
      
      // Handle ABS function
      if (/^abs\(/i.test(expression) && expression.endsWith(')')) {
        const processedArg = processPercentageValues(expression.slice(4, -1))
        const value = parseFloat(getCellValue(processedArg, visitedCells))
        if (!isNaN(value)) {
          const result = Math.abs(value)
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle SQRT function
      if (/^sqrt\(/i.test(expression) && expression.endsWith(')')) {
        const processedArg = processPercentageValues(expression.slice(5, -1))
        const value = parseFloat(getCellValue(processedArg, visitedCells))
        if (!isNaN(value) && value >= 0) {
          const result = Math.sqrt(value)
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle POWER function
      if (/^power\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(6, -1))
        if (args.length >= 2) {
          const base = parseFloat(getCellValue(args[0], visitedCells))
          const exponent = parseFloat(getCellValue(args[1], visitedCells))
          
          if (!isNaN(base) && !isNaN(exponent)) {
            const result = Math.pow(base, exponent)
            formulaCacheRef.current.set(cacheKey, result)
            return result
          }
        }
      }
      
      // Handle CONCATENATE function
      if (/^concatenate\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(12, -1))
        const result = args.map(arg => String(getCellValue(arg, visitedCells))).join('')
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle LEN function
      if (/^len\(/i.test(expression) && expression.endsWith(')')) {
        const value = String(getCellValue(expression.slice(4, -1), visitedCells))
        const result = value.length
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle UPPER function
      if (/^upper\(/i.test(expression) && expression.endsWith(')')) {
        const value = String(getCellValue(expression.slice(6, -1), visitedCells))
        const result = value.toUpperCase()
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle LOWER function
      if (/^lower\(/i.test(expression) && expression.endsWith(')')) {
        const value = String(getCellValue(expression.slice(6, -1), visitedCells))
        const result = value.toLowerCase()
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle LEFT function
      if (/^left\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(5, -1))
        if (args.length >= 1) {
          const text = String(getCellValue(args[0], visitedCells))
          const numChars = args.length > 1 ? parseInt(getCellValue(args[1], visitedCells)) : 1
          const result = text.substring(0, Math.max(0, numChars))
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle RIGHT function
      if (/^right\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(6, -1))
        if (args.length >= 1) {
          const text = String(getCellValue(args[0], visitedCells))
          const numChars = args.length > 1 ? parseInt(getCellValue(args[1], visitedCells)) : 1
          const result = text.substring(Math.max(0, text.length - numChars))
          formulaCacheRef.current.set(cacheKey, result)
          return result
        }
      }
      
      // Handle MID function
      if (/^mid\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(4, -1))
        if (args.length >= 3) {
          const text = String(getCellValue(args[0], visitedCells))
          const startPos = parseInt(getCellValue(args[1], visitedCells))
          const numChars = parseInt(getCellValue(args[2], visitedCells))
          
          if (!isNaN(startPos) && !isNaN(numChars)) {
            const result = text.substring(Math.max(0, startPos - 1), Math.max(0, startPos - 1 + numChars))
            formulaCacheRef.current.set(cacheKey, result)
            return result
          }
        }
      }
      
      // Handle FIND function
      if (/^find\(/i.test(expression) && expression.endsWith(')')) {
        const args = parseFunctionArgs(expression.slice(5, -1))
        if (args.length >= 2) {
          const findText = String(getCellValue(args[0], visitedCells))
          const withinText = String(getCellValue(args[1], visitedCells))
          const startNum = args.length > 2 ? parseInt(getCellValue(args[2], visitedCells)) : 1
          
          if (!isNaN(startNum)) {
            const index = withinText.indexOf(findText, startNum - 1)
            const result = index >= 0 ? index + 1 : '#VALUE!'
            formulaCacheRef.current.set(cacheKey, result)
            return result
          }
        }
      }
      
      // Handle ISNUMBER function
      if (/^isnumber\(/i.test(expression) && expression.endsWith(')')) {
        const value = getCellValue(expression.slice(9, -1), visitedCells)
        const result = !isNaN(parseFloat(value)) && isFinite(value)
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle ISTEXT function
      if (/^istext\(/i.test(expression) && expression.endsWith(')')) {
        const value = getCellValue(expression.slice(7, -1), visitedCells)
        const result = typeof value === 'string' && isNaN(parseFloat(value))
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle ISBLANK function
      if (/^isblank\(/i.test(expression) && expression.endsWith(')')) {
        const value = getCellValue(expression.slice(8, -1), visitedCells)
        const result = value === '' || value === null || value === undefined
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle simple cell reference (e.g., =M59, =$E$7, =(A1))
      const simpleCellRefRegex = /^\$?([A-Z]+)\$?(\d+)$/
      const simpleMatch = expression.match(simpleCellRefRegex)
      if (simpleMatch) {
        const result = getCellValue(expression, visitedCells)
        // Cache the result
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Handle cell reference with parentheses (e.g., =(A1), =($E$7))
      const parenCellRefRegex = /^\(\$?([A-Z]+)\$?(\d+)\)$/
      const parenMatch = expression.match(parenCellRefRegex)
      if (parenMatch) {
        const cellRef = parenMatch[1] + parenMatch[2] // Reconstruct cell reference without parentheses
        const result = getCellValue(cellRef, visitedCells)
        // Cache the result
        formulaCacheRef.current.set(cacheKey, result)
        return result
      }
      
      // Cache the original formula
      formulaCacheRef.current.set(cacheKey, stringFormula)
      return stringFormula
      
    } catch (error) {
      // Only log errors for debugging, don't spam console
      if (import.meta.env.DEV) {
        console.warn('Formula evaluation error:', error.message)
      }
      // Cache the error result too
      formulaCacheRef.current.set(cacheKey, stringFormula)
      return stringFormula
    }
  }, [data, parseFunctionArgs, processPercentageValues, allSheetsData, currentSheetName])

  // Enhanced cell value formatting function
  const formatCellValueWithProperties = useCallback((value, cell) => {
    if (!value && value !== 0) return ''
    
    // If it's a formula string, return it as-is (should be evaluated before reaching here)
    if (typeof value === 'string' && value.startsWith('=')) {
      return value
    }
    
    // Handle date objects returned by formula evaluator
    if (value && typeof value === 'object' && value.type) {
      if (value.type === 'date') {
        return value.value.toLocaleDateString()
      } else if (value.type === 'datetime') {
        return value.value.toLocaleString()
      } else if (value.type === 'number') {
        return value.value.toString()
      }
      // For other object types, try to extract a meaningful value
      return String(value.value || value)
    }
    
    // Debug: Log all currency cells
    if (cell?.isCurrency) {
      // Debug logging for currency cells
    }
    
    // Debug: Log formatting properties for formula cells
    
    // Use computed result for formulas, rawValue for others
    const rawValue = cell?.isFormula ? value
      : (cell?.rawValue !== undefined ? cell.rawValue : value)
    
    // Format based on cell type and number format
    if (cell?.isDate && cell?.numberFormat) {
      try {
        // Convert Excel serial date to JavaScript Date
        if (typeof rawValue === 'number' && rawValue > 25569) { // Excel epoch starts at 1900-01-01
          const excelEpoch = new Date(1900, 0, 1)
          const jsDate = new Date(excelEpoch.getTime() + (rawValue - 2) * 24 * 60 * 60 * 1000)
          
          // Apply basic date formatting based on the format string
          if (cell.numberFormat.includes('mm/dd/yyyy') || cell.numberFormat.includes('m/d/yyyy')) {
            return jsDate.toLocaleDateString('en-US')
          } else if (cell.numberFormat.includes('dd/mm/yyyy') || cell.numberFormat.includes('d/m/yyyy')) {
            return jsDate.toLocaleDateString('en-GB')
          } else if (cell.numberFormat.includes('yyyy-mm-dd')) {
            return jsDate.toISOString().split('T')[0]
          } else if (cell.numberFormat.includes('h:mm') || cell.numberFormat.includes('hh:mm')) {
            return jsDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          } else {
            return jsDate.toLocaleDateString()
          }
        }
        // If it's already a date string, try to parse and format it
        else if (typeof rawValue === 'string') {
          const date = new Date(rawValue)
          if (!isNaN(date.getTime())) {
            if (cell.numberFormat.includes('mm/dd/yyyy') || cell.numberFormat.includes('m/d/yyyy')) {
              return date.toLocaleDateString('en-US')
            } else if (cell.numberFormat.includes('dd/mm/yyyy') || cell.numberFormat.includes('d/m/yyyy')) {
              return date.toLocaleDateString('en-GB')
            } else if (cell.numberFormat.includes('yyyy-mm-dd')) {
              return date.toISOString().split('T')[0]
            } else if (cell.numberFormat.includes('h:mm') || cell.numberFormat.includes('hh:mm')) {
              return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            } else {
              return date.toLocaleDateString()
            }
          }
        }
      } catch (error) {
        console.warn('Error formatting date:', error)
      }
    }
    
    // Format numbers with currency, percentage, etc.
    // Check for currency/percentage formatting regardless of cellType (important for formula cells)
    if (cell?.isCurrency || cell?.isPercentage || (cell?.cellType === 'number' && cell?.numberFormat)) {
      try {
        // Use computed result for formulas, parse rawValue for others
        // Check if cell contains a formula by looking at the value
        const isFormula = cell?.isFormula || (cell?.value && String(cell?.value).startsWith('='))
        const sourceForNumber = isFormula ? value : rawValue
        const numValue = typeof sourceForNumber === 'number'
          ? sourceForNumber
          : parseFloat(String(sourceForNumber).replace(/\u00A0/g, ' ').replace(/[^\d.,-]/g, '')
              .replace(/(?<=\d)[,](?=\d{3}\b)/g, '') // drop thousands commas
              .replace(/,(?=\d{1,2}\b)/, '.'))       // EU decimal comma -> dot
        
        
        if (!isNaN(numValue)) {
          // Use enhanced formatting properties
          if (cell.isCurrency && cell.currencySymbol) {
            const currency = cell.currencySymbol === '$' ? 'USD' : 
                           cell.currencySymbol === '€' ? 'EUR' : 
                           cell.currencySymbol === '£' ? 'GBP' : 'USD'
            const dp = Number.isInteger(cell.decimalPlaces) ? cell.decimalPlaces : 2
            
            
            
            const formatted = new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: currency,
              minimumFractionDigits: dp,
              maximumFractionDigits: dp
            }).format(numValue)
            
            
            return formatted
          } else if (cell.isPercentage) {
            // Check if the value is already a percentage (between 0 and 1) or a whole percentage (like 40)
            const isAlreadyPercentage = numValue >= 0 && numValue <= 1
            const percentageValue = isAlreadyPercentage ? numValue : numValue / 100
            
            
            return new Intl.NumberFormat('en-US', { 
              style: 'percent',
              minimumFractionDigits: Number.isInteger(cell.decimalPlaces) ? cell.decimalPlaces : 2,
              maximumFractionDigits: Number.isInteger(cell.decimalPlaces) ? cell.decimalPlaces : 2
            }).format(percentageValue)
          } else if (cell.decimalPlaces !== null && cell.decimalPlaces !== undefined) {
            return numValue.toFixed(cell.decimalPlaces)
          }
        }
      } catch (error) {
        console.warn('Error formatting number:', error)
      }
    }
    
    // Also try to format based on numberFormat even if cellType is not 'number'
    if (cell?.numberFormat && !cell?.isDate) {
      try {
        const numValue = parseFloat(rawValue)
        if (!isNaN(numValue)) {
          // Use enhanced formatting properties for fallback
          if (cell.isCurrency && cell.currencySymbol) {
            const currency = cell.currencySymbol === '$' ? 'USD' : 
                           cell.currencySymbol === '€' ? 'EUR' : 
                           cell.currencySymbol === '£' ? 'GBP' : 'USD'
            const dp = Number.isInteger(cell.decimalPlaces) ? cell.decimalPlaces : 2
            
            
            const formatted = new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: currency,
              minimumFractionDigits: dp,
              maximumFractionDigits: dp
            }).format(numValue)
            
            
            return formatted
          } else if (cell.isPercentage) {
            // Check if the value is already a percentage (between 0 and 1) or a whole percentage (like 40)
            const isAlreadyPercentage = numValue >= 0 && numValue <= 1
            const percentageValue = isAlreadyPercentage ? numValue : numValue / 100
            
            return new Intl.NumberFormat('en-US', { 
              style: 'percent',
              minimumFractionDigits: Number.isInteger(cell.decimalPlaces) ? cell.decimalPlaces : 2,
              maximumFractionDigits: Number.isInteger(cell.decimalPlaces) ? cell.decimalPlaces : 2
            }).format(percentageValue)
          }
        }
      } catch (error) {
        console.warn('Error formatting number by format:', error)
      }
    }
    
    // Fallback to basic decimal formatting if specified
    if (cell?.decimalPlaces !== null && cell?.decimalPlaces !== undefined) {
      const num = parseFloat(rawValue)
      if (!isNaN(num)) {
        return num.toFixed(cell.decimalPlaces)
      }
    }
    
    return value
  }, [])

  // Get display value for a cell with memoization
  const getCellDisplayValue = useCallback((cell, rowIndex, colIndex) => {
    const cellValue = String(cell?.value || '')
    const cellKey = `${rowIndex}-${colIndex}`
    
    if (cellValue.startsWith('=')) {
      // Show formula only if this specific cell is being edited OR if we're in formula display mode
      const isThisCellEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex
      const shouldShowFormula = isThisCellEditing || formulaDisplayMode === 2
      if (shouldShowFormula) {
        return cellValue
      } else {
        // Track dependencies for this formula cell
        const references = extractCellReferences(cellValue)
        const dependencyKeys = references.map(ref => `${ref.row}-${ref.col}`)
        trackDependencies(cellKey, dependencyKeys)
        
        const result = evaluateFormula(cellValue, rowIndex, colIndex)
        
        // Debug: Log inter-sheet formula evaluation
        if (cellValue.includes('!') && import.meta.env.DEV) {
        }
        
        // Apply enhanced formatting based on cell properties
        const formattedResult = formatCellValueWithProperties(result, cell)
        
        return formattedResult
      }
    } else {
      // For non-formula cells, use the enhanced formatting
      return formatCellValueWithProperties(cellValue, cell)
    }
  }, [editingCell, evaluateFormula, formulaDisplayMode, extractCellReferences, trackDependencies, formatCellValueWithProperties])


  // Handle key press in cell
  const handleCellKeyPress = useCallback((e, rowIndex, colIndex) => {
    // Handle autocomplete navigation
    if (autocompleteVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIndex(prev => 
          prev < autocompleteOptions.length - 1 ? prev + 1 : 0
        )
        return
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIndex(prev => 
          prev > 0 ? prev - 1 : autocompleteOptions.length - 1
        )
        return
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (autocompleteOptions[autocompleteIndex]) {
          const selectedFormula = autocompleteOptions[autocompleteIndex]
          const beforeEquals = inputValue.split('=')[0] || ''
          const newValue = beforeEquals + '=' + selectedFormula.name + '('
          setInputValue(newValue)
          setAutocompleteVisible(false)
          // Position cursor before the closing parenthesis
          setTimeout(() => {
            const input = e.target
            input.setSelectionRange(newValue.length, newValue.length)
          }, 0)
        }
        return
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setAutocompleteVisible(false)
        return
      }
    }

    // Handle cell navigation
        if (e.key === 'Enter') {
          e.preventDefault()
          
          // Get the current value directly from the input element
          const currentValue = e.target.value
          // Trigger recalculation when Enter is pressed
          handleCellChange(rowIndex, colIndex, currentValue, true) // true = shouldRecalculate
          
          // Clear editing state after a short delay to ensure data is updated
          setTimeout(() => {
            setEditingCell(null)
            setAutocompleteVisible(false)
            setIsFormulaEditing(false)
            setReferencedCells([])
            setReferencedCellColors({})
            setInputValue('')
            // Move to next row
            if (rowIndex < data.length - 1) {
              setSelectedCell({ row: rowIndex + 1, col: colIndex })
            }
          }, 100)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          
          // Get the current value directly from the input element
          const currentValue = e.target.value
          // Trigger recalculation when Tab is pressed
          handleCellChange(rowIndex, colIndex, currentValue, true) // true = shouldRecalculate
          
          // Clear editing state after a short delay to ensure data is updated
          setTimeout(() => {
            setEditingCell(null)
            setAutocompleteVisible(false)
            setIsFormulaEditing(false)
            setReferencedCells([])
            setReferencedCellColors({})
            setInputValue('')
            // Move to next column
            if (colIndex < (data[0]?.length || 0) - 1) {
              setSelectedCell({ row: rowIndex, col: colIndex + 1 })
            }
          }, 100)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setEditingCell(null)
          setAutocompleteVisible(false)
          setIsFormulaEditing(false)
          setReferencedCells([])
          setReferencedCellColors({})
          setInputValue('')
    } else if (e.key === 'ArrowLeft' && !autocompleteVisible) {
      // Don't prevent default - let the cursor move within the text
      // Only move to previous cell if we're not editing
      if (!editingCell) {
        e.preventDefault()
        setEditingCell(null)
        setAutocompleteVisible(false)
        setIsFormulaEditing(false)
        setReferencedCells([])
        // Move to previous column
        if (colIndex > 0) {
          setSelectedCell({ row: rowIndex, col: colIndex - 1 })
        }
      }
    } else if (e.key === 'ArrowRight' && !autocompleteVisible) {
      // Don't prevent default - let the cursor move within the text
      // Only move to next cell if we're not editing
      if (!editingCell) {
        e.preventDefault()
        setEditingCell(null)
        setAutocompleteVisible(false)
        setIsFormulaEditing(false)
        setReferencedCells([])
        // Move to next column
        if (colIndex < (data[0]?.length || 0) - 1) {
          setSelectedCell({ row: rowIndex, col: colIndex + 1 })
        }
      }
    } else if (e.key === 'ArrowUp' && !autocompleteVisible) {
      e.preventDefault()
      setEditingCell(null)
      setAutocompleteVisible(false)
      setIsFormulaEditing(false)
      setReferencedCells([])
      // Move to previous row
      if (rowIndex > 0) {
        setSelectedCell({ row: rowIndex - 1, col: colIndex })
      }
    } else if (e.key === 'ArrowDown' && !autocompleteVisible) {
      e.preventDefault()
      setEditingCell(null)
      setAutocompleteVisible(false)
      setIsFormulaEditing(false)
      setReferencedCells([])
      // Move to next row
      if (rowIndex < data.length - 1) {
        setSelectedCell({ row: rowIndex + 1, col: colIndex })
      }
    }
  }, [data, autocompleteVisible, autocompleteOptions, autocompleteIndex, handleCellChange, editingCell, inputValue])

  if (!data || data.length === 0) {
    return (
      <div 
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div className="text-center text-gray-500">
          <p>No data to display</p>
          <p className="text-sm mt-2">Data length: {data?.length || 0}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        position: 'relative',
        scrollBehavior: 'auto' // Disable smooth scrolling to prevent conflicts
      }}
    >
      {/* Virtual table with only visible cells */}
      <table key={`spreadsheet-${recalcTrigger}-${forceUpdate}`} className="excel-grid w-full border-collapse">
        <thead className="sticky top-0 bg-white z-30">
          <tr>
            <th className="bg-gray-100 border border-gray-300 text-center text-xs font-medium text-gray-700 py-2">
              {/* Corner cell */}
            </th>
            {Array.from({ length: visibleRange.endCol - visibleRange.startCol }, (_, i) => {
              const colIndex = visibleRange.startCol + i
              const width = columnWidths[colIndex] || 120
              return (
                <th 
                  key={colIndex}
                  style={{ width: `${width}px` }}
                  className="bg-gray-100 border border-gray-300 text-center text-xs font-medium text-gray-700 py-2 cursor-pointer hover:bg-gray-200 select-none"
                  onClick={(e) => handleColumnHeaderClick(colIndex, e)}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget && e.detail === 1) {
                      // Check if clicking on the right edge for resizing
                      const rect = e.currentTarget.getBoundingClientRect()
                      const clickX = e.clientX - rect.left
                      const isResizeArea = clickX > rect.width - 10
                      
                      if (isResizeArea) {
                        const startX = e.clientX
                        const startWidth = width
                        
                        const handleMouseMove = (e) => {
                          const newWidth = startWidth + (e.clientX - startX)
                          handleColumnResize(colIndex, newWidth)
                        }
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove)
                          document.removeEventListener('mouseup', handleMouseUp)
                        }
                        
                        document.addEventListener('mousemove', handleMouseMove)
                        document.addEventListener('mouseup', handleMouseUp)
                      }
                    }
                  }}
                >
                  {getColumnLetter(colIndex)}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {visibleData.map((row, visibleRowIndex) => {
            const actualRowIndex = visibleRange.startRow + visibleRowIndex
            return (
              <tr key={actualRowIndex}>
                {/* Row Number */}
                <td 
                  className="row-header sticky left-0 bg-gray-50 border border-gray-300 text-center text-xs font-medium text-gray-700 py-1 cursor-pointer hover:bg-gray-200 select-none"
                  onClick={(e) => handleRowHeaderClick(actualRowIndex, e)}
                >
                  {actualRowIndex + 1}
                </td>
                
                {/* Data Cells */}
                {row.map((cell, visibleColIndex) => {
                  const actualColIndex = visibleRange.startCol + visibleColIndex
                  const isSelected = selectedCell?.row === actualRowIndex && selectedCell?.col === actualColIndex
                  const isEditing = editingCell?.row === actualRowIndex && editingCell?.col === actualColIndex
                  const cellValue = String(cell?.value || '')
                  const isFormula = cellValue.startsWith('=')
                  const displayValue = getCellDisplayValue(cell, actualRowIndex, actualColIndex)
                  
                  const width = columnWidths[actualColIndex] || 120
                  const isReferenced = referencedCells.some(ref => ref.row === actualRowIndex && ref.col === actualColIndex)
                  const shouldHighlightFormula = formulaDisplayMode === 1 && isFormula
                  const shouldShowFormula = formulaDisplayMode === 2 && isFormula
                  const referencedColor = isReferenced ? referencedCellColors[`${actualRowIndex}-${actualColIndex}`] : null
                  
                  // Check if this cell is in the multi-selection
                  const isMultiSelected = selectedCells.some(sel => sel.row === actualRowIndex && sel.col === actualColIndex)
                  
                  // Check if this cell is in the drag selection area
                  const isInDragArea = isDragging && dragStart && dragEnd && 
                    actualRowIndex >= Math.min(dragStart.row, dragEnd.row) &&
                    actualRowIndex <= Math.max(dragStart.row, dragEnd.row) &&
                    actualColIndex >= Math.min(dragStart.col, dragEnd.col) &&
                    actualColIndex <= Math.max(dragStart.col, dragEnd.col)
                  
                  // Determine if this is a numeric value for right alignment
                  // Right-align when the shown content is numeric (including formula results)
                  const isNumeric = (!shouldShowFormula) && (
                    (!isNaN(parseFloat(displayValue)) && displayValue !== '') ||
                    cell?.isDate ||
                    cell?.isCurrency ||
                    cell?.isPercentage ||
                    cell?.cellType === 'number'
                  )
                  
                  // Debug alignment logging removed to prevent console spam
                  
                  // Check if this cell is in the highlighted block
                  const isHighlighted = isInHighlightedBlock(actualRowIndex, actualColIndex)
                  
                  // Check if this cell is in a dependency frame
                  const dependencyFrameColor = getDependencyFrameColor(actualRowIndex, actualColIndex)
                  
                  return (
                    <td
                      key={actualColIndex}
                      style={{ 
                        width: `${width}px`,
                        border: isReferenced && referencedColor ? `3px solid ${referencedColor}` : 
                               isHighlighted ? '3px solid #f59e0b' : 
                               dependencyFrameColor ? `3px solid ${dependencyFrameColor}` : '1px solid #d1d5db',
                        position: 'relative',
                        zIndex: isReferenced ? 20 : isHighlighted ? 15 : dependencyFrameColor ? 10 : 'auto'
                      }}
                      className={`cursor-pointer text-xs py-1 px-2 ${
                        isSelected || isMultiSelected
                          ? 'bg-blue-100 border-blue-400' 
                          : isInDragArea
                          ? 'bg-blue-50 border-blue-300'
                          : isHighlighted
                          ? 'bg-orange-50'
                          : 'hover:bg-gray-50'
                      } ${shouldHighlightFormula ? 'bg-green-50 border-green-300' : ''} ${shouldShowFormula ? 'bg-blue-50 border-blue-300' : ''} ${isFormulaEditing ? 'ring-2 ring-yellow-400' : ''} ${isNumeric ? 'text-right' : 'text-center'}`}
                      onMouseDown={(e) => handleMouseDown(actualRowIndex, actualColIndex, e)}
                    >
                      {isEditing ? (
                        <div className="relative w-full h-full">
                          <input
                            type="text"
                            id={`cell-${actualRowIndex}-${actualColIndex}`}
                            name={`cell-${actualRowIndex}-${actualColIndex}`}
                            value={inputValue}
                            onChange={(e) => {
                              setInputValue(e.target.value)
                              // Update formula editing state for highlighting
                              const stringValue = String(e.target.value || '')
                              setIsFormulaEditing(stringValue.startsWith('='))
                              
                              // Update referenced cells for highlighting (only during typing)
                              if (stringValue.startsWith('=')) {
                                const references = extractCellReferences(stringValue)
                                setReferencedCells(references)
                                
                                // Assign the same color to all referenced cells in this formula
                                const newColors = {}
                                const rangeColor = generateRandomColor()
                                references.forEach(ref => {
                                  const key = `${ref.row}-${ref.col}`
                                  newColors[key] = rangeColor
                                })
                                setReferencedCellColors(prev => ({ ...prev, ...newColors }))
                              } else {
                                setReferencedCells([])
                                setReferencedCellColors({})
                              }
                            }}
                            onKeyDown={(e) => handleCellKeyPress(e, actualRowIndex, actualColIndex)}
                            onClick={(e) => {
                              // Allow normal cursor positioning by not preventing default
                              e.stopPropagation()
                            }}
                            onMouseDown={(e) => {
                              // Prevent the cell's onMouseDown from firing when clicking on the input
                              e.stopPropagation()
                            }}
                            onBlur={() => {
                              // Only clear editing state, don't save data (Enter/Tab handlers do that)
                              setTimeout(() => {
                                setEditingCell(null)
                                setAutocompleteVisible(false)
                                setIsFormulaEditing(false)
                                setReferencedCells([])
                                setReferencedCellColors({})
                                setInputValue('')
                              }, 200)
                            }}
                            className="editing-input w-full h-full border-0 outline-none bg-transparent text-xs px-1"
                          />
                          {autocompleteVisible && autocompleteOptions.length > 0 && (
                            <div className="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto min-w-64">
                              {autocompleteOptions.map((formula, index) => (
                                <div
                                  key={formula.name}
                                  className={`px-3 py-2 text-xs cursor-pointer border-b border-gray-100 last:border-b-0 ${
                                    index === autocompleteIndex ? 'bg-blue-100' : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => {
                                    const newValue = '=' + formula.name + '('
                                    setInputValue(newValue)
                                    setAutocompleteVisible(false)
                                  }}
                                >
                                  <div className="font-medium text-blue-600">{formula.name}</div>
                                  <div className="text-gray-600 text-xs">{formula.description}</div>
                                  <div className="text-gray-500 text-xs font-mono">{formula.example}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        ) : (
                          <div className={`cell-content ${isNumeric ? 'text-right' : 'text-center'}`}>
                            <span className="truncate">
                              {shouldShowFormula ? cellValue : displayValue}
                            </span>
                          </div>
                        )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Disable memoization completely to ensure recalculation works
export default ReactSpreadsheet

ReactSpreadsheet.propTypes = {
  data: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    rawValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    className: PropTypes.string,
    decimalPlaces: PropTypes.number,
    isDate: PropTypes.bool
  }))).isRequired,
  allSheetsData: PropTypes.object,
  currentSheetName: PropTypes.string,
  onDataChange: PropTypes.func.isRequired,
  formulaDisplayMode: PropTypes.number,
  selectedCells: PropTypes.arrayOf(PropTypes.shape({
    row: PropTypes.number.isRequired,
    col: PropTypes.number.isRequired
  })),
  onSelectedCellsChange: PropTypes.func,
  highlightedBlock: PropTypes.string,
  dependencyFrames: PropTypes.arrayOf(PropTypes.shape({
    range: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    layer: PropTypes.number.isRequired
  }))
}

