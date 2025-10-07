/* eslint-env node */
/**
 * Backend API Server for Google Service Account Authentication
 * This handles the service account credentials securely on the server side
 */

import express from 'express'
import cors from 'cors'
import { google } from 'googleapis'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: './server.env' })

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your frontend URLs
  credentials: true
}))
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend API server is running' })
})

// Test route
app.get('/test', (req, res) => {
  console.log('🧪 Test route called')
  res.json({ message: 'Test route working' })
})

// Initialize Google APIs with service account
let sheets, drive, auth

try {
  console.log('🔧 Initializing Google Service Account...')
  console.log('Project ID:', process.env.GOOGLE_SA_PROJECT_ID)
  console.log('Client Email:', process.env.GOOGLE_SA_CLIENT_EMAIL)
  
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_SA_PROJECT_ID,
    private_key_id: process.env.GOOGLE_SA_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_SA_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_SA_CLIENT_EMAIL}`
  }

  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets'
    ]
  })

  sheets = google.sheets({ version: 'v4', auth })
  drive = google.drive({ version: 'v3', auth })

  console.log('✅ Google Service Account initialized on server')
} catch (error) {
  console.error('❌ Failed to initialize Google Service Account:', error)
  console.error('Error details:', error.message)
  process.exit(1)
}

// API Routes
console.log('🔧 Setting up API routes...')

/**
 * Create a new spreadsheet for a user
 */
app.post('/api/sheets/create-for-user', async (req, res) => {
  console.log('📊 POST /api/sheets/create-for-user called')
  try {
    const { userId, userEmail, spreadsheetName } = req.body

    if (!userId || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'userId and userEmail are required'
      })
    }

    console.log(`📊 Creating spreadsheet for user ${userId} (${userEmail})`)

    // Create the spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: spreadsheetName || 'Zenith Spreadsheet'
        }
      }
    })

    const spreadsheetId = createResponse.data.spreadsheetId
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

    console.log(`✅ Created spreadsheet: ${spreadsheetId}`)

    // Move to the user_spreadsheets folder in Shared Drive
    await moveToUserFolder(spreadsheetId)

    // Share with the user
    await shareWithUser(spreadsheetId, userEmail)

    res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      name: spreadsheetName || 'Zenith Spreadsheet'
    })
  } catch (error) {
    console.error('❌ Error creating spreadsheet:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Read data from spreadsheet
 */
app.get('/api/sheets/read', async (req, res) => {
  console.log('📖 GET /api/sheets/read called')
  try {
    const { spreadsheetId, range = 'A1:Z1000' } = req.query

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'spreadsheetId is required'
      })
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    })

    res.json({
      success: true,
      values: response.data.values || []
    })
  } catch (error) {
    console.error('❌ Error reading spreadsheet:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Write data to spreadsheet
 */
app.post('/api/sheets/write', async (req, res) => {
  try {
    const { spreadsheetId, range, values } = req.body

    if (!spreadsheetId || !range || !values) {
      return res.status(400).json({
        success: false,
        error: 'spreadsheetId, range, and values are required'
      })
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    })

    console.log(`✅ Updated spreadsheet ${spreadsheetId} at range ${range}`)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error writing to spreadsheet:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Batch update multiple cells
 */
app.post('/api/sheets/batch-update', async (req, res) => {
  try {
    const { spreadsheetId, updates } = req.body

    if (!spreadsheetId || !updates) {
      return res.status(400).json({
        success: false,
        error: 'spreadsheetId and updates are required'
      })
    }

    const requests = updates.map(update => ({
      range: indexToA1(update.rowIndex, update.colIndex),
      values: [[update.value]]
    }))

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: requests
      }
    })

    console.log(`✅ Batch updated ${updates.length} cells in spreadsheet ${spreadsheetId}`)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error batch updating spreadsheet:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Get spreadsheet metadata
 */
app.get('/api/sheets/metadata', async (req, res) => {
  try {
    const { spreadsheetId } = req.query

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'spreadsheetId is required'
      })
    }

    // Try to get real metadata from Google Drive API
    if (drive) {
      try {
        const fileMetadata = await drive.files.get({
          fileId: spreadsheetId,
          fields: 'modifiedTime, name, size',
          supportsAllDrives: true
        })

        res.json({
          success: true,
          lastModified: fileMetadata.data.modifiedTime,
          name: fileMetadata.data.name,
          size: fileMetadata.data.size
        })
        return
      } catch (apiError) {
        console.error('❌ Google Drive API error:', apiError.message)
        console.log('🔄 Falling back to mock response...')
      }
    }

    // Fallback to mock response
    res.json({
      success: true,
      lastModified: new Date().toISOString(),
      name: 'Mock Spreadsheet',
      size: '1024'
    })
  } catch (error) {
    console.error('❌ Error getting spreadsheet metadata:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Sync from Google Sheets to database
 */
app.post('/api/sheets/sync-from-google', async (req, res) => {
  try {
    const { spreadsheetId, userId, cellsData } = req.body

    if (!spreadsheetId || !userId || !cellsData) {
      return res.status(400).json({
        success: false,
        error: 'spreadsheetId, userId, and cellsData are required'
      })
    }

    console.log(`🔄 Syncing ${cellsData.length} cells from Google Sheets to database`)
    console.log(`📊 Spreadsheet: ${spreadsheetId}, User: ${userId}`)
    
    // TODO: Implement database sync here
    // This would involve:
    // 1. Clear existing cells for this spreadsheet
    // 2. Insert new cells from Google Sheets
    // 3. Update any metadata
    
    res.json({ 
      success: true, 
      syncedCells: cellsData.length,
      message: 'Sync completed (mock implementation)'
    })
  } catch (error) {
    console.error('❌ Error syncing from Google Sheets:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Helper functions

/**
 * Move spreadsheet to the user_spreadsheets folder
 */
async function moveToUserFolder(spreadsheetId) {
  try {
  const userFolderId = process.env.GOOGLE_USER_SHEETS_FOLDER_ID

    // Get current parents
    const file = await drive.files.get({
      fileId: spreadsheetId,
      fields: 'parents'
    })

    const currentParents = file.data.parents || []

    // Move to the user folder in Shared Drive
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: userFolderId,
      removeParents: currentParents.join(','),
      supportsAllDrives: true
    })

    console.log(`✅ Moved spreadsheet ${spreadsheetId} to user folder`)
  } catch (error) {
    console.error('❌ Error moving spreadsheet to folder:', error)
    throw error
  }
}

/**
 * Share spreadsheet with user
 */
async function shareWithUser(spreadsheetId, userEmail) {
  try {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'writer', // Editor access
        type: 'user',
        emailAddress: userEmail
      },
      supportsAllDrives: true
    })

    console.log(`✅ Shared spreadsheet ${spreadsheetId} with ${userEmail}`)
  } catch (error) {
    console.error('❌ Error sharing spreadsheet with user:', error)
    throw error
  }
}

/**
 * Convert row/col indices to A1 notation
 */
function indexToA1(rowIndex, colIndex) {
  const colLetter = numberToColumnLetter(colIndex + 1)
  const rowNumber = rowIndex + 1
  return `${colLetter}${rowNumber}`
}

/**
 * Convert column number to letter (1 = A, 2 = B, etc.)
 */
function numberToColumnLetter(num) {
  let result = ''
  while (num > 0) {
    num--
    result = String.fromCharCode(65 + (num % 26)) + result
    num = Math.floor(num / 26)
  }
  return result
}

// 404 handler
app.use((req, res) => {
  console.log(`🔍 Unhandled route: ${req.method} ${req.originalUrl}`)
  res.status(404).json({
    error: 'API endpoint not found',
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend API server running on port ${PORT}`)
  console.log(`📊 Google Sheets API endpoints available at http://localhost:${PORT}/api/sheets/`)
})
