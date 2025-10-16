import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { createSpreadsheetForUser, getUserSpreadsheet } from '../api/sheets.js'
import { ExternalLink, FileSpreadsheet, Plus } from 'lucide-react'

const UserSpreadsheetManager = ({ 
  userId, 
  userEmail, 
  onSpreadsheetCreated 
}) => {
  const [userSpreadsheet, setUserSpreadsheet] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user already has a spreadsheet
  const checkUserSpreadsheet = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const result = await getUserSpreadsheet(userId)
      
      if (result.success) {
        setUserSpreadsheet(result)
        console.log('✅ User already has a spreadsheet:', result)
      } else {
        console.log('No existing spreadsheet found for user')
        setUserSpreadsheet(null)
      }
    } catch (error) {
      console.error('Error checking user spreadsheet:', error)
      setError('Failed to check existing spreadsheet')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Create new spreadsheet for user
  const createSpreadsheet = useCallback(async () => {
    if (!userId || !userEmail) {
      setError('User ID or email not available')
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      
      const result = await createSpreadsheetForUser(
        userId,
        userEmail,
        'Zenith Spreadsheet'
      )

      if (result.success) {
        setUserSpreadsheet(result)
        console.log('✅ Created new spreadsheet for user:', result)
        
        if (onSpreadsheetCreated) {
          onSpreadsheetCreated(result)
        }
      } else {
        setError(`Failed to create spreadsheet: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating spreadsheet:', error)
      setError(`Failed to create spreadsheet: ${error.message}`)
    } finally {
      setIsCreating(false)
    }
  }, [userId, userEmail, onSpreadsheetCreated])

  // Check for existing spreadsheet on mount
  useEffect(() => {
    checkUserSpreadsheet()
  }, [checkUserSpreadsheet])

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">Checking Google Sheets...</h3>
            <p className="text-xs text-gray-500">Looking for your spreadsheet</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-900">Google Sheets Error</h3>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
          <button
            onClick={createSpreadsheet}
            disabled={isCreating}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs hover:bg-red-700 disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  if (!userSpreadsheet) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Google Sheets Integration</h3>
              <p className="text-xs text-gray-500">Create your personal spreadsheet</p>
            </div>
          </div>
          <button
            onClick={createSpreadsheet}
            disabled={isCreating}
            className="px-3 py-1.5 bg-green-600 text-white rounded-md text-xs hover:bg-green-700 disabled:opacity-50 flex items-center space-x-1"
          >
            <Plus className="w-3 h-3" />
            <span>{isCreating ? 'Creating...' : 'Create Sheet'}</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">Google Sheets Connected</h3>
            <p className="text-xs text-gray-500">{userSpreadsheet.name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <a
            href={userSpreadsheet.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 flex items-center space-x-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open Sheet</span>
          </a>
        </div>
      </div>
    </div>
  )
}

UserSpreadsheetManager.propTypes = {
  userId: PropTypes.string,
  userEmail: PropTypes.string,
  onSpreadsheetCreated: PropTypes.func
}

export default UserSpreadsheetManager

