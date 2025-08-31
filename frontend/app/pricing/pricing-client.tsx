'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/components/AuthProvider'
import { CreditCard, ArrowLeft, Calculator, Sparkles, Zap, Shield, Star } from 'lucide-react'
import { API_ENDPOINTS } from '@/lib/api'

interface PaymentStatus {
  plan: string
  chunks_used: number
  chunks_allowed: number
  credits_balance?: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
}

export default function PricingPageClient() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingPurchase, setProcessingPurchase] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customCredits, setCustomCredits] = useState(50)
  const [isUnlimitedSelected, setIsUnlimitedSelected] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { user, session, loading: authLoading } = useAuth()

  // Calculate pricing with much lower prices
  const calculatePrice = (credits: number) => {
    if (isUnlimitedSelected) return 20.00 // Unlimited for $20
    
    let basePrice = 0.02 // Base price per credit ($0.02 - 5x cheaper!)
    
    // Volume discounts
    if (credits >= 250) basePrice = 0.015     // 25% off for 250+
    else if (credits >= 100) basePrice = 0.017 // 15% off for 100+
    else if (credits >= 50) basePrice = 0.018  // 10% off for 50+
    
    return Number((credits * basePrice).toFixed(2))
  }

  const getDiscountPercent = (credits: number) => {
    if (isUnlimitedSelected) return 0
    if (credits >= 250) return 25
    if (credits >= 100) return 15
    if (credits >= 50) return 10
    return 0
  }

  const getPricePerCredit = (credits: number) => {
    if (isUnlimitedSelected) return "∞"
    return (calculatePrice(credits) / credits).toFixed(3)
  }

  useEffect(() => {
    if (authLoading) return
    
    if (user && session) {
      fetchPaymentStatus()
    } else {
      setLoading(false)
    }
  }, [user, session, authLoading])

  const fetchPaymentStatus = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.paymentStatus, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPaymentStatus(data)
      }
    } catch (error) {
      console.error('Error fetching payment status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async () => {
    if (!user) {
      router.push('/auth')
      return
    }
    
    setError(null)
    setProcessingPurchase(true)

    try {
      // Create checkout session and redirect directly to Stripe
      const requestBody: any = {
        credits: isUnlimitedSelected ? -1 : customCredits, // -1 indicates unlimited
        amount: calculatePrice(customCredits)
      }
      
      // Only include unlimited field if it's true (for backward compatibility)
      if (isUnlimitedSelected) {
        requestBody.unlimited = true
      }
      
      const response = await fetch(API_ENDPOINTS.createCheckoutSession, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to create checkout session')
      }

      const data = await response.json()
      
      // Redirect directly to Stripe Checkout
      window.location.href = data.checkout_url

    } catch (error: any) {
      console.error('Checkout error:', error)
      setError(error.message || 'Failed to start checkout process')
      setProcessingPurchase(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-text-primary">Loading pricing information...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary">
       <button
            onClick={() => router.back()}
            className="inline-flex items-center text-text-secondary hover:text-text-primary mb-8 mt-8 ml-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
      <div className="max-w-4xl mx-auto px-4 py-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-white mb-4">
            Analysis Credits
          </h1>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
            Professional conversation analysis powered by advanced AI. Pay only for what you use.
          </p>
          <div className="inline-flex items-center bg-gray-800 border border-gray-600 rounded-lg px-4 py-2">
            <Sparkles className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-gray-300 text-sm">5 free credits included with every account</span>
          </div>
        </div>

        {/* Current Balance */}
        {paymentStatus && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-gray-800 border border-gray-600 rounded-lg px-6 py-3">
              <CreditCard className="h-4 w-4 text-gray-400 mr-3" />
              <span className="text-gray-300 mr-2">Available Credits:</span>
              <span className="text-2xl font-bold text-white">
                {paymentStatus.credits_balance || 0}
              </span>
            </div>
          </div>
        )}

        {/* Business Credit Calculator */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 border border-gray-600 rounded-xl overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-8 py-6 border-b border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Purchase Credits</h3>
                  <p className="text-gray-300 text-sm mt-1">1 credit = 1 conversation chunk (~150k tokens)</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-white">{customCredits}</div>
                  <div className="text-gray-300 text-sm">analysis credits</div>
                </div>
              </div>
            </div>

            {/* Credit Selection Interface */}
            <div className="p-8">
              <div className="space-y-8">
                  {/* Plan Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-4">
                      Choose Your Plan
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <button
                        onClick={() => {
                          setIsUnlimitedSelected(false)
                          setCustomCredits(50)
                        }}
                        className={`p-6 rounded-lg border transition-all text-left ${
                          !isUnlimitedSelected
                            ? 'border-white bg-gray-700 shadow-lg'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-white text-lg">Pay Per Use</div>
                          <div className="text-sm text-gray-400">Starting at $0.50</div>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">Credits (85% cheaper!)</div>
                        <div className="text-xs text-gray-500">Perfect for occasional use • Credits never expire</div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setIsUnlimitedSelected(true)
                          setCustomCredits(1000) // Set high number for display
                        }}
                        className={`relative p-6 rounded-lg border transition-all text-left ${
                          isUnlimitedSelected
                            ? 'border-white bg-gray-700 shadow-lg'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                      >
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                            Best Value
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-white text-lg">Unlimited</div>
                          <div className="text-sm text-green-400">$20 once</div>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">One-time payment</div>
                        <div className="text-xs text-gray-500">Use as much as you want • Lifetime access</div>
                      </button>
                    </div>
                  </div>

                  {!isUnlimitedSelected && (
                    <>
                      {/* Business Tier Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-4">
                          Choose Credit Amount
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            { amount: 50, label: 'Starter', desc: 'Small projects', price: '$1.00' },
                            { amount: 100, label: 'Professional', desc: 'Regular use', popular: true, price: '$1.70' },
                            { amount: 250, label: 'Business', desc: 'Team projects', price: '$3.75' }
                          ].map(({ amount, label, desc, popular, price }) => (
                            <button
                              key={amount}
                              onClick={() => setCustomCredits(amount)}
                              className={`relative p-6 rounded-lg border transition-all text-center ${
                                customCredits === amount
                                  ? 'border-white bg-gray-700 shadow-lg'
                                  : 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'
                              }`}
                            >
                              {popular && (
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                                  <span className="bg-white text-gray-900 text-xs px-2 py-1 rounded-full font-medium">
                                    Popular
                                  </span>
                                </div>
                              )}
                              <div className="text-2xl font-bold text-white mb-1">{amount}</div>
                              <div className="text-sm text-gray-400 mb-1">{label}</div>
                              <div className="text-lg font-semibold text-green-400 mb-1">{price}</div>
                              <div className="text-xs text-gray-500">{desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Simplified Pricing Summary */}
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">
                      ${calculatePrice(customCredits)}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {isUnlimitedSelected 
                        ? 'One-time payment • Lifetime access' 
                        : `${customCredits} credits • $${getPricePerCredit(customCredits)} each`
                      }
                    </div>
                  </div>

                  {/* Purchase Button */}
                  <button
                    onClick={handlePurchase}
                    disabled={processingPurchase}
                    className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-600 text-gray-900 disabled:text-gray-400 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center"
                  >
                    {processingPurchase ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        {isUnlimitedSelected 
                          ? `Get Unlimited Access - $20.00`
                          : `Continue to Secure Payment - $${calculatePrice(customCredits)}`
                        }
                      </>
                    )}
                  </button>

                  {/* Security Indicator */}
                  <div className="flex items-center justify-center text-xs text-gray-500">
                    <Shield className="h-3 w-3 mr-1" />
                    Secure Payment Powered by Stripe
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* Simple Benefits */}
        <div className="text-center">
          <div className="max-w-md mx-auto">
            <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Shield className="h-5 w-5 text-accent-primary" />
            </div>
            <h4 className="font-medium text-text-primary mb-2">Simple & Secure</h4>
            <p className="text-text-secondary text-sm">
              1 credit = 1 conversation chunk analyzed. Credits never expire. Secure payments via Stripe.
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center max-w-md mx-auto text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}