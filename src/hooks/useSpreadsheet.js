import { useState, useEffect, useCallback } from 'react'
import { spreadsheetService, cellService } from '../lib/supabase'

export const useSpreadsheet = (spreadsheetId, userId) => {
  const [spreadsheet, setSpreadsheet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Load spreadsheet data
  const loadSpreadsheet = useCallback(async () => {
    if (!spreadsheetId || !userId) return

    try {
      setLoading(true)
      setError(null)
      
      // Load spreadsheet metadata
      const spreadsheetData = await spreadsheetService.getSpreadsheet(spreadsheetId, userId)
      
      // Load cells using the spreadsheet_cells table (primary storage)
      const cells = await cellService.loadSpreadsheetCells(spreadsheetId)
      
      // Convert cells to spreadsheet format (will create empty grid if no cells)
      const cellData = cellService.convertCellsToSpreadsheetFormat(cells)
      
      // Combine spreadsheet metadata with cell data
      const combinedData = {
        ...spreadsheetData,
        data: cellData
      }
      setSpreadsheet(combinedData)
    } catch (err) {
      console.error('Error loading spreadsheet:', err)
      setError('Failed to load spreadsheet')
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId, userId])

  // Save spreadsheet data
  const saveSpreadsheet = useCallback(async (newData) => {
    if (!spreadsheetId || !userId) return

    try {
      setSaving(true)
      setError(null)
      
      // Save cells using the spreadsheet_cells table (primary storage)
      await cellService.saveCells(spreadsheetId, newData)
      
      // Update spreadsheet metadata (only timestamp, data is in cells table)
      await spreadsheetService.updateSpreadsheetData(
        spreadsheetId,
        userId
      )
      
      // Don't update the spreadsheet object since data is stored in cells table
      // This prevents overwriting the local data with old database data
    } catch (err) {
      console.error('Error saving spreadsheet:', err)
      setError('Failed to save spreadsheet')
      throw err
    } finally {
      setSaving(false)
    }
  }, [spreadsheetId, userId])

  // Update spreadsheet name
  const updateName = useCallback(async (newName) => {
    if (!spreadsheetId || !userId) return

    try {
      setError(null)
      const updatedSpreadsheet = await spreadsheetService.updateSpreadsheetName(
        spreadsheetId,
        userId,
        newName
      )
      setSpreadsheet(updatedSpreadsheet)
    } catch (err) {
      console.error('Error updating spreadsheet name:', err)
      setError('Failed to update spreadsheet name')
      throw err
    }
  }, [spreadsheetId, userId])

  // Load spreadsheet on mount or when dependencies change
  useEffect(() => {
    loadSpreadsheet()
  }, [loadSpreadsheet])

  // Set up real-time subscription
  useEffect(() => {
    if (!spreadsheetId) return

    const subscription = spreadsheetService.subscribeToSpreadsheet(
      spreadsheetId,
      (payload) => {
        // Only update if the change came from another user
        if (payload.new && payload.new.user_id !== userId) {
          setSpreadsheet(payload.new)
        }
      }
    )

    return () => {
      spreadsheetService.unsubscribe(subscription)
    }
  }, [spreadsheetId, userId])

  return {
    spreadsheet,
    loading,
    error,
    saving,
    saveSpreadsheet,
    updateName,
    reload: loadSpreadsheet
  }
}

// Hook for managing user's spreadsheets list
export const useUserSpreadsheets = (userId) => {
  const [spreadsheets, setSpreadsheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadSpreadsheets = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const data = await spreadsheetService.getUserSpreadsheets(userId)
      setSpreadsheets(data || [])
    } catch (err) {
      console.error('useUserSpreadsheets: Error loading spreadsheets:', err)
      setError('Failed to load spreadsheets')
      setSpreadsheets([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }, [userId])

  const createSpreadsheet = useCallback(async (name = 'Untitled Spreadsheet') => {
    if (!userId) return

    try {
      setError(null)
      const newSpreadsheet = await spreadsheetService.createSpreadsheet(userId, name)
      setSpreadsheets(prev => [newSpreadsheet, ...prev])
      return newSpreadsheet
    } catch (err) {
      console.error('Error creating spreadsheet:', err)
      setError('Failed to create spreadsheet')
      throw err
    }
  }, [userId])

  const deleteSpreadsheet = useCallback(async (spreadsheetId) => {
    if (!userId) return

    try {
      setError(null)
      await spreadsheetService.deleteSpreadsheet(spreadsheetId, userId)
      setSpreadsheets(prev => prev.filter(s => s.id !== spreadsheetId))
    } catch (err) {
      console.error('Error deleting spreadsheet:', err)
      setError('Failed to delete spreadsheet')
      throw err
    }
  }, [userId])

  const renameSpreadsheet = useCallback(async (spreadsheetId, newName) => {
    if (!userId) return

    try {
      setError(null)
      const updatedSpreadsheet = await spreadsheetService.updateSpreadsheetName(
        spreadsheetId,
        userId,
        newName
      )
      setSpreadsheets(prev => 
        prev.map(s => s.id === spreadsheetId ? updatedSpreadsheet : s)
      )
      return updatedSpreadsheet
    } catch (err) {
      console.error('Error renaming spreadsheet:', err)
      setError('Failed to rename spreadsheet')
      throw err
    }
  }, [userId])

  useEffect(() => {
    loadSpreadsheets()
  }, [loadSpreadsheets])

  return {
    spreadsheets,
    loading,
    error,
    createSpreadsheet,
    deleteSpreadsheet,
    renameSpreadsheet,
    reload: loadSpreadsheets
  }
}
