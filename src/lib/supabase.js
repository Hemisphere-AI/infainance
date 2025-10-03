import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database helper functions
export const spreadsheetService = {
  // Create a new spreadsheet for a user
  async createSpreadsheet(userId, name = 'Untitled Spreadsheet') {
    const { data, error } = await supabase
      .from('spreadsheets')
      .insert({
        user_id: userId,
        name: name,
        data: [] // Start with empty spreadsheet
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Get user's spreadsheets
  async getUserSpreadsheets(userId) {
    try {
      const { data, error } = await supabase
        .from('spreadsheets')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      
      if (error) {
        console.error('spreadsheetService.getUserSpreadsheets: Database error:', error)
        throw error
      }
      
      return data
    } catch (err) {
      console.error('spreadsheetService.getUserSpreadsheets: Caught error:', err)
      throw err
    }
  },

  // Get a specific spreadsheet
  async getSpreadsheet(spreadsheetId, userId) {
    const { data, error } = await supabase
      .from('spreadsheets')
      .select('*')
      .eq('id', spreadsheetId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  },

  // Update spreadsheet metadata (data is now stored in spreadsheet_cells table)
  async updateSpreadsheetData(spreadsheetId, userId) {
    const { data, error } = await supabase
      .from('spreadsheets')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', spreadsheetId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update spreadsheet name
  async updateSpreadsheetName(spreadsheetId, userId, newName) {
    const { data, error } = await supabase
      .from('spreadsheets')
      .update({
        name: newName,
        updated_at: new Date().toISOString()
      })
      .eq('id', spreadsheetId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete spreadsheet
  async deleteSpreadsheet(spreadsheetId, userId) {
    const { error } = await supabase
      .from('spreadsheets')
      .delete()
      .eq('id', spreadsheetId)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Subscribe to real-time updates for a spreadsheet
  subscribeToSpreadsheet(spreadsheetId, callback) {
    return supabase
      .channel(`spreadsheet-${spreadsheetId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'spreadsheets',
          filter: `id=eq.${spreadsheetId}`
        },
        callback
      )
      .subscribe()
  },

  // Unsubscribe from real-time updates
  unsubscribe(subscription) {
    return supabase.removeChannel(subscription)
  }
}

// User profile service
export const userService = {
  // Create or update user profile
  async upsertUserProfile(userData) {
    try {
      // Add timeout to prevent hanging
      const dbPromise = supabase
        .from('user_profiles')
        .upsert({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database operation timeout after 10 seconds')), 10000)
      )

      const { data, error } = await Promise.race([dbPromise, timeoutPromise])
      
      if (error) {
        console.error('userService.upsertUserProfile: Database error:', error)
        throw error
      }
      
      return data
    } catch (err) {
      console.error('userService.upsertUserProfile: Caught error:', err)
      throw err
    }
  },

  // Get user profile
  async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  },

  // Get user's monthly token balance
  async getTokenBalance(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('monthly_token_balance, token_reset_date')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  },

  // Update user's monthly token balance
  async updateTokenBalance(userId, newBalance) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        monthly_token_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Reset monthly token balance (for new month)
  async resetTokenBalance(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        monthly_token_balance: 0,
        token_reset_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Add tokens to user's monthly balance
  async addTokens(userId, tokens) {
    // First get current balance
    const currentBalance = await this.getTokenBalance(userId)
    const newBalance = currentBalance.monthly_token_balance + tokens
    
    return await this.updateTokenBalance(userId, newBalance)
  }
}

// Helper function to evaluate formulas (comprehensive version)
const evaluateFormula = (formula, spreadsheetData) => {
  try {
    // Remove the = sign
    const expression = formula.substring(1)
    
    // Convert cell references to values
    const evaluateExpression = (expr) => {
      // Replace cell references like A1, B2, etc. with their values
      return expr.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
        const colIndex = col.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
        const rowIndex = parseInt(row) - 1
        
        const cell = spreadsheetData[rowIndex]?.[colIndex]
        if (cell && cell.value !== undefined && cell.value !== null) {
          // If it's a formula, evaluate it recursively
          if (String(cell.value).startsWith('=')) {
            return evaluateFormula(cell.value, spreadsheetData)
          }
          // Return the numeric value
          const numValue = parseFloat(cell.value)
          return isNaN(numValue) ? 0 : numValue
        }
        return 0
      })
    }
    
    // Handle SUM function
    if (expression.toUpperCase().includes('SUM')) {
      const rangeMatch = expression.match(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/i)
      if (rangeMatch) {
        const [, startCell, endCell] = rangeMatch
        
        // Convert cell references to indices
        const startCol = startCell.match(/([A-Z]+)/)[1]
        const startRow = parseInt(startCell.match(/(\d+)/)[1])
        const endCol = endCell.match(/([A-Z]+)/)[1]
        const endRow = parseInt(endCell.match(/(\d+)/)[1])
        
        const startColIndex = startCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
        const endColIndex = endCol.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
        
        let sum = 0
        for (let r = startRow - 1; r < endRow; r++) {
          for (let c = startColIndex; c <= endColIndex; c++) {
            const cell = spreadsheetData[r]?.[c]
            if (cell && cell.value !== undefined && cell.value !== null) {
              if (String(cell.value).startsWith('=')) {
                // Recursively evaluate formula cells
                sum += evaluateFormula(cell.value, spreadsheetData)
              } else {
                const numValue = parseFloat(cell.value)
                if (!isNaN(numValue)) {
                  sum += numValue
                }
              }
            }
          }
        }
        return sum
      }
    }
    
    // Handle basic arithmetic operations
    const evaluatedExpr = evaluateExpression(expression)
    
    // Safe evaluation of the expression
    try {
      const result = Function('"use strict"; return (' + evaluatedExpr + ')')()
      return isNaN(result) ? 0 : result
    } catch (evalError) {
      console.warn('Could not evaluate expression:', evaluatedExpr, evalError)
      return 0
    }
    
  } catch (error) {
    console.error('Error evaluating formula:', error)
    return 0
  }
}

// Cell service for optimized spreadsheet cell storage
export const cellService = {
  // Save a single cell
  async saveCell(spreadsheetId, rowIndex, colIndex, cellData, spreadsheetData = []) {
    const isFormula = cellData.value && String(cellData.value).startsWith('=')
    
    let displayValue = cellData.value
    
    // If it's a formula, calculate the result
    if (isFormula) {
      try {
        displayValue = evaluateFormula(cellData.value, spreadsheetData)
      } catch (error) {
        console.error('Error evaluating formula:', error)
        displayValue = '#ERROR'
      }
    }
    
    const cellRecord = {
      spreadsheet_id: spreadsheetId,
      row_index: rowIndex,
      col_index: colIndex,
      formula: isFormula ? cellData.value : null,
      display_value: displayValue,
      cell_type: isFormula ? 'formula' : 'text',
      formatting: cellData.formatting || null,
      decimal_places: cellData.decimalPlaces || null,
      is_currency: cellData.isCurrency || false,
      is_percentage: cellData.isPercentage || false,
      currency_symbol: cellData.currencySymbol || null,
      is_date: cellData.isDate || false
    }
    
    // For non-formula cells, determine the cell type
    if (!isFormula) {
      // For non-formula cells, determine the cell type
      // If it's currency, set as number type
      if (cellData.isCurrency) {
        cellRecord.cell_type = 'number'
      } else {
        // Try to parse as number for regular numeric values
      const numValue = parseFloat(cellData.value)
      if (!isNaN(numValue)) {
        cellRecord.cell_type = 'number'
        }
      }
    }
    
    const { data, error } = await supabase
      .from('spreadsheet_cells')
      .upsert(cellRecord)
      .select()
      .single()
    
    if (error) throw error
    return data
  },
  
  // Save multiple cells in batch
  async saveCells(spreadsheetId, cellsData) {
    // First, get all existing cells for this spreadsheet to track deletions
    const existingCells = await this.loadSpreadsheetCells(spreadsheetId)
    const existingCellKeys = new Set(existingCells.map(cell => `${cell.row_index}-${cell.col_index}`))
    
    const cellRecords = []
    const cellsToDelete = []
    
    for (const [rowIndex, row] of cellsData.entries()) {
      for (const [colIndex, cell] of row.entries()) {
        const cellKey = `${rowIndex}-${colIndex}`
        const hasContent = cell && cell.value !== undefined && cell.value !== '' && cell.value !== null
        
        if (hasContent) {
          // Cell has content - save it
          const isFormula = cell.value && String(cell.value).startsWith('=')
          
          let displayValue = cell.value
          
          // If it's a formula, calculate the result
          if (isFormula) {
            try {
              displayValue = evaluateFormula(cell.value, cellsData)
            } catch (error) {
              console.error('Error evaluating formula in batch:', error)
              displayValue = '#ERROR'
            }
          }
          
          const cellRecord = {
            spreadsheet_id: spreadsheetId,
            row_index: rowIndex,
            col_index: colIndex,
            formula: isFormula ? cell.value : null,
            display_value: displayValue,
            cell_type: isFormula ? 'formula' : 'text',
            formatting: cell.formatting || null,
            decimal_places: cell.decimalPlaces || null,
            is_currency: cell.isCurrency || false,
            is_percentage: cell.isPercentage || false,
            currency_symbol: cell.currencySymbol || null,
            is_date: cell.isDate || false
          }
          
          // For non-formula cells, determine the cell type
          if (!isFormula) {
            // If it's currency, set as number type
            if (cell.isCurrency) {
              cellRecord.cell_type = 'number'
            } else {
              // Try to parse as number for regular numeric values
            const numValue = parseFloat(cell.value)
            if (!isNaN(numValue)) {
              cellRecord.cell_type = 'number'
              }
            }
          }
          
          cellRecords.push(cellRecord)
        } else if (existingCellKeys.has(cellKey)) {
          // Cell is now empty but existed before - mark for deletion
          cellsToDelete.push({ row_index: rowIndex, col_index: colIndex })
        }
      }
    }
    
    
    // Delete cells that are now empty
    if (cellsToDelete.length > 0) {
      try {
        for (const cellToDelete of cellsToDelete) {
          const { error } = await supabase
            .from('spreadsheet_cells')
            .delete()
            .eq('spreadsheet_id', spreadsheetId)
            .eq('row_index', cellToDelete.row_index)
            .eq('col_index', cellToDelete.col_index)
          
          if (error) {
            console.warn('cellService.saveCells: Error deleting cell:', cellToDelete, error)
          }
        }
      } catch (error) {
        console.error('cellService.saveCells: Failed to delete cells:', error)
      }
    }
    
    // Save cells with content
    if (cellRecords.length === 0) {
      return []
    }
    
    
    // Use upsert to handle duplicate key constraints properly
    try {
      const { data, error } = await supabase
        .from('spreadsheet_cells')
        .upsert(cellRecords, {
          onConflict: 'spreadsheet_id,row_index,col_index',
          ignoreDuplicates: false
        })
        .select()
      
      if (error) {
        console.error('cellService.saveCells: Error upserting cells:', error)
        throw error
      }
      
      return data || []
    } catch (error) {
      console.error('cellService.saveCells: Failed to save cells:', error)
      // Fallback to individual upserts if batch fails
      const results = []
      for (const cellRecord of cellRecords) {
        try {
          const { data, error } = await supabase
            .from('spreadsheet_cells')
            .upsert(cellRecord, {
              onConflict: 'spreadsheet_id,row_index,col_index',
              ignoreDuplicates: false
            })
            .select()
          
          if (error) {
            console.warn('cellService.saveCells: Error upserting individual cell:', cellRecord, error)
            continue
          }
          
          if (data && data.length > 0) {
            results.push(data[0])
          }
        } catch (individualError) {
          console.warn('cellService.saveCells: Failed to save individual cell:', cellRecord, individualError)
        }
      }
      
      return results
    }
  },
  
  // Load all cells for a spreadsheet (optimized for performance)
  async loadSpreadsheetCells(spreadsheetId) {
    const { data, error } = await supabase
      .from('spreadsheet_cells')
      .select('*')
      .eq('spreadsheet_id', spreadsheetId)
      .order('row_index')
      .order('col_index')
    
    if (error) {
      console.error('Error loading spreadsheet cells:', error)
      throw error
    }
    
    return data || []
  },
  
  // Delete all cells for a spreadsheet
  async deleteSpreadsheetCells(spreadsheetId) {
    const { error } = await supabase
      .from('spreadsheet_cells')
      .delete()
      .eq('spreadsheet_id', spreadsheetId)
    
    if (error) throw error
  },
  
  // Convert database cells to spreadsheet format
  convertCellsToSpreadsheetFormat(cells) {
    
    // Always create a 100x20 grid, regardless of how many cells are in the database
    const spreadsheetData = this.createEmptyGrid(100, 20)
    
    if (!cells || cells.length === 0) {
      return spreadsheetData
    }
    
    // Fill in the actual cell data
    cells.forEach(cell => {
      // For formulas, use the formula as the value (for editing), but store display_value for computed result
      const cellValue = cell.formula || cell.display_value || ''
      
      const cellData = {
        value: cellValue,
        displayValue: cell.display_value, // Include the pre-calculated display value
        cellType: cell.cell_type,
        formatting: cell.formatting,
        decimalPlaces: cell.decimal_places,
        isCurrency: cell.is_currency,
        isPercentage: cell.is_percentage,
        currencySymbol: cell.currency_symbol,
        isDate: cell.is_date,
        className: ''
      }
      
      // For formulas, mark them as formula type
      if (cell.formula) {
        cellData.cellType = 'formula'
        cellData.isFormula = true
      }
      
      // Remove null/undefined values
      Object.keys(cellData).forEach(key => {
        if (cellData[key] === null || cellData[key] === undefined) {
          delete cellData[key]
        }
      })
      
      // Only fill in the cell if it's within our 100x20 grid bounds
      if (cell.row_index < 100 && cell.col_index < 20) {
        spreadsheetData[cell.row_index][cell.col_index] = cellData
      } else {
      }
    })
    
    console.log('📊 Final grid created with', spreadsheetData.length, 'rows')
    return spreadsheetData
  },
  
  // Create an empty grid for new spreadsheets
  createEmptyGrid(rows = 100, cols = 20) {
    const grid = []
    for (let row = 0; row < rows; row++) {
      const rowData = []
      for (let col = 0; col < cols; col++) {
        rowData.push({ 
          value: '', 
          className: '',
          cellType: 'text'
        })
      }
      grid.push(rowData)
    }
    return grid
  }
}
