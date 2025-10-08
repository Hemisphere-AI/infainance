/**
 * Google OAuth Service for Google Sheets integration
 * Handles OAuth flow and token management
 */

export class GoogleOAuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    this.redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/oauth2/callback`
    this.scope = 'https://www.googleapis.com/auth/spreadsheets'
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
  }

  /**
   * Check if OAuth is configured
   */
  isConfigured() {
    return !!this.clientId
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl() {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID in .env')
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope,
      access_type: 'offline',
      prompt: 'consent'
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code) {
    try {
      // In production, this should be done on your backend
      // For now, we'll use a simple approach with the client
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens')
      }

      const tokenData = await response.json()
      
      this.accessToken = tokenData.access_token
      this.refreshToken = tokenData.refresh_token
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000)

      // Store tokens in localStorage for persistence
      localStorage.setItem('google_oauth_tokens', JSON.stringify({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry
      }))

      return { success: true, tokens: tokenData }
    } catch (error) {
      console.error('OAuth callback error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Load tokens from localStorage
   */
  loadStoredTokens() {
    try {
      const stored = localStorage.getItem('google_oauth_tokens')
      if (stored) {
        const tokens = JSON.parse(stored)
        this.accessToken = tokens.accessToken
        this.refreshToken = tokens.refreshToken
        this.tokenExpiry = tokens.tokenExpiry

        // Check if token is expired
        if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
          console.log('Access token expired, will need refresh')
          return false
        }
        return true
      }
    } catch (error) {
      console.error('Error loading stored tokens:', error)
    }
    return false
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const tokenData = await response.json()
      this.accessToken = tokenData.access_token
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000)

      // Update stored tokens
      localStorage.setItem('google_oauth_tokens', JSON.stringify({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry
      }))

      return { success: true, accessToken: this.accessToken }
    } catch (error) {
      console.error('Token refresh error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get current access token (refresh if needed)
   */
  async getValidAccessToken() {
    // Load tokens if not already loaded
    if (!this.accessToken) {
      this.loadStoredTokens()
    }

    // Check if token is expired and refresh if needed
    if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
      const refreshResult = await this.refreshAccessToken()
      if (!refreshResult.success) {
        throw new Error('Failed to refresh access token')
      }
    }

    return this.accessToken
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!(this.accessToken || this.loadStoredTokens())
  }

  /**
   * Clear stored tokens (logout)
   */
  logout() {
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    localStorage.removeItem('google_oauth_tokens')
  }
}

// Create singleton instance
export const googleOAuthService = new GoogleOAuthService()

