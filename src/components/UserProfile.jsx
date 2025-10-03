import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext'
import { userService } from '../lib/supabase'
import { LogOut, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

const UserProfile = ({ llmService = null }) => {
  const { user, signOut } = useSupabaseAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [tokenQuotaStatus, setTokenQuotaStatus] = useState(null)

  // Fetch user profile data
  useEffect(() => {
    if (user?.id) {
      userService.getUserProfile(user.id)
        .then((profile) => {
          setUserProfile(profile)
        })
        .catch((error) => {
          console.error('Error fetching user profile:', error)
        })
    }
  }, [user?.id])

  // Update token quota status
  useEffect(() => {
    if (llmService) {
      const updateTokenStatus = async () => {
        try {
          const quotaStatus = await llmService.getTokenQuotaStatus();
          setTokenQuotaStatus(quotaStatus);
        } catch (error) {
          console.error('Error getting token quota status:', error);
          setTokenQuotaStatus(null);
        }
      };
      updateTokenStatus();
    } else {
      setTokenQuotaStatus(null);
    }
  }, [llmService]);

  // Update token quota status periodically when dropdown is open
  useEffect(() => {
    if (!isDropdownOpen || !llmService) return;

    const updateTokenStatus = async () => {
      try {
        const quotaStatus = await llmService.getTokenQuotaStatus();
        setTokenQuotaStatus(quotaStatus);
      } catch (error) {
        console.error('Error getting token quota status:', error);
        setTokenQuotaStatus(null);
      }
    };

    // Update immediately
    updateTokenStatus();

    // Update every 2 seconds while dropdown is open
    const interval = setInterval(updateTokenStatus, 2000);

    return () => clearInterval(interval);
  }, [isDropdownOpen, llmService]);

  // Update token quota status when llmService changes (e.g., after chat completion)
  useEffect(() => {
    if (!llmService) return;

    const updateTokenStatus = async () => {
      try {
        const quotaStatus = await llmService.getTokenQuotaStatus();
        setTokenQuotaStatus(quotaStatus);
      } catch (error) {
        console.error('Error getting token quota status:', error);
        setTokenQuotaStatus(null);
      }
    };

    // Update when llmService changes
    updateTokenStatus();
  }, [llmService]);

  // Listen for token quota update events from chat completion
  useEffect(() => {
    const handleTokenQuotaUpdate = (event) => {
      console.log('Received token quota update event:', event.detail);
      setTokenQuotaStatus(event.detail);
    };

    window.addEventListener('tokenQuotaUpdated', handleTokenQuotaUpdate);
    
    return () => {
      window.removeEventListener('tokenQuotaUpdated', handleTokenQuotaUpdate);
    };
  }, []);

  if (!user) return null

  const handleAvatarError = () => {
    setAvatarError(true)
  }

  // Generate initials from user name (prefer profile name, fallback to auth user name)
  const getInitials = () => {
    const name = userProfile?.name || user?.user_metadata?.name || user?.email
    if (!name) return 'U'
    const names = name.trim().split(' ')
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase()
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
  }

  // Generate avatar color based on name
  const getAvatarColor = () => {
    const name = userProfile?.name || user?.user_metadata?.name || user?.email
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-pink-500 to-rose-600',
      'from-orange-500 to-red-600',
      'from-indigo-500 to-blue-600',
      'from-emerald-500 to-green-600',
      'from-violet-500 to-purple-600',
      'from-cyan-500 to-blue-600'
    ]
    if (!name) return colors[0]
    const hash = name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="relative">
      {/* User Avatar and Dropdown Trigger */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {avatarError || !user.picture ? (
          <div className={`w-8 h-8 rounded-full border border-gray-300 bg-gradient-to-br ${getAvatarColor()} flex items-center justify-center text-white font-semibold text-sm`}>
            {getInitials()}
          </div>
        ) : (
          <img
            src={user.picture}
            alt={user.name}
            className="w-8 h-8 rounded-full border border-gray-300"
            onError={handleAvatarError}
            onLoad={() => setAvatarError(false)}
          />
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-700 truncate max-w-32">
            {userProfile?.name || user?.user_metadata?.name || user?.email}
          </p>
          <p className="text-xs text-gray-500 truncate max-w-32">
            {user.email}
          </p>
        </div>
        {isDropdownOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            {/* User Info */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                {avatarError || !user.picture ? (
                  <div className={`w-12 h-12 rounded-full border border-gray-300 bg-gradient-to-br ${getAvatarColor()} flex items-center justify-center text-white font-semibold text-lg`}>
                    {getInitials()}
                  </div>
                ) : (
                  <img
                    src={user.picture}
                    alt={userProfile?.name || user?.user_metadata?.name || user?.email}
                    className="w-12 h-12 rounded-full border border-gray-300"
                    onError={handleAvatarError}
                    onLoad={() => setAvatarError(false)}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {userProfile?.name || user?.user_metadata?.name || user?.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Token Usage Display */}
            {tokenQuotaStatus && tokenQuotaStatus.used !== undefined && (
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Token Usage</span>
                  <span className="text-xs font-medium text-gray-600">
                    {tokenQuotaStatus.used >= 1000 ? `${(tokenQuotaStatus.used / 1000).toFixed(1)}K` : (tokenQuotaStatus.used || 0).toLocaleString()}
                    {tokenQuotaStatus.limit === Infinity ? ' (unlimited)' : ` / ${tokenQuotaStatus.limit >= 1000 ? `${(tokenQuotaStatus.limit / 1000).toFixed(0)}K` : (tokenQuotaStatus.limit || 0).toLocaleString()}`}
                  </span>
                </div>
                {/* Only show progress bar for non-test users with limited quota */}
                {tokenQuotaStatus.limit !== Infinity && tokenQuotaStatus.limit > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, ((tokenQuotaStatus.used || 0) / (tokenQuotaStatus.limit || 1)) * 100)}%` }}
                    ></div>
                  </div>
                )}
                
                {/* Token limit exceeded warning */}
                {tokenQuotaStatus.hasReachedQuota && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-red-800 font-medium">
                          Token limit reached! Number of tokens used: {(tokenQuotaStatus.used || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          <a 
                            href="https://calendly.com/hemisphere/30min" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="underline hover:text-red-800 transition-colors"
                          >
                            Click here to increase your limit
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sign Out */}
            <div className="border-t border-gray-100">
              <button
                onClick={() => {
                  setIsDropdownOpen(false)
                  signOut()
                }}
                className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

UserProfile.propTypes = {
  llmService: PropTypes.object
}

export default UserProfile
