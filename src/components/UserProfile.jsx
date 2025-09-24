import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LogOut, ChevronDown, ChevronUp } from 'lucide-react'

const UserProfile = () => {
  const { user, signOut } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)

  if (!user) return null

  const handleAvatarError = () => {
    setAvatarError(true)
  }

  // Generate initials from user name
  const getInitials = (name) => {
    if (!name) return 'U'
    const names = name.trim().split(' ')
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase()
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
  }

  // Generate avatar color based on name
  const getAvatarColor = (name) => {
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
          <div className={`w-8 h-8 rounded-full border border-gray-300 bg-gradient-to-br ${getAvatarColor(user.name)} flex items-center justify-center text-white font-semibold text-sm`}>
            {getInitials(user.name)}
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
            {user.name}
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
                  <div className={`w-12 h-12 rounded-full border border-gray-300 bg-gradient-to-br ${getAvatarColor(user.name)} flex items-center justify-center text-white font-semibold text-lg`}>
                    {getInitials(user.name)}
                  </div>
                ) : (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-12 h-12 rounded-full border border-gray-300"
                    onError={handleAvatarError}
                    onLoad={() => setAvatarError(false)}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>


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

export default UserProfile
