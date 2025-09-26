import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield } from 'lucide-react'

const LoginPage = () => {
  const { user, error } = useAuth()
  const navigate = useNavigate()
  const googleButtonRef = useRef(null)

  // Redirect to app if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/app')
    }
  }, [user, navigate])

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 flex items-center justify-center mb-3">
            <svg fill="#000000" height="48px" width="48px" viewBox="0 0 470 470" xmlns="http://www.w3.org/2000/svg">
              <path d="M464.37,227.737l-137.711-35.46l55.747-94.413c1.74-2.946,1.265-6.697-1.155-9.117c-2.42-2.42-6.169-2.894-9.117-1.154
                l-94.413,55.747L242.263,5.63C241.41,2.316,238.422,0,235,0s-6.41,2.316-7.263,5.63l-35.46,137.711L97.865,87.593
                c-2.947-1.742-6.697-1.267-9.117,1.154c-2.419,2.42-2.895,6.171-1.155,9.117l55.747,94.413L5.63,227.737
                C2.316,228.59,0,231.578,0,235s2.316,6.41,5.63,7.263l137.711,35.46l-55.747,94.413c-1.74,2.946-1.265,6.697,1.155,9.117
                c1.445,1.445,3.365,2.196,5.306,2.196c1.308,0,2.625-0.342,3.811-1.042l94.413-55.747l35.46,137.71
                c0.854,3.313,3.841,5.63,7.263,5.63s6.41-2.316,7.263-5.63l35.46-137.711l94.413,55.748c1.187,0.701,2.503,1.042,3.811,1.042
                c1.94,0,3.86-0.751,5.306-2.196c2.419-2.42,2.895-6.171,1.155-9.117l-55.747-94.413l137.71-35.46
                c3.314-0.853,5.63-3.841,5.63-7.263S467.684,228.59,464.37,227.737z M287.743,287.744l23.796-6.128l43.142,73.065l-73.065-43.143
                L287.743,287.744z M313.44,265.638c-0.035,0.009-0.07,0.019-0.106,0.027l-29.473,7.59l-22.344-22.345
                c-2.929-2.928-7.678-2.928-10.606,0c-2.929,2.93-2.929,7.678,0,10.607l22.344,22.344l-7.59,29.478
                c-0.008,0.033-0.018,0.065-0.025,0.099L235,432.423l-30.644-119.01c-0.004-0.016-7.61-29.552-7.61-29.552l87.115-87.116
                l29.302,7.546c0.047,0.012,119.26,30.709,119.26,30.709L313.44,265.638z M287.743,182.256l-6.127-23.795l73.065-43.143
                l-43.142,73.064L287.743,182.256z M265.644,156.587c0.004,0.016,7.61,29.552,7.61,29.552L235,224.393l-38.254-38.254l7.59-29.478
                c0.008-0.033,0.018-0.065,0.025-0.099L235,37.577L265.644,156.587z M182.257,182.256l-23.796,6.128l-43.142-73.065l73.065,43.143
                L182.257,182.256z M186.139,196.745L224.393,235l-38.254,38.255L37.577,235L186.139,196.745z M182.257,287.744l6.127,23.795
                l-73.065,43.143l43.142-73.064L182.257,287.744z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome to Zenith</h2>
          <p className="text-gray-600 text-sm">Sign in to access your application</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {/* Security Notice */}
          <div className="flex justify-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full max-w-[400px] min-w-[300px]">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Secure Access Required</p>
                  <p>Please sign in with your Google account to access the application.</p>
                </div>
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

          {/* Terms and Conditions */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 text-center">
              By signing in, you agree to our{' '}
              <span className="text-blue-600 underline cursor-pointer">
                Terms of Service
              </span>{' '}
              and{' '}
              <span className="text-blue-600 underline cursor-pointer">
                Privacy Policy
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p></p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
