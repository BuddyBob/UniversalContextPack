'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/components/AuthProvider'
import { Check, Star, Zap, Shield, CreditCard, ArrowLeft } from 'lucide-react'

interface PaymentStatus {
  plan: string
  chunks_used: number
  chunks_allowed: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    billing: 'Forever',
    description: 'Perfect for trying out our service',
    features: [
      '5 chunks to analyze',
      'GPT-5 nano AI insights',
      'Standard processing speed',
      'Basic export options'
    ],
    limitations: [
      'Limited chunk analysis',
      'No priority processing',
      'Community support only'
    ],
    recommended: false,
    planId: 'free'
  },
  {
    name: 'Pro Basic',
    price: '$4.99',
    billing: 'per month',
    description: 'Ideal for professionals and freelancers',
    features: [
      '200 chunks per month',
      'GPT-5 nano AI insights',
      'Priority processing',
      'Advanced export capabilities',
      'Email support',
      'API access'
    ],
    limitations: [],
    recommended: true,
    planId: 'pro_basic'
  },
  {
    name: 'Pro Plus',
    price: '$9.99',
    billing: 'per month',
    description: 'Perfect for teams and heavy users',
    features: [
      '500 chunks per month',
      'GPT-5 nano AI insights',
      'Priority processing',
      'Advanced export capabilities',
      'Priority email support',
      'API access',
      'Bulk processing',
      'Custom integrations'
    ],
    limitations: [],
    recommended: false,
    planId: 'pro_plus'
  }
]

export default function PricingPage() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingUpgrade, setProcessingUpgrade] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { user, session, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading) {
      fetchPaymentStatus()
    }
  }, [user, session, authLoading])

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
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setPaymentStatus(data)
    } catch (err) {
      console.error('Error fetching payment status:', err)
      setError('Failed to load payment information')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planId: string) => {
    if (!user || !session?.access_token) {
      // Redirect to login or show auth modal
      return
    }

    if (planId === 'free') {
      // Cannot downgrade in this demo, but you could implement this
      return
    }

    try {
      setProcessingUpgrade(planId)
      setError(null)

      const response = await fetch('http://localhost:8000/api/payment/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: planId,
          return_url: window.location.origin + '/pricing?success=true',
          cancel_url: window.location.origin + '/pricing?cancelled=true'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.payment_url) {
        // Redirect to payment processor
        window.location.href = data.payment_url
      } else {
        // Handle direct upgrade (free to paid without external payment)
        await fetchPaymentStatus()
      }
    } catch (err) {
      console.error('Error upgrading plan:', err)
      setError('Failed to process upgrade. Please try again.')
    } finally {
      setProcessingUpgrade(null)
    }
  }

  const getCurrentPlan = () => {
    return paymentStatus?.plan || 'free'
  }

  const isPlanActive = (planId: string) => {
    return getCurrentPlan() === planId
  }

  const canUpgrade = (planId: string) => {
    const currentPlan = getCurrentPlan()
    if (planId === 'free') return false
    if (planId === 'pro_basic' && currentPlan === 'free') return true
    if (planId === 'pro_plus' && (currentPlan === 'free' || currentPlan === 'pro_basic')) return true
    return false
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-2 rounded-business text-sm font-medium transition-colors"
              style={{ 
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-primary)'
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 className="text-2xl font-business" style={{ color: 'var(--text-primary)' }}>
              Choose Your Plan
            </h1>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-business mb-4" style={{ color: 'var(--text-primary)' }}>
            Professional Plans for Every Need
          </h2>
          <p className="text-lg max-w-2xl mx-auto mb-4" style={{ color: 'var(--text-secondary)' }}>
            Choose the perfect plan to unlock powerful AI-driven analysis and insights for your documents.
          </p>
          <p className="text-sm max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            Powered by GPT-5 nano for lightning-fast, cost-effective document processing with exceptional accuracy.
          </p>
          
          {paymentStatus && (
            <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-business" 
                 style={{ 
                   backgroundColor: 'var(--bg-card)', 
                   border: '1px solid var(--border-primary)' 
                 }}>
              <span style={{ color: 'var(--text-muted)' }}>Current plan:</span>
              <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                {paymentStatus.plan}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {paymentStatus.chunks_used} / {paymentStatus.chunks_allowed === 999999 ? '∞' : paymentStatus.chunks_allowed} chunks used
              </span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 max-w-md mx-auto p-4 rounded-business" 
               style={{ 
                 backgroundColor: 'var(--status-error)', 
                 color: 'white' 
               }}>
            <p className="text-sm text-center">{error}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isActive = isPlanActive(plan.planId)
            const canUpgradeToPlan = canUpgrade(plan.planId)
            const isProcessing = processingUpgrade === plan.planId

            return (
              <div
                key={plan.planId}
                className={`relative rounded-business p-8 shadow-lg transition-all duration-300 ${
                  plan.recommended ? 'ring-2 scale-105' : ''
                } ${isActive ? 'ring-2' : ''}`}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                  '--tw-ring-color': plan.recommended ? 'var(--accent-primary)' : isActive ? 'var(--status-success)' : 'transparent'
                } as React.CSSProperties}
              >
                {/* Recommended Badge */}
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white"
                         style={{ backgroundColor: 'var(--accent-primary)' }}>
                      <Star size={12} />
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Active Badge */}
                {isActive && (
                  <div className="absolute -top-4 right-4">
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white"
                         style={{ backgroundColor: 'var(--status-success)' }}>
                      <Check size={12} />
                      Current Plan
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-business mb-2" style={{ color: 'var(--text-primary)' }}>
                    {plan.name}
                  </h3>
                  <div className="mb-3">
                    <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {plan.price}
                    </span>
                    {plan.billing !== 'Forever' && plan.billing !== 'Contact us' && (
                      <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>
                        /{plan.billing}
                      </span>
                    )}
                    {plan.billing === 'Contact us' && (
                      <span className="block text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {plan.billing}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {plan.description}
                  </p>
                </div>

                {/* Features List */}
                <div className="mb-8">
                  <h4 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                    Everything included:
                  </h4>
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check 
                          size={16} 
                          className="mt-0.5 flex-shrink-0" 
                          style={{ color: 'var(--status-success)' }} 
                        />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="mt-auto">
                  {isActive ? (
                    <div className="w-full py-3 px-4 rounded-business text-center font-medium border"
                         style={{ 
                           backgroundColor: 'var(--bg-muted)', 
                           borderColor: 'var(--border-primary)',
                           color: 'var(--text-muted)' 
                         }}>
                      Current Plan
                    </div>
                  ) : canUpgradeToPlan ? (
                    <button
                      onClick={() => handleUpgrade(plan.planId)}
                      disabled={isProcessing}
                      className="w-full py-3 px-4 rounded-business font-medium transition-all duration-200 flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: plan.recommended ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: plan.recommended ? 'white' : 'var(--accent-primary)',
                        border: `1px solid var(--accent-primary)`,
                        opacity: isProcessing ? 0.7 : 1
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Upgrade Now
                          <CreditCard size={16} />
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="w-full py-3 px-4 rounded-business text-center font-medium border"
                         style={{ 
                           backgroundColor: 'var(--bg-muted)', 
                           borderColor: 'var(--border-primary)',
                           color: 'var(--text-muted)' 
                         }}>
                      Free Forever
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-business mb-4" style={{ color: 'var(--text-primary)' }}>
            Need help choosing?
          </h3>
          <p className="max-w-2xl mx-auto mb-6" style={{ color: 'var(--text-secondary)' }}>
            All plans include our core AI analysis features. Upgrade anytime to unlock additional capabilities and priority support.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>✓ 30-day money-back guarantee</span>
            <span>✓ Cancel anytime</span>
            <span>✓ Instant plan upgrades</span>
            <span>✓ Secure payment processing</span>
          </div>
        </div>
      </div>
    </div>
  )
}
