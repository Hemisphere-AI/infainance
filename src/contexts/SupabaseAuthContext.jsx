import React, { createContext, useContext, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase, userService } from '../lib/supabase'

const SupabaseAuthContext = createContext()

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 SupabaseAuthContext: Initial session check:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email 
      })
      
      if (session?.user) {
        setUser(session.user)
        console.log('✅ SupabaseAuthContext: User authenticated, ensuring profile exists')
        
        // Manually ensure user profile exists since trigger might not be working
        setTimeout(() => {
          userService.upsertUserProfile({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email
          }).then(() => {
            console.log('✅ SupabaseAuthContext: User profile created/updated in initial session')
          }).catch((err) => {
            console.error('❌ SupabaseAuthContext: Error creating user profile in initial session:', err)
          })
        }, 1000)
      }
      
      setLoading(false)
    }).catch((error) => {
      console.error('❌ SupabaseAuthContext: Error getting session:', error)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 SupabaseAuthContext: Auth state change:', { 
          event, 
          hasSession: !!session, 
          hasUser: !!session?.user,
          userId: session?.user?.id,
          email: session?.user?.email 
        })
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('🎉 SupabaseAuthContext: User successfully signed in!')
          setUser(session.user)
          
          // Manually ensure user profile exists since trigger might not be working
          setTimeout(() => {
            userService.upsertUserProfile({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || session.user.email
            }).then(() => {
              console.log('✅ SupabaseAuthContext: User profile created/updated manually')
            }).catch((err) => {
              console.error('❌ SupabaseAuthContext: Error creating user profile manually:', err)
            })
          }, 1000)
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 SupabaseAuthContext: User signed out')
          setUser(null)
        } else if (session?.user) {
          console.log('✅ SupabaseAuthContext: User authenticated in auth change, letting trigger handle profile creation')
          setUser(session.user)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🚀 SupabaseAuthContext: Starting Google OAuth sign in...')
      console.log('🚀 SupabaseAuthContext: Redirect URL:', `${window.location.origin}/app`)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })
      
      if (error) {
        console.error('❌ SupabaseAuthContext: OAuth error:', error)
        setError('Failed to sign in with Google: ' + error.message)
      } else {
        console.log('✅ SupabaseAuthContext: OAuth initiated successfully:', data)
      }
    } catch (err) {
      console.error('❌ SupabaseAuthContext: Error signing in with Google:', err)
      setError('Failed to sign in with Google: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      // Redirect to landing page
      window.location.href = '/'
    } catch (err) {
      console.error('Error signing out:', err)
      setError('Failed to sign out')
    }
  }

  const value = {
    user,
    loading,
    error,
    signIn: signInWithGoogle,
    signOut,
    isAuthenticated: !!user
  }

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  )
}

SupabaseAuthProvider.propTypes = {
  children: PropTypes.node.isRequired
}

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext)
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider')
  }
  return context
}