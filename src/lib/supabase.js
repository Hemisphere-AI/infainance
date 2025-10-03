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

// Cell service for optimized spreadsheet cell storage
export const cellService = {
  // Save a single cell
  async saveCell(spreadsheetId, rowIndex, colIndex, cellData) {
    const isFormula = cellData.value && String(cellData.value).startsWith('=')
    
    const cellRecord = {
      spreadsheet_id: spreadsheetId,
      row_index: rowIndex,
      col_index: colIndex,
      formula: isFormula ? cellData.value : null,
      display_value: cellData.value, // Will be calculated if formula
      cell_type: isFormula ? 'formula' : 'text',
      formatting: cellData.formatting || null,
      decimal_places: cellData.decimalPlaces || null,
      is_currency: cellData.isCurrency || false,
      is_percentage: cellData.isPercentage || false,
      currency_symbol: cellData.currencySymbol || null,
      is_date: cellData.isDate || false
    }
    
    // If it's a formula, we'll calculate the result on the client side
    // For now, store the formula and let the client handle evaluation
    if (isFormula) {
      cellRecord.display_value = cellData.value // Store formula as display_value for now
    } else {
      // For non-formula cells, try to parse as number
      const numValue = parseFloat(cellData.value)
      if (!isNaN(numValue)) {
        cellRecord.cell_type = 'number'
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
    const cellRecords = []
    
    for (const [rowIndex, row] of cellsData.entries()) {
      for (const [colIndex, cell] of row.entries()) {
        // Only save cells that have actual content (not empty strings)
        if (cell && cell.value !== undefined && cell.value !== '' && cell.value !== null) {
          const isFormula = cell.value && String(cell.value).startsWith('=')
          
          const cellRecord = {
            spreadsheet_id: spreadsheetId,
            row_index: rowIndex,
            col_index: colIndex,
            formula: isFormula ? cell.value : null,
            display_value: cell.value,
            cell_type: isFormula ? 'formula' : 'text',
            formatting: cell.formatting || null,
            decimal_places: cell.decimalPlaces || null,
            is_currency: cell.isCurrency || false,
            is_percentage: cell.isPercentage || false,
            currency_symbol: cell.currencySymbol || null,
            is_date: cell.isDate || false
          }
          
          // For non-formula cells, try to parse as number
          if (!isFormula) {
            const numValue = parseFloat(cell.value)
            if (!isNaN(numValue)) {
              cellRecord.cell_type = 'number'
            }
          }
          
          cellRecords.push(cellRecord)
        }
      }
    }
    
    if (cellRecords.length === 0) return []
    
    console.log('cellService.saveCells: Attempting to save', cellRecords.length, 'cells')
    console.log('cellService.saveCells: First cell record:', cellRecords[0])
    
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
    
    console.log(`Loaded ${data?.length || 0} cells for spreadsheet ${spreadsheetId}`)
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
    console.log('🔄 convertCellsToSpreadsheetFormat called with', cells?.length || 0, 'cells')
    
    // Always create a 100x20 grid, regardless of how many cells are in the database
    const spreadsheetData = this.createEmptyGrid(100, 20)
    
    if (!cells || cells.length === 0) {
      console.log('📝 No cells found, returning empty grid')
      return spreadsheetData
    }
    
    // Fill in the actual cell data
    cells.forEach(cell => {
      console.log('📝 Processing cell:', { 
        row: cell.row_index, 
        col: cell.col_index, 
        value: cell.display_value, 
        formula: cell.formula 
      })
      // For formulas, use the formula as the value, for others use display_value
      const cellValue = cell.formula || cell.display_value || ''
      
      const cellData = {
        value: cellValue,
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
        console.log('✅ Placing cell in grid:', { 
          row: cell.row_index, 
          col: cell.col_index, 
          value: cellData.value 
        })
        spreadsheetData[cell.row_index][cell.col_index] = cellData
      } else {
        console.log('❌ Cell outside grid bounds:', { 
          row: cell.row_index, 
          col: cell.col_index 
        })
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
