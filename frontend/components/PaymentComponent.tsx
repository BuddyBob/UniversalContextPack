'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from './AuthProvider'

interface PaymentStatus {
  plan: string
  chunks_used: number
  chunks_allowed: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
}

interface PaymentComponentProps {
  onUpgrade?: () => void
  showUpgradeButton?: boolean
  className?: string
}

export default function PaymentComponent({ 
  onUpgrade, 
  showUpgradeButton = true, 
  className = "" 
}: PaymentComponentProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()
  const { user, session, loading: authLoading } = useAuth()

  const fetchPaymentStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('PaymentComponent - Current user from AuthProvider:', user)
      
      if (!user) {
        // If no user, don't show error - just don't fetch payment status
        console.log('PaymentComponent - No user found, stopping fetch')
        setLoading(false)
        return
      }

      console.log('PaymentComponent - Current session from AuthProvider:', session ? 'exists' : 'null')
      
      if (!session?.access_token) {
        // If no session, don't show error - just don't fetch payment status
        console.log('PaymentComponent - No session/token found, stopping fetch')
        setLoading(false)
        return
      }

      console.log('PaymentComponent - Fetching payment status from backend...')
      
      // Fetch payment status from backend
      const response = await fetch('http://localhost:8000/api/payment/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('PaymentComponent - Response status:', response.status)

      if (!response.ok) {
        throw new Error(`Payment status fetch failed: ${response.status}`)
      }

      const data = await response.json()
      console.log('PaymentComponent - Payment data received:', data)
      setPaymentStatus(data)
    } catch (err) {
      console.error('PaymentComponent - Error fetching payment status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load payment status')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    try {
      // Get current user and session from AuthProvider
      if (!user || !session?.access_token) {
        throw new Error('User not authenticated')
      }

      // For now, just show an alert. Stripe integration will replace this.
      alert('Stripe integration coming soon! Pro plan will unlock unlimited chunk analysis for $4.99/month.')
      
      // Call optional upgrade callback
      if (onUpgrade) {
        onUpgrade()
      }
    } catch (err) {
      console.error('Upgrade error:', err)
      alert('Error initiating upgrade. Please try again.')
    }
  }

  useEffect(() => {
    // Don't do anything if auth is still loading
    if (authLoading) {
      console.log('PaymentComponent - Auth still loading, waiting...')
      return
    }

    console.log('PaymentComponent - Auth loaded, user:', user ? 'authenticated' : 'not authenticated')

    if (user && session) {
      console.log('PaymentComponent - User authenticated, fetching payment status')
      fetchPaymentStatus()
    } else {
      console.log('PaymentComponent - No user or session, setting loading to false')
      setLoading(false)
    }
  }, [user, session, authLoading])

  if (loading) {
    return (
      <div className={`rounded-business p-4 shadow-md ${className}`} 
           style={{ 
             backgroundColor: 'var(--bg-card)', 
             border: '1px solid var(--border-primary)' 
           }}>
        <div className="animate-pulse">
          <div className="h-4 rounded w-1/4 mb-2" 
               style={{ backgroundColor: 'var(--border-secondary)' }}></div>
          <div className="h-3 rounded w-1/2" 
               style={{ backgroundColor: 'var(--border-secondary)' }}></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-business p-4 shadow-md ${className}`} 
           style={{ 
             backgroundColor: 'var(--bg-card)', 
             border: '1px solid var(--status-error)' 
           }}>
        <p className="text-sm" style={{ color: 'var(--status-error)' }}>Error: {error}</p>
        <button 
          onClick={fetchPaymentStatus}
          className="mt-2 text-sm underline hover:no-underline transition-all"
          style={{ color: 'var(--status-error)' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!paymentStatus) {
    // User not authenticated or no payment status - show login prompt
    return (
      <div className={`rounded-business p-4 shadow-md ${className}`} 
           style={{ 
             backgroundColor: 'var(--bg-card)', 
             border: '1px solid var(--accent-primary)' 
           }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Sign in to view your payment plan and usage.
        </p>
      </div>
    )
  }

  const isFreePlan = paymentStatus.plan === 'free'
  const isAtLimit = isFreePlan && paymentStatus.chunks_used >= paymentStatus.chunks_allowed
  const remainingChunks = isFreePlan ? Math.max(0, paymentStatus.chunks_allowed - paymentStatus.chunks_used) : Infinity

  return (
    <div className={`rounded-business p-5 shadow-md hover:shadow-lg transition-all duration-200 ${className}`} 
         style={{ 
           backgroundColor: 'var(--bg-card)', 
           border: '1px solid var(--border-primary)' 
         }}>
      {/* Plan Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-business text-lg capitalize" style={{ color: 'var(--text-primary)' }}>
            {paymentStatus.plan} Plan
          </h3>
          {paymentStatus.subscription_status && (
            <p className="text-xs capitalize mt-1" style={{ color: 'var(--text-muted)' }}>
              Status: {paymentStatus.subscription_status}
            </p>
          )}
        </div>
        <div className="flex items-center">
          {isFreePlan && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" 
                  style={{ 
                    backgroundColor: 'var(--bg-muted)', 
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-secondary)' 
                  }}>
              Free
            </span>
          )}
          {paymentStatus.plan === 'pro' && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium text-white" 
                  style={{ backgroundColor: 'var(--accent-primary)' }}>
              Pro
            </span>
          )}
        </div>
      </div>

      {/* Usage Display */}
      <div className="mb-4">
        {isFreePlan ? (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Chunks Analyzed
              </span>
              <span className="text-sm font-business" style={{ color: 'var(--text-primary)' }}>
                {paymentStatus.chunks_used} / {paymentStatus.chunks_allowed}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full rounded-full h-2.5 mb-3" 
                 style={{ backgroundColor: 'var(--bg-muted)' }}>
              <div 
                className="h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${(paymentStatus.chunks_used / paymentStatus.chunks_allowed) * 100}%`,
                  backgroundColor: isAtLimit ? 'var(--status-error)' : 'var(--accent-primary)'
                }}
              ></div>
            </div>
            
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isAtLimit ? (
                <span className="font-medium" style={{ color: 'var(--status-error)' }}>
                  ⚠️ Limit reached! Upgrade to continue.
                </span>
              ) : (
                `${remainingChunks} chunks remaining`
              )}
            </p>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="font-medium mb-1" style={{ color: 'var(--status-success)' }}>
              ✓ Unlimited Chunks
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {paymentStatus.chunks_used} chunks analyzed
            </p>
          </div>
        )}
      </div>

      {/* Upgrade Button */}
      {isFreePlan && showUpgradeButton && (
        <button
          onClick={handleUpgrade}
          className="w-full py-2.5 px-4 rounded-business font-medium transition-all duration-200 hover:shadow-md text-white text-sm"
          style={{ 
            backgroundColor: isAtLimit ? 'var(--status-error)' : 'var(--accent-primary)',
            border: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isAtLimit ? 'var(--status-error)' : 'var(--accent-primary-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isAtLimit ? 'var(--status-error)' : 'var(--accent-primary)'
          }}
        >
          {isAtLimit ? 'Upgrade Required - $4.99' : 'Upgrade to Pro - $4.99'}
        </button>
      )}

      {/* Plan Benefits */}
      {isFreePlan && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-secondary)' }}>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Pro Plan Benefits:
          </p>
          <ul className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
            <li className="flex items-center">
              <span className="mr-2">🚀</span>
              Unlimited chunk analysis
            </li>
            <li className="flex items-center">
              <span className="mr-2">⚡</span>
              Priority processing
            </li>
            <li className="flex items-center">
              <span className="mr-2">🧠</span>
              Advanced AI insights
            </li>
            <li className="flex items-center">
              <span className="mr-2">📊</span>
              Export capabilities
            </li>
          </ul>
        </div>
      )}

      {/* Plan Dates */}
      {paymentStatus.plan_start_date && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-secondary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Plan started: {new Date(paymentStatus.plan_start_date).toLocaleDateString()}
          </p>
          {paymentStatus.plan_end_date && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Renews: {new Date(paymentStatus.plan_end_date).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
