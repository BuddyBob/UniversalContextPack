'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile } from '@/lib/supabase'
import { API_ENDPOINTS, API_BASE_URL } from '@/lib/api'

interface AuthContextType {
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  loading: boolean
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastProfileFetch, setLastProfileFetch] = useState<number>(0)
  const welcomeEmailSent = useRef<Set<string>>(new Set()) // Track which user IDs have received welcome emails

  useEffect(() => {
    // Check if we have auth tokens in URL hash (from OAuth redirect)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')

    if (accessToken) {
      console.log('🔐 Detected OAuth tokens in URL, processing...')
      // Clear the hash from URL for security
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    // Get initial session with timeout protection
    const sessionPromise = supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        console.log('✅ User authenticated:', session.user.email)
        fetchUserProfile(session.user.id)
      } else {
        console.log('ℹ️ No active session')
      }
      setLoading(false)
    }).catch((error) => {
      console.error('❌ Failed to get session:', error)
      setLoading(false) // Stop loading even on error
    })

    // Safety timeout: force loading to false after 3 seconds
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Auth session fetch timeout - forcing loading state to false')
      setLoading(false)
    }, 3000)

    // Clear timeout if session loads successfully
    sessionPromise.finally(() => clearTimeout(timeoutId))

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {

      setSession(session)
      setUser(session?.user ?? null)

      // Handle different auth events appropriately
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          // Fetch user profile first
          const profileExists = await fetchUserProfile(session.user.id)

          // Send welcome email ONLY on first successful sign-in
          // - Email must be verified (email_confirmed_at is not null)
          // - Profile doesn't exist yet (new user)
          // - Haven't already sent welcome email in this session
          const isEmailVerified = session.user.email_confirmed_at !== null

          if (event === 'SIGNED_IN' && isEmailVerified && !profileExists && !welcomeEmailSent.current.has(session.user.id)) {
            // Mark as sent immediately to prevent duplicate sends
            welcomeEmailSent.current.add(session.user.id)

            try {
              const response = await fetch(`${API_BASE_URL}/api/email/send-account-creation`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json'
                }
              })

              if (response.ok) {
                const data = await response.json()
                console.log('✅ Welcome email sent:', data.status)
              } else {
                const error = await response.json()
                // Log but don't block - email is non-critical
                console.log('⚠️ Welcome email skipped:', error.message)
              }
            } catch (emailError) {
              // Non-blocking - don't stop user flow if email fails
              console.log('⚠️ Welcome email failed (non-blocking):', emailError)
            }
          }
        } else {
          setUserProfile(null)
        }
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(null)
        welcomeEmailSent.current.clear() // Clear tracking on sign out
      } else if (event === 'TOKEN_REFRESHED') {
        // Don't fetch profile on token refresh to avoid unnecessary API calls
      }

      setLoading(false)
    })

    // Set up token refresh check
    const tokenRefreshInterval = setInterval(async () => {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Error checking session:', error)
        return
      }

      if (session) {
        // Check if token is close to expiring (within 10 minutes)
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
        const now = Date.now()
        const tenMinutes = 10 * 60 * 1000

        if (expiresAt - now < tenMinutes && expiresAt > now) {
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.error('Token refresh failed:', refreshError)
            // Don't force sign out immediately - let the user continue and handle it on next request
          } else {
          }
        }
      }
    }, 2 * 60 * 1000) // Check every 2 minutes instead of every minute

    return () => {
      subscription.unsubscribe()
      clearInterval(tokenRefreshInterval)
    }
  }, [])

  const fetchUserProfile = async (userId: string): Promise<boolean> => {

    // Debounce: Don't fetch if we fetched within the last 5 seconds
    const now = Date.now()
    if (now - lastProfileFetch < 5000) {
      return true // Assume exists if we just fetched
    }

    try {
      setLastProfileFetch(now)

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, r2_user_directory, credits_balance, payment_plan, created_at, updated_at')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Error fetching user profile:', error)
        return false // Profile doesn't exist or error occurred
      }

      if (!data) {
        console.error('❌ No data returned from user_profiles query')
        return false
      }

      console.log('User profile loaded')

      setUserProfile(data)
      return true // Profile exists
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return false
    }
  }

  const signInWithGoogle = async () => {
    try {
      // Store current page to return to after auth
      const currentPath = window.location.pathname
      // If user is on /process, /auth, or demo pack (sample-*), redirect to /packs after auth
      const isDemoPage = currentPath.includes('/results/sample-')
      const isAuthPage = currentPath === '/auth'
      const redirectPath = (currentPath === '/process' || isDemoPage || isAuthPage) ? '/packs' : currentPath
      const redirectTo = `${window.location.origin}${redirectPath}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          // Skip email confirmation for Google OAuth
          skipBrowserRedirect: false,
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  const signInWithGitHub = async () => {
    try {
      // Store current page to return to after auth
      const currentPath = window.location.pathname
      const isDemoPage = currentPath.includes('/results/sample-')
      const redirectPath = (currentPath === '/process' || isDemoPage) ? '/packs' : currentPath
      const redirectTo = `${window.location.origin}${redirectPath}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          // Skip email confirmation for GitHub OAuth
          skipBrowserRedirect: false,
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in with GitHub:', error)
      throw error
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in with email:', error)
      throw error
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const currentPath = window.location.pathname
      const isDemoPage = currentPath.includes('/results/sample-')
      const isAuthPage = currentPath === '/auth'
      const redirectPath = (currentPath === '/process' || isDemoPage || isAuthPage) ? '/packs' : currentPath
      const redirectTo = `${window.location.origin}${redirectPath}`

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          // Require email confirmation for email signups
          data: {
            email_confirmed: false,
          },
        },
      })
      
      if (error) throw error
      
      // Check if user already exists (Supabase returns user but with identities empty array)
      // When email confirmation is enabled, Supabase doesn't throw error for existing users
      // but we can detect it by checking the response
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('User already registered. Please sign in instead or check your email for verification.')
      }
    } catch (error) {
      console.error('Error signing up with email:', error)
      throw error
    }
  }

  const signInWithMagicLink = async (email: string) => {
    try {
      const currentPath = window.location.pathname
      const isDemoPage = currentPath.includes('/results/sample-')
      const redirectPath = (currentPath === '/process' || isDemoPage) ? '/packs' : currentPath
      const redirectTo = `${window.location.origin}${redirectPath}`

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error sending magic link:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      // Check if there's an active session first
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
      
      // Clear local state regardless of session status
      setUser(null)
      setSession(null)
      setUserProfile(null)
      
      // Clear any local storage items
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token')
      }
    } catch (error) {
      console.error('Error signing out:', error)
      // Still clear local state even if sign out fails
      setUser(null)
      setSession(null)
      setUserProfile(null)
    }
  }

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Server health check and warming for critical operations
    const isCriticalOperation = url.includes('/api/analyze/') || url.includes('/api/extract') || url.includes('/api/chunk/')

    if (isCriticalOperation) {
      try {
        // Quick health check to warm up the server
        const healthController = new AbortController()
        const healthTimeout = setTimeout(() => healthController.abort(), 10000) // 10 second timeout for health check

        const baseUrl = new URL(url).origin
        const healthResponse = await fetch(`${baseUrl}/api/health`, {
          method: 'GET',
          signal: healthController.signal,
          headers: {
            'Cache-Control': 'no-cache'
          }
        })

        clearTimeout(healthTimeout)

        if (!healthResponse.ok) {
          console.warn('Server health check failed, proceeding anyway...')
        } else {
          const healthData = await healthResponse.json()
          console.log('Server health check passed:', healthData.status)

          // If server is unhealthy, add extra delay
          if (healthData.status !== 'healthy') {
            console.warn('Server reports unhealthy status, adding delay...')
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      } catch (healthError) {
        // Health check failed, but continue with main request
        console.warn('Health check failed, server may be cold starting:', healthError)
        // Add a small delay to allow potential cold start
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    // Get fresh session to ensure token is valid
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      console.error('No valid session available:', error)
      await signOut()
      throw new Error('Authentication required')
    }

    // Check if token is expired or expiring soon (within 5 minutes)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    if (expiresAt <= now + fiveMinutes) {
      console.log('Token expiring soon, refreshing...')
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.error('Token refresh failed:', refreshError)
        await signOut()
        throw new Error('Authentication expired')
      }

      // Get the refreshed session
      const { data: { session: refreshedSession } } = await supabase.auth.getSession()
      if (!refreshedSession) {
        await signOut()
        throw new Error('Authentication refresh failed')
      }

      // Use the refreshed session
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${refreshedSession.access_token}`,
      }
    } else {
      // Use current session
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${session.access_token}`,
      }
    }

    // Set up timeout if not already provided
    if (!options.signal) {
      const controller = new AbortController()

      // Use different timeouts based on the endpoint
      let timeoutMs = 60000 // Default 60 seconds

      if (url.includes('/api/analyze/')) {
        timeoutMs = 30 * 60 * 1000 // 30 minutes for analysis
      } else if (url.includes('/api/chunk/') || url.includes('/api/extract/')) {
        timeoutMs = 10 * 60 * 1000 // 10 minutes for chunking/extraction
      } else if (url.includes('/sources') && url.includes('POST')) {
        timeoutMs = 10 * 60 * 1000 // 10 minutes for file upload
      } else if (url.includes('/api/status/') || url.includes('/sources')) {
        timeoutMs = 90000 // 90 seconds for status polling and source status
      } else if (url.includes('/api/profile/quick')) {
        timeoutMs = 10000 // 10 seconds for quick profile endpoint
      } else if (url.includes('/api/health')) {
        timeoutMs = 20000 // 20 seconds for health checks
      } else if (url.includes('/api/v2/packs/') && !url.includes('POST')) {
        timeoutMs = 90000 // 90 seconds for pack detail endpoints - allow time for tree building
        console.log(`[Auth] \u23f1\ufe0f Setting 90s timeout for pack detail request`);
      } else if (url.includes('/api/v2/packs') && !url.includes('POST') && !url.includes('/')) {
        timeoutMs = 15000 // 15 seconds for pack list endpoint
        console.log(`[Auth] \u23f1\ufe0f Setting 15s timeout for pack list request`);
      }

      const timeoutId = setTimeout(() => {
        console.warn(`[Auth] \u23f0 Request timeout (${timeoutMs}ms) - aborting:`, url);
        controller.abort();
      }, timeoutMs)
      options.signal = controller.signal

      // Store timeout ID for cleanup
      options.signal.addEventListener('abort', () => clearTimeout(timeoutId))
    }

    try {
      const response = await fetch(url, options)

      // If we get a 401, the token might be invalid - try refresh once
      if (response.status === 401) {
        console.log('Got 401, attempting token refresh...')
        const { error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError) {
          console.error('Token refresh failed on 401:', refreshError)
          await signOut()
          throw new Error('Authentication expired')
        }

        // Retry the request with refreshed token and new timeout
        const { data: { session: newSession } } = await supabase.auth.getSession()
        if (newSession) {
          const retryOptions = {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newSession.access_token}`,
            },
          }

          // Set up new timeout for retry
          const retryController = new AbortController()

          // Use appropriate timeout for retry based on endpoint
          let retryTimeoutMs = 30000 // Default 30 seconds
          if (url.includes('/api/analyze/')) {
            retryTimeoutMs = 30 * 60 * 1000 // 30 minutes for analysis
          } else if (url.includes('/api/chunk/') || url.includes('/api/extract/')) {
            retryTimeoutMs = 10 * 60 * 1000 // 10 minutes for chunking/extraction
          } else if (url.includes('/api/status/')) {
            retryTimeoutMs = 90000 // 90 seconds for status polling to handle batch processing
          } else if (url.includes('/api/profile/quick')) {
            retryTimeoutMs = 10000 // 10 seconds for quick profile endpoint
          } else if (url.includes('/api/health')) {
            retryTimeoutMs = 20000 // 20 seconds for health checks
          }

          const retryTimeoutId = setTimeout(() => retryController.abort(), retryTimeoutMs)
          retryOptions.signal = retryController.signal
          retryController.signal.addEventListener('abort', () => clearTimeout(retryTimeoutId))

          return await fetch(url, retryOptions)
        } else {
          await signOut()
          throw new Error('Authentication refresh failed')
        }
      }

      return response
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutType = url.includes('/api/analyze/') ? 'Analysis request'
          : url.includes('/api/chunk/') ? 'Chunking request'
            : url.includes('/api/extract/') ? 'Extraction request'
              : url.includes('/sources') ? 'File upload request'
                : url.includes('/api/profile/quick') ? 'Quick profile request'
                  : url.includes('/api/health') ? 'Health check request'
                    : 'Request'

        const timeoutDuration = url.includes('/api/analyze/') ? '30 minutes'
          : url.includes('/api/chunk/') || url.includes('/api/extract/') || url.includes('/sources') ? '10 minutes'
            : url.includes('/api/profile/quick') ? '10 seconds'
              : url.includes('/api/health') ? '20 seconds'
                : '30 seconds'

        console.warn(`${timeoutType} timed out after ${timeoutDuration}`)
        // Re-throw the AbortError to preserve error type for proper handling
        throw error
      }
      console.error('Request failed:', error)
      throw error
    }
  }

  const refreshUserProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id)
    }
  }

  const value = {
    user,
    session,
    userProfile,
    signInWithGoogle,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
    signOut,
    loading,
    makeAuthenticatedRequest,
    refreshUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}