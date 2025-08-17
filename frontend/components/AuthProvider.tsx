'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile } from '@/lib/supabase'

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
      console.log('Auth state changed:', event, session?.user?.email)
      
      setSession(session)
      setUser(session?.user ?? null)
      
      // Only fetch profile on meaningful auth events, not token refreshes
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          fetchUserProfile(session.user.id)
        } else {
          setUserProfile(null)
        }
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
        // Check if token is close to expiring (within 5 minutes)
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000
        
        if (expiresAt - now < fiveMinutes) {
          console.log('Token expiring soon, refreshing...')
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.error('Token refresh failed:', refreshError)
            // Force sign out if refresh fails
            await signOut()
          }
          // Note: Don't fetch profile here - let onAuthStateChange handle it
        }
      }
    }, 60000) // Check every minute

    return () => {
      subscription.unsubscribe()
      clearInterval(tokenRefreshInterval)
    }
  }, [])

  const fetchUserProfile = async (userId: string) => {
    // Debounce: Don't fetch if we fetched within the last 5 seconds
    const now = Date.now()
    if (now - lastProfileFetch < 5000) {
      console.log('Skipping profile fetch - too recent')
      return
    }
    
    try {
      setLastProfileFetch(now)
      // Try to get the user profile via our backend API which handles authentication properly
      const session = await supabase.auth.getSession()
      if (session.data.session?.access_token) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/profile`, {
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
            },
          })
          
          if (response.ok) {
            const data = await response.json()
            setUserProfile(data.profile)
            return
          } else if (response.status === 401) {
            // Token might be expired, trigger refresh
            console.log('Profile fetch got 401, signing out...')
            await signOut()
            return
          }
        } catch (error) {
          console.log('Backend profile fetch failed, trying direct Supabase fetch:', error)
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
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
    // Get fresh session to ensure token is valid
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) {
      console.error('No valid session available:', error)
      await signOut()
      throw new Error('Authentication required')
    }

    // Check if token is expired or expiring soon
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
    const now = Date.now()
    
    if (expiresAt <= now) {
      console.log('Token expired, attempting refresh...')
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

    try {
      const response = await fetch(url, options)
      
      // If we get a 401, the token might be invalid - try refresh once
      if (response.status === 401) {
        console.log('Received 401, attempting token refresh...')
        const { error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          console.error('Token refresh failed on 401:', refreshError)
          await signOut()
          throw new Error('Authentication expired')
        }
        
        // Retry the request with refreshed token
        const { data: { session: newSession } } = await supabase.auth.getSession()
        if (newSession) {
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${newSession.access_token}`,
          }
          
          return await fetch(url, options)
        } else {
          await signOut()
          throw new Error('Authentication refresh failed')
        }
      }
      
      return response
    } catch (error) {
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