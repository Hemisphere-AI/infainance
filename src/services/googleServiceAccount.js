/**
 * Google Service Account Service for Option A (Central Sheet Ownership)
 * This is a client-side wrapper that calls backend API endpoints
 * The actual service account authentication happens on the server
 */

class GoogleServiceAccountService {
  constructor() {
    this.initialized = false
    this.baseUrl = '' // Use Netlify Functions
  }

  /**
   * Initialize the service (no auth needed on client side)
   */
  async initialize() {
    this.initialized = true
    console.log('✅ Google Service Account client initialized')
  }

  /**
   * Create a new spreadsheet for a user
   * This calls the backend API which handles service account authentication
   */
  async createSpreadsheetForUser(userId, userEmail, spreadsheetName = 'Zenith Spreadsheet') {
    await this.initialize()

    try {
      console.log(`📊 Creating spreadsheet for user ${userId} (${userEmail})`)

      // Call backend API to create spreadsheet
      const response = await fetch(`${this.baseUrl}/api/sheets/create-for-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userEmail,
          spreadsheetName
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ Created spreadsheet: ${result.spreadsheetId}`)
      }

      return result
    } catch (error) {
      console.error('❌ Error creating spreadsheet for user:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Read data from spreadsheet
   */
  async readSpreadsheet(spreadsheetId, range = 'A1:Z1000') {
    await this.initialize()

    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/read?spreadsheetId=${spreadsheetId}&range=${encodeURIComponent(range)}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ Error reading spreadsheet:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get spreadsheet metadata (including last modified date)
   */
  async getSpreadsheetMetadata(spreadsheetId) {
    await this.initialize()

    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/metadata?spreadsheetId=${spreadsheetId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ Error getting spreadsheet metadata:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Check if sync is needed based on last modified date
   */
  async checkSyncNeeded(spreadsheetId, lastKnownModified) {
    try {
      const metadata = await this.getSpreadsheetMetadata(spreadsheetId)
      
      if (!metadata.success) {
        return { needsSync: false, error: metadata.error }
      }

      const googleLastModified = new Date(metadata.lastModified)
      const knownLastModified = new Date(lastKnownModified)
      
      const needsSync = googleLastModified > knownLastModified
      
      return {
        needsSync,
        lastModified: metadata.lastModified,
        timeDiff: googleLastModified - knownLastModified
      }
    } catch (error) {
      console.error('❌ Error checking sync status:', error)
      return { needsSync: false, error: error.message }
    }
  }

  /**
   * Auto-sync with smart detection
   */
  async autoSyncFromGoogleSheets(spreadsheetId, userId, lastKnownModified) {
    await this.initialize()

    try {
      console.log(`🔍 Checking if sync is needed for: ${spreadsheetId}`)
      
      // Check if sync is needed
      const syncCheck = await this.checkSyncNeeded(spreadsheetId, lastKnownModified)
      
      if (!syncCheck.needsSync) {
        console.log('✅ No sync needed - Google Sheets is up to date')
        return {
          success: true,
          synced: false,
          message: 'No changes detected'
        }
      }

      console.log(`🔄 Changes detected! Last modified: ${syncCheck.lastModified}`)
      console.log(`⏰ Time difference: ${Math.round(syncCheck.timeDiff / 1000)}s ago`)
      
      // Proceed with sync
      return await this.syncFromGoogleSheets(spreadsheetId, userId)
    } catch (error) {
      console.error('❌ Error in auto-sync:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Sync data from Google Sheets back to database
   */
  async syncFromGoogleSheets(spreadsheetId, userId) {
    await this.initialize()

    try {
      console.log(`🔄 Syncing from Google Sheets: ${spreadsheetId}`)
      
      // Read data from Google Sheets
      const result = await this.readSpreadsheet(spreadsheetId, 'A1:Z1000')
      
      if (!result.success || !result.values) {
        throw new Error('Failed to read from Google Sheets')
      }

      // Convert Google Sheets data to our database format
      const cellsData = []
      result.values.forEach((row, rowIndex) => {
        row.forEach((cellValue, colIndex) => {
          if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
            cellsData.push({
              spreadsheet_id: spreadsheetId,
              row_index: rowIndex,
              col_index: colIndex,
              display_value: cellValue.toString(),
              cell_type: typeof cellValue === 'number' ? 'number' : 'text',
              formula: cellValue.toString().startsWith('=') ? cellValue.toString() : null
            })
          }
        })
      })

      // Save to database via API
      const response = await fetch(`${this.baseUrl}/api/sheets/sync-from-google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId,
          userId,
          cellsData
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const syncResult = await response.json()
      console.log(`✅ Synced ${cellsData.length} cells from Google Sheets`)
      
      return syncResult
    } catch (error) {
      console.error('❌ Error syncing from Google Sheets:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Write data to spreadsheet
   */
  async writeToSpreadsheet(spreadsheetId, range, values) {
    await this.initialize()

    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId,
          range,
          values
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ Updated spreadsheet ${spreadsheetId} at range ${range}`)
      }

      return result
    } catch (error) {
      console.error('❌ Error writing to spreadsheet:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Update a single cell
   */
  async updateCell(spreadsheetId, rowIndex, colIndex, value) {
    const range = this.indexToA1(rowIndex, colIndex)
    return await this.writeToSpreadsheet(spreadsheetId, range, [[value]])
  }

  /**
   * Convert row/col indices to A1 notation
   */
  indexToA1(rowIndex, colIndex) {
    const colLetter = this.numberToColumnLetter(colIndex + 1)
    const rowNumber = rowIndex + 1
    return `${colLetter}${rowNumber}`
  }

  /**
   * Convert column number to letter (1 = A, 2 = B, etc.)
   */
  numberToColumnLetter(num) {
    let result = ''
    while (num > 0) {
      num--
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26)
    }
    return result
  }

  /**
   * Batch update multiple cells
   */
  async batchUpdate(spreadsheetId, updates) {
    await this.initialize()

    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId,
          updates
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ Batch updated ${updates.length} cells in spreadsheet ${spreadsheetId}`)
      }

      return result
    } catch (error) {
      console.error('❌ Error batch updating spreadsheet:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

// Create singleton instance
export const googleServiceAccount = new GoogleServiceAccountService()
