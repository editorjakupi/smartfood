/**
 * User Identification Utility
 * 
 * Creates unique user IDs that persist across sessions and allow multiple users
 * on the same device to have separate histories.
 * 
 * Strategy (UUID-based to avoid collisions):
 * 1. When user creates a profile, generate a unique UUID
 * 2. User chooses a display name (e.g., "Alice", "Bob")
 * 3. UUID is used as user_id in database (guarantees uniqueness)
 * 4. Display name is shown in UI for user-friendliness
 * 5. Profile ID (UUID) can be used to access profile from any device
 * 6. If no profile is set, use browser fingerprint as fallback
 * 
 * This ensures:
 * - No collisions (UUIDs are globally unique)
 * - Access from any device (using Profile ID)
 * - User-friendly (shows display name, not UUID)
 */

// Storage keys
const USER_ID_KEY = 'smartfood_user_id' // UUID used in database
const USER_PROFILE_ID_KEY = 'smartfood_profile_id' // UUID (same as user_id, stored separately for clarity)
const USER_DISPLAY_NAME_KEY = 'smartfood_display_name' // User-friendly name shown in UI
const USER_SESSION_KEY = 'smartfood_session_id'
const USER_FINGERPRINT_KEY = 'smartfood_fingerprint'
const USER_PROFILES_KEY = 'smartfood_user_profiles' // List of all profiles on this device
const USER_PROFILE_MAPPING_KEY = 'smartfood_profile_mapping' // Maps Profile ID -> Display Name for quick lookup

/**
 * Generate a simple browser fingerprint
 * Combines user agent, screen resolution, timezone, and language
 */
function generateBrowserFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server'
  }

  const parts = [
    navigator.userAgent,
    `${window.screen.width}x${window.screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency || 'unknown'
  ]

  // Simple hash function
  const str = parts.join('|')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `anon_${Math.abs(hash).toString(36)}`
}

/**
 * Generate a unique session ID (changes on each browser session)
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate a unique UUID v4
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    // Use crypto API if available (browser)
    const array = new Uint8Array(16)
    window.crypto.getRandomValues(array)
    
    // Set version (4) and variant bits
    array[6] = (array[6] & 0x0f) | 0x40 // Version 4
    array[8] = (array[8] & 0x3f) | 0x80 // Variant 10
    
    // Convert to hex string
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  } else {
    // Fallback for Node.js or older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

/**
 * Get or create user ID
 * Returns a unique UUID that persists across sessions
 * 
 * Priority:
 * 1. Profile UUID (if set) - unique UUID for this profile
 * 2. Browser fingerprint (fallback) - for anonymous users
 */
export function getUserId(): string {
  if (typeof window === 'undefined') {
    return 'anonymous'
  }

  // Check if user has set a profile UUID
  const profileId = localStorage.getItem(USER_PROFILE_ID_KEY)
  
  if (profileId && profileId.trim().length > 0) {
    // Use profile UUID as user_id (guarantees uniqueness)
    const userId = profileId.trim()
    
    // Store for backward compatibility
    localStorage.setItem(USER_ID_KEY, userId)
    
    // Get or create session ID
    let sessionId = sessionStorage.getItem(USER_SESSION_KEY)
    if (!sessionId) {
      sessionId = generateSessionId()
      sessionStorage.setItem(USER_SESSION_KEY, sessionId)
    }
    
    return userId
  }

  // No profile set - use browser fingerprint as fallback
  let fingerprint = localStorage.getItem(USER_FINGERPRINT_KEY)
  if (!fingerprint) {
    fingerprint = generateBrowserFingerprint()
    localStorage.setItem(USER_FINGERPRINT_KEY, fingerprint)
  }

  // Use fingerprint-based ID for anonymous users
  const userId = fingerprint
  
  // Store for backward compatibility
  localStorage.setItem(USER_ID_KEY, userId)

  // Get or create session ID
  let sessionId = sessionStorage.getItem(USER_SESSION_KEY)
  if (!sessionId) {
    sessionId = generateSessionId()
    sessionStorage.setItem(USER_SESSION_KEY, sessionId)
  }

  return userId
}

/**
 * Create a new profile with a unique UUID
 * This allows multiple users on the same device to have separate histories
 * 
 * @param displayName - Display name shown in UI (e.g., "Alice", "Bob")
 * @param profileId - Optional existing Profile ID to use (for logging in on another device)
 * @returns The Profile ID (UUID) that can be used to access this profile from any device
 */
export function createProfile(displayName: string, profileId?: string): string {
  if (typeof window === 'undefined') {
    throw new Error('Cannot create profile on server')
  }

  const displayNameClean = displayName.trim()
  if (displayNameClean.length === 0) {
    throw new Error('Display name must contain at least one character')
  }

  if (displayNameClean.length > 50) {
    throw new Error('Display name must be 50 characters or less')
  }

  // Use provided profileId or generate a new UUID
  const uuid = profileId && profileId.trim().length > 0 
    ? profileId.trim() 
    : generateUUID()

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(uuid)) {
    throw new Error('Invalid Profile ID format. Must be a valid UUID.')
  }

  // Store profile UUID (this is the actual user_id used in database)
  localStorage.setItem(USER_PROFILE_ID_KEY, uuid)
  localStorage.setItem(USER_ID_KEY, uuid)
  
  // Store display name
  localStorage.setItem(USER_DISPLAY_NAME_KEY, displayNameClean)

  // Store profile mapping for quick lookup
  const mapping = getProfileMapping()
  mapping[uuid] = displayNameClean
  localStorage.setItem(USER_PROFILE_MAPPING_KEY, JSON.stringify(mapping))

  // Add to profiles list
  addToProfilesList(uuid, displayNameClean)

  // Clear session to force new session
  sessionStorage.removeItem(USER_SESSION_KEY)

  return uuid
}

/**
 * Set a custom user ID/name (backward compatibility - now creates a profile)
 * @deprecated Use createProfile() instead
 */
export function setCustomUserId(customId: string, displayName?: string): void {
  // For backward compatibility, treat customId as displayName
  createProfile(displayName || customId)
}

/**
 * Login with an existing Profile ID
 * This allows accessing a profile from another device
 * 
 * @param profileId - The Profile ID (UUID) to login with
 * @returns true if profile was found and loaded, false otherwise
 */
export function loginWithProfileId(profileId: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const profileIdClean = profileId.trim()
  if (profileIdClean.length === 0) {
    return false
  }

  // Check if this profile exists in our local profiles
  const profiles = getUserProfiles()
  const profile = profiles.find(p => p.id === profileIdClean)
  
  if (profile) {
    // Profile exists locally, switch to it
    switchToProfile(profileIdClean)
    return true
  }

  // Profile doesn't exist locally, but we can still set it
  // The display name will be fetched from the mapping or set to "User"
  const mapping = getProfileMapping()
  const displayName = mapping[profileIdClean] || 'User'
  
  // Create profile with existing UUID
  try {
    createProfile(displayName, profileIdClean)
    return true
  } catch (error) {
    console.error('Failed to login with Profile ID:', error)
    return false
  }
}

/**
 * Get current Profile ID (UUID)
 */
export function getProfileId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem(USER_PROFILE_ID_KEY)
}

/**
 * Get current custom user ID (backward compatibility)
 * @deprecated Use getProfileId() instead
 */
export function getCustomUserId(): string | null {
  return getProfileId()
}

/**
 * Clear current profile (switch back to anonymous/fingerprint-based)
 */
export function clearProfile(): void {
  if (typeof window === 'undefined') {
    return
  }

  // Remove profile
  localStorage.removeItem(USER_PROFILE_ID_KEY)
  localStorage.removeItem(USER_DISPLAY_NAME_KEY)
  
  // Regenerate user ID without profile (will use fingerprint)
  const newUserId = getUserId()
  localStorage.setItem(USER_ID_KEY, newUserId)
  
  // Clear session
  sessionStorage.removeItem(USER_SESSION_KEY)
}

/**
 * Clear custom user ID (backward compatibility)
 * @deprecated Use clearProfile() instead
 */
export function clearCustomUserId(): void {
  clearProfile()
}

/**
 * Get profile mapping (Profile ID -> Display Name)
 */
function getProfileMapping(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }

  const mappingJson = localStorage.getItem(USER_PROFILE_MAPPING_KEY)
  if (!mappingJson) {
    return {}
  }

  try {
    return JSON.parse(mappingJson)
  } catch {
    return {}
  }
}

/**
 * Add profile to profiles list
 */
function addToProfilesList(profileId: string, displayName: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const profilesJson = localStorage.getItem(USER_PROFILES_KEY)
  const profiles: Array<{ id: string; name: string; lastUsed: string }> = profilesJson 
    ? JSON.parse(profilesJson) 
    : []

  // Check if profile already exists
  const existingIndex = profiles.findIndex(p => p.id === profileId)
  if (existingIndex >= 0) {
    profiles[existingIndex].name = displayName
    profiles[existingIndex].lastUsed = new Date().toISOString()
  } else {
    profiles.push({
      id: profileId,
      name: displayName,
      lastUsed: new Date().toISOString()
    })
  }

  // Sort by last used (most recent first)
  profiles.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())

  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles))
}

/**
 * Get list of all profiles on this device
 */
export function getUserProfiles(): Array<{ id: string; name: string; lastUsed: string }> {
  if (typeof window === 'undefined') {
    return []
  }

  const profilesJson = localStorage.getItem(USER_PROFILES_KEY)
  if (!profilesJson) {
    return []
  }

  try {
    return JSON.parse(profilesJson)
  } catch {
    return []
  }
}

/**
 * Switch to a different profile
 */
export function switchToProfile(profileId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const profiles = getUserProfiles()
  const profile = profiles.find(p => p.id === profileId)
  
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`)
  }

  // Set profile using existing UUID
  localStorage.setItem(USER_PROFILE_ID_KEY, profileId)
  localStorage.setItem(USER_ID_KEY, profileId)
  localStorage.setItem(USER_DISPLAY_NAME_KEY, profile.name)
  
  // Update last used
  profile.lastUsed = new Date().toISOString()
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles))
  
  // Clear session
  sessionStorage.removeItem(USER_SESSION_KEY)
}

/**
 * Get user's display name (if set)
 */
export function getUserName(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem(USER_DISPLAY_NAME_KEY)
}

/**
 * Set user's display name
 */
export function setUserName(name: string): void {
  if (typeof window === 'undefined') {
    return
  }
  if (name.trim().length > 0) {
    localStorage.setItem(USER_DISPLAY_NAME_KEY, name.trim())
    
    // Update profile mapping
    const profileId = getProfileId()
    if (profileId) {
      const mapping = getProfileMapping()
      mapping[profileId] = name.trim()
      localStorage.setItem(USER_PROFILE_MAPPING_KEY, JSON.stringify(mapping))
      
      // Update profiles list
      const profiles = getUserProfiles()
      const profileIndex = profiles.findIndex(p => p.id === profileId)
      if (profileIndex >= 0) {
        profiles[profileIndex].name = name.trim()
        localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles))
      }
    }
  } else {
    localStorage.removeItem(USER_DISPLAY_NAME_KEY)
  }
}

/**
 * Get current session ID
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return sessionStorage.getItem(USER_SESSION_KEY)
}

/**
 * Get user info object
 */
export function getUserInfo(): {
  userId: string
  profileId: string | null
  customId: string | null // Backward compatibility
  userName: string | null
  sessionId: string | null
  fingerprint: string | null
  profiles: Array<{ id: string; name: string; lastUsed: string }>
} {
  return {
    userId: getUserId(),
    profileId: getProfileId(),
    customId: getProfileId(), // Backward compatibility
    userName: getUserName(),
    sessionId: getSessionId(),
    fingerprint: typeof window !== 'undefined' ? localStorage.getItem(USER_FINGERPRINT_KEY) : null,
    profiles: getUserProfiles()
  }
}
