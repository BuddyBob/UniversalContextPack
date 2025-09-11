'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile } from '@/lib/supabase'
import { API_ENDPOINTS } from '@/lib/api'

interface AuthContextType {
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  loading: boolean
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastProfileFetch, setLastProfileFetch] = useState<number>(0)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      setSession(session)
      setUser(session?.user ?? null)
      
      // Handle different auth events appropriately
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          fetchUserProfile(session.user.id)
        } else {
          setUserProfile(null)
        }
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(null)
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

  const fetchUserProfile = async (userId: string) => {
    // Debounce: Don't fetch if we fetched within the last 5 seconds
    const now = Date.now()
    if (now - lastProfileFetch < 5000) {
      return
    }
    
    try {
      setLastProfileFetch(now)
      // Get fresh session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        return
      }
      
      // Try to get the user profile via our backend API
      try {
        // Create AbortController for timeout
        const controller = new AbortController()
        // Use shorter timeout for quick endpoint (10s) since it should be very fast
        const timeoutId = setTimeout(() => controller.abort(), 10000) 
        
        // Use the lightweight quick endpoint during potential analysis periods
        // or if we've had recent failures, otherwise use the full profile endpoint
        const profileEndpoint = `${API_ENDPOINTS.profile}/quick`
        
        const response = await fetch(profileEndpoint, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          // If we got a quick response, it only contains auth status
          // Fall back to Supabase for full profile data
          if (data.authenticated) {
            // Fallback to direct Supabase query for full profile
            const { data: profileData, error } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', userId)
              .single()

            if (!error && profileData) {
              setUserProfile(profileData)
            }
          }
          return
        } else if (response.status === 401) {
          // Token might be expired, try to refresh once before giving up
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError || !refreshedSession) {
            await signOut()
            return
          }
          
          // Retry with refreshed token and timeout
          const retryController = new AbortController()
          const retryTimeoutId = setTimeout(() => retryController.abort(), 10000) // 10 second timeout for quick endpoint
          
          const retryResponse = await fetch(`${API_ENDPOINTS.profile}/quick`, {
            headers: {
              'Authorization': `Bearer ${refreshedSession.access_token}`,
            },
            signal: retryController.signal,
          })
          
          clearTimeout(retryTimeoutId)
          
          if (retryResponse.ok) {
            const data = await retryResponse.json()
            // If we got a quick response, it only contains auth status
            if (data.authenticated) {
              // Fallback to direct Supabase query for full profile
              const { data: profileData, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single()

              if (!error && profileData) {
                setUserProfile(profileData)
              }
            }
            return
          } else {
            await signOut()
            return
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('Profile request timed out after 30 seconds')
        } else {
          console.error('Profile request error:', error)
        }
      }
      
      // Fallback to direct Supabase query
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }

      setUserProfile(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const signInWithGoogle = async () => {
    try {
      // Store current page to return to after auth
      const currentPath = window.location.pathname
      const redirectTo = `${window.location.origin}${currentPath}`
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUserProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
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
      let timeoutMs = 30000 // Default 30 seconds
      
      if (url.includes('/api/analyze/')) {
        timeoutMs = 30 * 60 * 1000 // 30 minutes for analysis
      } else if (url.includes('/api/chunk/') || url.includes('/api/extract/')) {
        timeoutMs = 10 * 60 * 1000 // 10 minutes for chunking/extraction
      } else if (url.includes('/api/profile/quick')) {
        timeoutMs = 10000 // 10 seconds for quick profile endpoint
      } else if (url.includes('/api/health')) {
        timeoutMs = 20000 // 20 seconds for health checks
      }
      
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
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
                          : url.includes('/api/profile/quick') ? 'Quick profile request'
                          : url.includes('/api/health') ? 'Health check request'
                          : 'Request'
        
        const timeoutDuration = url.includes('/api/analyze/') ? '30 minutes'
                              : url.includes('/api/chunk/') || url.includes('/api/extract/') ? '10 minutes'
                              : url.includes('/api/profile/quick') ? '10 seconds'
                              : url.includes('/api/health') ? '20 seconds'
                              : '30 seconds'
        
        console.warn(`${timeoutType} timed out after ${timeoutDuration}`)
        throw new Error(`${timeoutType} timeout (${timeoutDuration})`)
      }
      console.error('Request failed:', error)
      throw error
    }
  }

  const value = {
    user,
    session,
    userProfile,
    signInWithGoogle,
    signOut,
    loading,
    makeAuthenticatedRequest,
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