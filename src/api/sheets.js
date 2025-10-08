/**
 * API endpoints for Google Sheets management (Option A - Service Account)
 */

import { googleServiceAccount } from '../services/googleServiceAccount.js'
import { supabase } from '../lib/supabase.js'

/**
 * Create a new spreadsheet for a user
 */
export async function createSpreadsheetForUser(userId, userEmail, spreadsheetName) {
  try {
    console.log(`📊 Creating spreadsheet for user ${userId}`)

    // Create spreadsheet via service account
    const result = await googleServiceAccount.createSpreadsheetForUser(
      userId,
      userEmail,
      spreadsheetName || 'Zenith Spreadsheet'
    )

    if (!result.success) {
      throw new Error(result.error)
    }

    // Store mapping in database
    const { error: dbError } = await supabase
      .from('spreadsheets')
      .upsert({
        id: userId, // Use userId as the primary key for this mapping
        user_id: userId,
        name: result.name,
        google_sheet_id: result.spreadsheetId,
        google_sheet_url: `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (dbError) {
      console.error('❌ Error storing spreadsheet mapping:', dbError)
      throw dbError
    }

    console.log(`✅ Spreadsheet created and stored for user ${userId}`)
    return {
      success: true,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      name: result.name
    }
  } catch (error) {
    console.error('❌ Error in createSpreadsheetForUser:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get user's spreadsheet
 */
export async function getUserSpreadsheet(userId) {
  try {
    const { data, error } = await supabase
      .from('spreadsheets')
      .select('google_sheet_id, name')
      .eq('user_id', userId)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      spreadsheetId: data.google_sheet_id,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${data.google_sheet_id}/edit`,
      name: data.name
    }
  } catch (error) {
    console.error('❌ Error getting user spreadsheet:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Read data from user's spreadsheet
 */
export async function readUserSpreadsheet(userId, range = 'A1:Z1000') {
  try {
    // Get user's spreadsheet ID
    const userSheet = await getUserSpreadsheet(userId)
    if (!userSheet.success) {
      return userSheet
    }

    // Read from Google Sheets
    return await googleServiceAccount.readSpreadsheet(userSheet.spreadsheetId, range)
  } catch (error) {
    console.error('❌ Error reading user spreadsheet:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Write data to user's spreadsheet
 */
export async function writeToUserSpreadsheet(userId, range, values) {
  try {
    // Get user's spreadsheet ID
    const userSheet = await getUserSpreadsheet(userId)
    if (!userSheet.success) {
      return userSheet
    }

    // Write to Google Sheets
    return await googleServiceAccount.writeToSpreadsheet(userSheet.spreadsheetId, range, values)
  } catch (error) {
    console.error('❌ Error writing to user spreadsheet:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Update a single cell in user's spreadsheet
 */
export async function updateUserCell(userId, rowIndex, colIndex, value) {
  try {
    // Get user's spreadsheet ID
    const userSheet = await getUserSpreadsheet(userId)
    if (!userSheet.success) {
      return userSheet
    }

    // Update cell in Google Sheets
    return await googleServiceAccount.updateCell(userSheet.spreadsheetId, rowIndex, colIndex, value)
  } catch (error) {
    console.error('❌ Error updating user cell:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Batch update multiple cells in user's spreadsheet
 */
export async function batchUpdateUserCells(userId, updates) {
  try {
    // Get user's spreadsheet ID
    const userSheet = await getUserSpreadsheet(userId)
    if (!userSheet.success) {
      return userSheet
    }

    // Batch update in Google Sheets
    return await googleServiceAccount.batchUpdate(userSheet.spreadsheetId, updates)
  } catch (error) {
    console.error('❌ Error batch updating user cells:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

