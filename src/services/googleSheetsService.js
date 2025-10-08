import { googleOAuthService } from './googleOAuthService.js'

/**
 * Google Sheets Service for bidirectional sync
 * Handles writing data back to Google Sheets when AI updates cells
 */

export class GoogleSheetsService {
  constructor() {
    this.isAuthenticated = false
  }

  /**
   * Initialize authentication using OAuth service
   */
  async initializeAuth() {
    try {
      if (googleOAuthService.isAuthenticated()) {
        this.isAuthenticated = true
        return { success: true }
      }
      return { success: false, error: 'Not authenticated' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Check if service is authenticated
   */
  isReady() {
    return this.isAuthenticated && googleOAuthService.isAuthenticated()
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
   * Update a single cell in Google Sheets
   */
  async updateCell(spreadsheetId, rowIndex, colIndex, value) {
    if (!this.isReady()) {
      console.warn('GoogleSheetsService: Not authenticated, skipping update')
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const accessToken = await googleOAuthService.getValidAccessToken()
      const range = this.indexToA1(rowIndex, colIndex)
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[value]]
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Google Sheets API error:', errorData)
        return { success: false, error: errorData.error?.message || 'Unknown error' }
      }

      console.log(`✅ Updated cell ${range} in Google Sheets:`, value)
      return { success: true }
    } catch (error) {
      console.error('Error updating Google Sheets cell:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update multiple cells in a batch
   */
  async updateCells(spreadsheetId, updates) {
    if (!this.isReady()) {
      console.warn('GoogleSheetsService: Not authenticated, skipping batch update')
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const accessToken = await googleOAuthService.getValidAccessToken()
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`

      const requests = updates.map(update => ({
        range: this.indexToA1(update.rowIndex, update.colIndex),
        values: [[update.value]]
      }))

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: requests
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Google Sheets batch update error:', errorData)
        return { success: false, error: errorData.error?.message || 'Unknown error' }
      }

      console.log(`✅ Updated ${updates.length} cells in Google Sheets`)
      return { success: true }
    } catch (error) {
      console.error('Error batch updating Google Sheets:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get cell value from Google Sheets
   */
  async getCell(spreadsheetId, rowIndex, colIndex) {
    if (!this.isReady()) {
      console.warn('GoogleSheetsService: Not authenticated, skipping get')
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const accessToken = await googleOAuthService.getValidAccessToken()
      const range = this.indexToA1(rowIndex, colIndex)
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Google Sheets API error:', errorData)
        return { success: false, error: errorData.error?.message || 'Unknown error' }
      }

      const data = await response.json()
      const value = data.values?.[0]?.[0] || ''
      return { success: true, value }
    } catch (error) {
      console.error('Error getting Google Sheets cell:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Create a new spreadsheet in the same Google Drive folder as the source sheet
   */
  async createSpreadsheetInFolder(sourceSpreadsheetId, newSpreadsheetName) {
    if (!this.isReady()) {
      console.warn('GoogleSheetsService: Not authenticated, cannot create spreadsheet')
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const accessToken = await googleOAuthService.getValidAccessToken()
      
      // First, get the source spreadsheet to find its parent folder
      const sourceUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sourceSpreadsheetId}`
      const sourceResponse = await fetch(sourceUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      })

      if (!sourceResponse.ok) {
        throw new Error('Failed to get source spreadsheet info')
      }

      const sourceData = await sourceResponse.json()
      const parentFolderId = sourceData.properties?.folderId

      // Create new spreadsheet
      const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets'
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: newSpreadsheetName
          }
        })
      })

      if (!createResponse.ok) {
        throw new Error('Failed to create new spreadsheet')
      }

      const newSpreadsheet = await createResponse.json()
      const newSpreadsheetId = newSpreadsheet.spreadsheetId

      // If we found a parent folder, move the new spreadsheet there
      if (parentFolderId) {
        await this.moveSpreadsheetToFolder(newSpreadsheetId, parentFolderId, accessToken)
      }

      console.log(`✅ Created new spreadsheet: ${newSpreadsheetName} (ID: ${newSpreadsheetId})`)
      return { 
        success: true, 
        spreadsheetId: newSpreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`
      }
    } catch (error) {
      console.error('Error creating spreadsheet in folder:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Move a spreadsheet to a specific Google Drive folder
   */
  async moveSpreadsheetToFolder(spreadsheetId, folderId, accessToken) {
    try {
      // Use Google Drive API to move the file
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`
      
      // First get current parents
      const getResponse = await fetch(`${driveUrl}?fields=parents`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      })

      if (!getResponse.ok) {
        console.warn('Could not get current parents, skipping folder move')
        return
      }

      const fileData = await getResponse.json()
      const currentParents = fileData.parents || []

      // Move to new folder
      const moveResponse = await fetch(`${driveUrl}?addParents=${folderId}&removeParents=${currentParents.join(',')}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      })

      if (moveResponse.ok) {
        console.log(`✅ Moved spreadsheet to folder: ${folderId}`)
      } else {
        console.warn('Could not move spreadsheet to folder')
      }
    } catch (error) {
      console.warn('Error moving spreadsheet to folder:', error)
    }
  }
}

// Create a singleton instance
export const googleSheetsService = new GoogleSheetsService()
