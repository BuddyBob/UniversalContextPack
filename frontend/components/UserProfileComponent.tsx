'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User, CreditCard, BarChart3, Calendar, RefreshCw, Copy, Check, Terminal } from 'lucide-react'
import PaymentComponent from './PaymentComponent'
import { useAuth } from './AuthProvider'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  payment_plan: string
  chunks_analyzed: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
  created_at: string
}

interface UserProfileComponentProps {
  onUpgrade?: () => void
  className?: string
}

export default function UserProfileComponent({
  onUpgrade,
  className = ""
}: UserProfileComponentProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const { session, user, loading: authLoading, makeAuthenticatedRequest } = useAuth()
  const supabase = createClientComponentClient()

  const fetchUserProfile = async () => {
    // If auth is still loading, wait
    if (authLoading) return

    try {
      setLoading(true)
      setError(null)

      // Use user from hook
      if (!user) {
        return
      }

      // Fetch profile from Backend API instead of Supabase directly
      // This avoids RLS issues and uses the service role on the backend
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/user/profile`)

      if (!response.ok) {
        throw new Error(`Profile fetch failed: ${response.statusText}`)
      }

      const data = await response.json()
      setProfile(data)
    } catch (err) {
      console.error('Error fetching user profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    setRefreshing(true)
    await fetchUserProfile()
    setRefreshing(false)
  }

  useEffect(() => {
    fetchUserProfile()
  }, [user, authLoading])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-3 bg-gray-200 rounded w-48"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <p className="text-red-700 mb-3">Error: {error}</p>
        <button
          onClick={fetchUserProfile}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  })

  return (
    <div className={`max-w-4xl mx-auto space-y-4 ${className}`}>
      {/* Header Card */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <User size={24} className="text-gray-400" />
              )}
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                {profile.full_name || 'User'}
              </h2>
              <p className="text-sm text-gray-400">{profile.email}</p>
              <p className="text-xs text-gray-500 mt-1">Member since {memberSince}</p>
            </div>
          </div>
          <button
            onClick={refreshProfile}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
            title="Refresh profile"
          >
            <RefreshCw
              size={18}
              className={refreshing ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan Status Card */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center space-x-2 mb-3">
            <CreditCard size={16} className="text-gray-600" />
            <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Current Plan</h3>
          </div>
          <p className="text-xl font-semibold capitalize text-gray-900">
            {profile.payment_plan}
          </p>
          {profile.subscription_status && (
            <p className="text-xs text-gray-500 mt-1 capitalize">
              Status: {profile.subscription_status}
            </p>
          )}
        </div>

        {/* Usage Stats Card */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center space-x-2 mb-3">
            <BarChart3 size={16} className="text-gray-600" />
            <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Usage</h3>
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {profile.chunks_analyzed?.toLocaleString() || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Chunks analyzed
          </p>
        </div>
      </div>

      {/* Payment Component */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <CreditCard size={16} className="text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">Plan Management</h3>
        </div>
        <PaymentComponent
          onUpgrade={onUpgrade}
          showUpgradeButton={profile.payment_plan === 'free' || profile.payment_plan === 'credits'}
          className="shadow-none border-0"
        />
      </div>
    </div>
  )
}
