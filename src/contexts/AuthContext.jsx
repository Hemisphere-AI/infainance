import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { AuthContext } from './AuthContext'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize Google Sign-In
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts) {
        try {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          })
          
          // Check if user is already signed in (from localStorage)
          const savedUser = localStorage.getItem('user')
          if (savedUser) {
            setUser(JSON.parse(savedUser))
          }
          
          setLoading(false)
        } catch (err) {
          console.error('Error initializing Google Sign-In:', err)
          setError('Failed to initialize authentication')
          setLoading(false)
        }
      } else {
        // Retry if Google API not loaded yet
        setTimeout(initializeGoogleSignIn, 100)
      }
    }

    initializeGoogleSignIn()
  }, [])

  // Handle the credential response from Google
  const handleCredentialResponse = async (response) => {
    try {
      setLoading(true)
      setError(null)
      
      // Decode the JWT token to get user info
      const tokenPayload = JSON.parse(atob(response.credential.split('.')[1]))
      
      const userData = {
        id: tokenPayload.sub,
        name: tokenPayload.name,
        email: tokenPayload.email,
        picture: tokenPayload.picture,
        credential: response.credential
      }
      
      // Save user data
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      
      console.log('User signed in:', userData)
    } catch (err) {
      console.error('Error handling credential response:', err)
      setError('Failed to sign in with Google')
    } finally {
      setLoading(false)
    }
  }

  // Sign out function
  const signOut = () => {
    try {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.disableAutoSelect()
      }
      
      setUser(null)
      localStorage.removeItem('user')
      console.log('User signed out')
      
      // Redirect to landing page after sign out
      window.location.href = '/'
    } catch (err) {
      console.error('Error signing out:', err)
      setError('Failed to sign out')
    }
  }

  // Trigger Google Sign-In
  const signIn = () => {
    try {
      setError(null)
      if (window.google && window.google.accounts) {
        window.google.accounts.id.prompt()
      } else {
        setError('Google Sign-In not available')
      }
    } catch (err) {
      console.error('Error triggering sign in:', err)
      setError('Failed to initiate sign in')
    }
  }

  const value = {
    user,
    loading,
    error,
    signIn,
    signOut,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
}
