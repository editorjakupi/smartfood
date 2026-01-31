'use client'

import { useState, useEffect } from 'react'
import { 
  getUserName, 
  setUserName, 
  getUserInfo, 
  getProfileId,
  createProfile,
  loginWithProfileId,
  clearProfile,
  removeProfileFromDevice
} from '@/lib/userId'
import ThemeToggle from '@/components/ThemeToggle'

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userName, setUserNameState] = useState<string | null>(null)
  const [profileId, setProfileIdState] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNameInput, setShowNameInput] = useState(false)
  const [showCreateProfile, setShowCreateProfile] = useState(false)
  const [showLoginProfile, setShowLoginProfile] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [profileIdInput, setProfileIdInput] = useState('')
  const [copiedProfileId, setCopiedProfileId] = useState(false)
  const [newlyCreatedProfileId, setNewlyCreatedProfileId] = useState<string | null>(null)

  useEffect(() => {
    const userInfo = getUserInfo()
    setUserNameState(userInfo.userName)
    setProfileIdState(userInfo.profileId)
  }, [])

  // Refresh user info when menu opens
  useEffect(() => {
    if (showUserMenu) {
      const userInfo = getUserInfo()
      setUserNameState(userInfo.userName)
      setProfileIdState(userInfo.profileId)
    }
  }, [showUserMenu])

  // Close user menu when clicking/touching outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showUserMenu])

  const handleSetName = () => {
    if (nameInput.trim()) {
      try {
        setUserName(nameInput.trim())
        setUserNameState(nameInput.trim())
        setNameInput('')
        setShowNameInput(false)
        setShowUserMenu(false)
        // Refresh page to update display name
        window.location.reload()
      } catch (error: any) {
        alert(error.message || 'Failed to update profile name')
      }
    }
  }

  const handleCreateProfile = async () => {
    if (!nameInput.trim()) return
    try {
      const newProfileId = createProfile(nameInput.trim())
      setUserNameState(nameInput.trim())
      setProfileIdState(newProfileId)
      setNameInput('')
      setShowUserMenu(false)
      // Register profile in DB so login from another device works
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newProfileId })
      }).catch(() => {})
      // On mobile: show new Profile ID before closing; on desktop: reload
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setNewlyCreatedProfileId(newProfileId)
      } else {
        setShowCreateProfile(false)
        window.location.reload()
      }
    } catch (error: any) {
      alert(error.message || 'Failed to create profile')
    }
  }

  const handleLoginProfile = async () => {
    const id = profileIdInput.trim()
    if (!id) return
    try {
      const res = await fetch(`/api/profile?userId=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error('Check failed')
      const { exists } = await res.json()
      if (!exists) {
        alert('This profile was permanently deleted and cannot be used.')
        return
      }
      const success = loginWithProfileId(id)
      if (success) {
        const userInfo = getUserInfo()
        setUserNameState(userInfo.userName)
        setProfileIdState(userInfo.profileId)
        setProfileIdInput('')
        setShowLoginProfile(false)
        setShowUserMenu(false)
        window.location.reload()
      } else {
        alert('Invalid Profile ID. Make sure you copied it correctly.')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to login. Please try again.')
    }
  }

  const handleCopyProfileId = () => {
    const currentProfileId = getProfileId()
    if (currentProfileId) {
      navigator.clipboard.writeText(currentProfileId)
      setCopiedProfileId(true)
      setTimeout(() => setCopiedProfileId(false), 2000)
    }
  }

  const handleDeleteProfile = async () => {
    if (!profileId) return
    if (!confirm('Permanently delete this profile and all its history? This cannot be undone.')) return
    try {
      const res = await fetch('/api/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profileId })
      })
      if (!res.ok) throw new Error('Delete failed')
      removeProfileFromDevice(profileId)
      window.location.reload()
    } catch (e) {
      alert('Failed to delete profile. Please try again.')
    }
  }

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="text-xl font-bold text-primary-600 dark:text-primary-400">
              SmartFood
            </a>
          </div>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <ThemeToggle />
            <a href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">Home</a>
            <a href="/camera" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">Camera</a>
            <a href="/chat" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">Chat</a>
            <a href="/history" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">History</a>
            <a href="/favorites" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">Favorites</a>
            <a href="/predictions" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">Predictions</a>
            <a href="/settings" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">Settings</a>
            <a href="/privacy" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-2 text-sm">Privacy</a>
            {/* User Profile */}
            <div className="relative user-menu-container">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-medium">
                  {userName || 'User'}
                </span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-2 z-50 user-menu-container max-h-96 overflow-y-auto">
                  {showCreateProfile ? (
                    <div className="p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        Create a new profile to access your history from any device. A unique Profile ID will be generated automatically.
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Save your Profile ID to access this profile from other devices.
                      </p>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Display name (e.g., Alice, Bob)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                        autoFocus
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateProfile()}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateProfile}
                          className="flex-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          Create Profile
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateProfile(false)
                            setNameInput('')
                          }}
                          className="flex-1 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : showLoginProfile ? (
                    <div className="p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        Enter your Profile ID to log in. To use another profile, log out first, then log in with that profile's ID.
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Your Profile ID is shown in your profile menu. Save it to access your profile from any device.
                      </p>
                      <input
                        type="text"
                        value={profileIdInput}
                        onChange={(e) => setProfileIdInput(e.target.value.trim())}
                        placeholder="Paste Profile ID (UUID)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2 font-mono text-xs"
                        autoFocus
                        onKeyPress={(e) => e.key === 'Enter' && handleLoginProfile()}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleLoginProfile}
                          className="flex-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          Login
                        </button>
                        <button
                          onClick={() => {
                            setShowLoginProfile(false)
                            setProfileIdInput('')
                          }}
                          className="flex-1 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : showNameInput ? (
                    <div className="p-3">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        autoFocus
                        onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleSetName}
                          className="flex-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowNameInput(false)
                            setNameInput('')
                          }}
                          className="flex-1 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Current profile</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profileId ? (userName || 'User') : 'Not logged in'}</p>
                        {profileId ? (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Profile ID:</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1 break-all text-gray-900 dark:text-gray-100">
                                {profileId}
                              </code>
                              <button
                                onClick={handleCopyProfileId}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-800 dark:text-gray-200"
                                title="Copy Profile ID"
                              >
                                {copiedProfileId ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Save this ID to access your profile from other devices
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">No profile set (using device fingerprint)</p>
                        )}
                      </div>
                      
                      <button
                        onClick={() => {
                          setShowCreateProfile(true)
                          setNameInput('')
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
                      >
                        Create New Profile
                      </button>
                      {!profileId && (
                        <button
                          onClick={() => {
                            setShowLoginProfile(true)
                            setProfileIdInput('')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
                        >
                          Login
                        </button>
                      )}
                      {profileId && (
                        <button
                          onClick={() => {
                            setShowNameInput(true)
                            setNameInput(userName || '')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
                        >
                          Change Profile Name
                        </button>
                      )}
                      {profileId && (
                        <button
                          onClick={() => {
                            if (confirm('Log out? You can log in again with your Profile ID to access this profile.')) {
                              clearProfile()
                              window.location.reload()
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
                        >
                          Log out
                        </button>
                      )}
                      {profileId && (
                        <button
                          onClick={handleDeleteProfile}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          Delete profile
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Mobile: theme + menu */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-2">
            <a href="/" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>Home</a>
            <a href="/camera" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>Camera</a>
            <a href="/chat" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>Chat</a>
            <a href="/history" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>History</a>
            <a href="/favorites" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>Favorites</a>
            <a href="/predictions" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>Predictions</a>
            <a href="/settings" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>Settings</a>
            <a href="/privacy" className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] flex items-center" onClick={() => setMobileMenuOpen(false)}>Privacy</a>
              <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
                <div className="px-4 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Current profile</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profileId ? (userName || 'User') : 'Not logged in'}</p>
                  {profileId ? (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Profile ID (save to log in on another device)</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1.5 rounded flex-1 break-all text-gray-900 dark:text-gray-100">
                          {profileId}
                        </code>
                        <button
                          onClick={() => {
                            handleCopyProfileId()
                            setMobileMenuOpen(false)
                          }}
                          className="shrink-0 px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded min-h-[44px] flex items-center justify-center text-gray-800 dark:text-gray-200"
                          title="Copy Profile ID"
                        >
                          {copiedProfileId ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">No profile (using this device only)</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowCreateProfile(true)
                    setNameInput('')
                    setNewlyCreatedProfileId(null)
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px] flex items-center"
                >
                  Create Profile
                </button>
                {!profileId && (
                  <button
                    onClick={() => {
                      setShowLoginProfile(true)
                      setProfileIdInput('')
                      setMobileMenuOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px] flex items-center"
                  >
                    Login
                  </button>
                )}
                {profileId && (
                  <button
                    onClick={() => {
                      setShowNameInput(true)
                      setNameInput(userName || '')
                      setMobileMenuOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px] flex items-center"
                  >
                    Change Profile Name
                  </button>
                )}
                {profileId && (
                  <button
                    onClick={() => {
                      if (confirm('Log out? You can log in again with your Profile ID to access this profile.')) {
                        clearProfile()
                        window.location.reload()
                      }
                      setMobileMenuOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px] flex items-center border-b border-gray-200 dark:border-gray-600"
                  >
                    Log out
                  </button>
                )}
                {profileId && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleDeleteProfile()
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 min-h-[44px] flex items-center"
                  >
                    Delete profile
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Mobile Name Input Modal */}
          {showNameInput && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 md:hidden p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Change Profile Name</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Update your display name. Your Profile ID will remain unchanged.
                </p>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter new name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSetName}
                    className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 min-h-[44px]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowNameInput(false)
                      setNameInput('')
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 min-h-[44px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Mobile Create Profile Modal */}
          {showCreateProfile && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 md:hidden p-4 overflow-y-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm my-auto border border-gray-200 dark:border-gray-600">
                {newlyCreatedProfileId ? (
                  <>
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Profile created</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      Save your Profile ID to log in on another device.
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1.5 rounded flex-1 break-all text-gray-900 dark:text-gray-100">
                        {newlyCreatedProfileId}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newlyCreatedProfileId)
                          setCopiedProfileId(true)
                          setTimeout(() => setCopiedProfileId(false), 2000)
                        }}
                        className="shrink-0 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 rounded min-h-[44px]"
                      >
                        {copiedProfileId ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setNewlyCreatedProfileId(null)
                        setShowCreateProfile(false)
                        window.location.reload()
                      }}
                      className="w-full px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 min-h-[44px]"
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Create Profile</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      Create a new profile to access your history from any device. A unique Profile ID will be generated.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                      Save your Profile ID to access this profile from other devices.
                    </p>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Display name (e.g., Alice, Bob)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                      autoFocus
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateProfile()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateProfile}
                        className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 min-h-[44px]"
                      >
                        Create Profile
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateProfile(false)
                          setNameInput('')
                          setNewlyCreatedProfileId(null)
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 min-h-[44px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Mobile Login Modal */}
          {showLoginProfile && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 md:hidden p-4 overflow-y-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm my-auto border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Login</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Enter your Profile ID to log in. To use another profile, log out first, then log in with that profile's ID.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                  Your Profile ID is shown in your profile menu. Save it to access your profile from any device.
                </p>
                <input
                  type="text"
                  value={profileIdInput}
                  onChange={(e) => setProfileIdInput(e.target.value.trim())}
                  placeholder="Paste Profile ID (UUID)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3 font-mono text-xs"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleLoginProfile()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleLoginProfile}
                    className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 min-h-[44px]"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setShowLoginProfile(false)
                      setProfileIdInput('')
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 min-h-[44px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </nav>
  )
}
