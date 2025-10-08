import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { googleOAuthService } from '../services/googleOAuthService.js'
import { googleSheetsService } from '../services/googleSheetsService.js'

const GoogleOAuthCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Processing...')
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        if (error) {
          setError(`OAuth error: ${error}`)
          setStatus('Authentication failed')
          return
        }

        if (!code) {
          setError('No authorization code received')
          setStatus('Authentication failed')
          return
        }

        setStatus('Exchanging code for tokens...')
        
        // Exchange code for tokens
        const result = await googleOAuthService.handleCallback(code)
        
        if (result.success) {
          setStatus('Initializing Google Sheets service...')
          
          // Initialize the Google Sheets service
          const initResult = await googleSheetsService.initializeAuth()
          
          if (initResult.success) {
            setStatus('Authentication successful!')
            setTimeout(() => {
              navigate('/app')
            }, 2000)
          } else {
            setError(`Failed to initialize Google Sheets service: ${initResult.error}`)
            setStatus('Initialization failed')
          }
        } else {
          setError(`Token exchange failed: ${result.error}`)
          setStatus('Authentication failed')
        }
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError(`Unexpected error: ${err.message}`)
        setStatus('Authentication failed')
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Google Sheets Authentication
          </h2>
          
          <p className="text-gray-600 mb-4">
            {status}
          </p>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {!error && status === 'Authentication successful!' && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-600">
                You can now use Google Sheets integration features.
              </p>
            </div>
          )}
          
          <div className="mt-6">
            <button
              onClick={() => navigate('/app')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Continue to App
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoogleOAuthCallback

