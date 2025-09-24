import React, { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Shield, Check } from 'lucide-react'

const LoginPage = () => {
  const { error } = useAuth()
  const googleButtonRef = useRef(null)

  useEffect(() => {
    // Render Google Sign-In button with custom styling
    if (window.google && window.google.accounts && googleButtonRef.current) {
      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 400
        }
      )
      
      // Apply custom styling after Google button is rendered
      setTimeout(() => {
        const googleButton = googleButtonRef.current?.querySelector('div[role="button"]')
        if (googleButton) {
          googleButton.style.cssText = `
            width: 100% !important;
            max-width: 400px !important;
            min-width: 300px !important;
            background: white !important;
            border: 1px solid #d1d5db !important;
            border-radius: 8px !important;
            padding: 12px 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            color: #374151 !important;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
          `
          
          // Add hover effect
          googleButton.addEventListener('mouseenter', () => {
            googleButton.style.backgroundColor = '#f9fafb'
            googleButton.style.borderColor = '#9ca3af'
          })
          
          googleButton.addEventListener('mouseleave', () => {
            googleButton.style.backgroundColor = 'white'
            googleButton.style.borderColor = '#d1d5db'
          })
        }
      }, 100)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
            <div className="relative w-8 h-8">
              {/* 4-point star with central square and triangular points */}
              {/* Central square */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white"></div>
              {/* Top point */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"></div>
              {/* Bottom point */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-white"></div>
              {/* Left point */}
              <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-0 h-0 border-t-[4px] border-b-[4px] border-r-[8px] border-t-transparent border-b-transparent border-r-white"></div>
              {/* Right point */}
              <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-0 h-0 border-t-[4px] border-b-[4px] border-l-[8px] border-t-transparent border-b-transparent border-l-white"></div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Zenith</h2>
          <p className="text-gray-600">Sign in to access your application</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Secure Access Required</p>
                <p>Please sign in with your Google account to access the application.</p>
              </div>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <div className="flex justify-center">
            <div ref={googleButtonRef} className="custom-google-button"></div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-red-600 mt-0.5">⚠️</div>
                <div className="text-sm text-red-700">
                  <p className="font-medium">Authentication Error</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">What you get access to:</h4>
            <div className="space-y-2">
              {[
                'AI-powered data analysis',
                'Smart spreadsheet tools',
                'Real-time collaboration',
                'Secure data processing'
              ].map((feature, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Your data is processed securely and never stored on our servers</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
