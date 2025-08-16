'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from './AuthProvider'
import { X, CreditCard, Zap } from 'lucide-react'

interface PaymentStatus {
  plan: string
  chunks_used: number
  chunks_allowed: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
}

interface PaymentSidebarProps {
  onUpgrade?: () => void
  showUpgradeButton?: boolean
}

export default function PaymentSidebar({ 
  onUpgrade, 
  showUpgradeButton = true 
}: PaymentSidebarProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClientComponentClient()
  const { user, session, loading: authLoading } = useAuth()

  const fetchPaymentStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user || !session?.access_token) {
        setLoading(false)
        return
      }

      const response = await fetch('http://localhost:8000/api/payment/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Payment status fetch failed: ${response.status}`)
      }

      const data = await response.json()
      setPaymentStatus(data)
    } catch (err) {
      console.error('PaymentSidebar - Error fetching payment status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load payment status')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    try {
      if (!user || !session?.access_token) {
        throw new Error('User not authenticated')
      }

      alert('Stripe integration coming soon! Pro plan will unlock unlimited chunk analysis for $4.99/month.')
      
      if (onUpgrade) {
        onUpgrade()
      }
    } catch (err) {
      console.error('Upgrade error:', err)
      alert('Error initiating upgrade. Please try again.')
    }
  }

  useEffect(() => {
    if (authLoading) return

    if (user && session) {
      fetchPaymentStatus()
    } else {
      setLoading(false)
    }
  }, [user, session, authLoading])

  // Don't show anything if not authenticated
  if (!user) return null

  const isFreePlan = paymentStatus?.plan === 'free'
  const isAtLimit = isFreePlan && paymentStatus && paymentStatus.chunks_used >= paymentStatus.chunks_allowed
  const remainingChunks = isFreePlan && paymentStatus ? Math.max(0, paymentStatus.chunks_allowed - paymentStatus.chunks_used) : Infinity

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-24 right-6 z-40 flex items-center gap-2 px-4 py-2 rounded-business shadow-lg hover:shadow-xl transition-all duration-200"
        style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-primary)',
          color: 'var(--text-primary)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        <CreditCard className="w-4 h-4" />
        <span className="text-sm font-medium">
          {loading ? 'Loading...' : paymentStatus ? (
            isFreePlan ? `${remainingChunks} chunks left` : 'Pro Plan'
          ) : 'Plan'}
        </span>
        {isAtLimit && (
          <span className="text-xs font-medium ml-2 px-1 py-0.5 rounded" 
                style={{ 
                  backgroundColor: 'var(--status-error)', 
                  color: 'white' 
                }}>
            !
          </span>
        )}
      </button>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-20 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Sidebar Panel */}
          <div className="absolute top-0 right-0 h-full w-80 transform transition-transform duration-300 ease-in-out"
               style={{ 
                 backgroundColor: 'var(--bg-card)', 
                 borderLeft: '1px solid var(--border-primary)',
                 boxShadow: 'var(--shadow-lg)'
               }}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-5" 
                 style={{ borderBottom: '1px solid var(--border-secondary)' }}>
              <h2 className="text-lg font-business" style={{ color: 'var(--text-primary)' }}>
                Payment Plan
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-opacity-20 transition-colors"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {loading && (
                <div className="animate-pulse">
                  <div className="h-4 rounded w-1/2 mb-3" 
                       style={{ backgroundColor: 'var(--border-secondary)' }}></div>
                  <div className="h-3 rounded w-3/4" 
                       style={{ backgroundColor: 'var(--border-secondary)' }}></div>
                </div>
              )}

              {error && (
                <div className="rounded-business p-4 mb-4" 
                     style={{ 
                       backgroundColor: 'var(--bg-muted)', 
                       border: '1px solid var(--status-error)' 
                     }}>
                  <p className="text-sm" style={{ color: 'var(--status-error)' }}>
                    Error: {error}
                  </p>
                  <button 
                    onClick={fetchPaymentStatus}
                    className="mt-2 text-sm underline hover:no-underline transition-all"
                    style={{ color: 'var(--status-error)' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && paymentStatus && (
                <>
                  {/* Plan Status Header */}
                  <div className="flex items-center justify-between mb-5">
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
                  <div className="mb-5">
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
                              Limit reached! Upgrade to continue.
                            </span>
                          ) : (
                            `${remainingChunks} chunks remaining`
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="font-medium mb-1" style={{ color: 'var(--status-success)' }}>
                          Unlimited Chunks
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
                      className="w-full py-3 px-4 rounded-business font-medium transition-all duration-200 hover:shadow-md text-white text-sm mb-5"
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
                    <div className="mb-5 p-4 rounded-business" 
                         style={{ 
                           backgroundColor: 'var(--bg-muted)', 
                           border: '1px solid var(--border-secondary)' 
                         }}>
                      <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Pro Plan Benefits:
                      </p>
                      <ul className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
                        <li className="flex items-center">
                          <span className="mr-2">•</span>
                          Unlimited chunk analysis
                        </li>
                        <li className="flex items-center">
                          <span className="mr-2">•</span>
                          Priority processing
                        </li>
                        <li className="flex items-center">
                          <span className="mr-2">•</span>
                          Advanced AI insights
                        </li>
                        <li className="flex items-center">
                          <span className="mr-2">•</span>
                          Export capabilities
                        </li>
                      </ul>
                    </div>
                  )}

                  {/* Plan Dates */}
                  {paymentStatus.plan_start_date && (
                    <div className="pt-4" style={{ borderTop: '1px solid var(--border-secondary)' }}>
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
                </>
              )}

              {!loading && !error && !paymentStatus && (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No payment information available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
