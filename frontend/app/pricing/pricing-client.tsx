'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/components/AuthProvider'
import { CreditCard, ArrowLeft, Calculator, Sparkles, Zap, Shield, Star } from 'lucide-react'
import { API_ENDPOINTS } from '@/lib/api'
import { getNewUserCredits } from '@/lib/credit-config'
import Image from 'next/image'

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
  const [customCredits, setCustomCredits] = useState(25)
  const [customCreditsInput, setCustomCreditsInput] = useState('25')
  const [isUnlimitedSelected, setIsUnlimitedSelected] = useState(true) // Default to unlimited
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()
  const { user, session, loading: authLoading } = useAuth()

  // Handle URL parameters for pre-filling credits
  useEffect(() => {
    const creditsParam = searchParams?.get('credits')
    if (creditsParam) {
      const credits = parseInt(creditsParam)
      if (credits > 0 && credits <= 10000) {
        const finalCredits = Math.max(2, credits) // Ensure minimum 2
        setCustomCredits(finalCredits)
        setCustomCreditsInput(finalCredits.toString())
      }
    }
  }, [searchParams])

  // Calculate pricing with updated rates
  const calculatePrice = (credits: number) => {
    if (isUnlimitedSelected) return 4.99 // Unlimited for $4.99
    
    // Special pricing for 25 credits
    if (credits === 25) return 1.50
    
    let basePrice = 0.10 // Base price per credit ($0.10)
    
    // Volume discounts
    if (credits >= 250) basePrice = 0.08     // 20% off for 250+
    else if (credits >= 100) basePrice = 0.085 // 15% off for 100+
    else if (credits >= 50) basePrice = 0.09  // 10% off for 50+
    
    return Number((credits * basePrice).toFixed(2))
  }

  const getDiscountPercent = (credits: number) => {
    if (isUnlimitedSelected) return 0
    if (credits >= 250) return 20
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
      // Redirect to Google sign-in if not authenticated
      const supabase = createClientComponentClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/pricing`
        }
      })
      return
    }
    
    setError(null)
    setProcessingPurchase(true)

    try {
      // Create checkout session and redirect directly to Stripe
      const requestBody: any = {
        credits: isUnlimitedSelected ? 0 : customCredits, // 0 for unlimited (rely on unlimited flag)
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Loading pricing information...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Clean Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-6 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
          
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">
              Your Profile. Your AI.
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              Simple, transparent pricing for AI conversation analysis
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Current Balance or Plan Status */}
        {paymentStatus && (
          <div className="mb-12 p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center mr-4">
                  <CreditCard className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  {paymentStatus.plan === 'unlimited' ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">Current plan</p>
                      <p className="text-sm text-gray-600">Unlimited access active</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900">Current balance</p>
                      <p className="text-sm text-gray-600">Available for immediate use</p>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-gray-900">
                  {paymentStatus.plan === 'unlimited' ? 'Unlimited' : (paymentStatus.credits_balance || 0)}
                </p>
                <p className="text-sm text-gray-600">
                  {paymentStatus.plan === 'unlimited' ? 'conversations' : 'credits'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Show plan selection only if user doesn't have unlimited plan */}
        {paymentStatus?.plan !== 'unlimited' ? (
          /* Clean Plan Selection */
          <div className="space-y-6">
            {/* Plan Toggle */}
            <div className="flex justify-center">
              <div className="inline-flex border border-gray-200 rounded-lg p-1 bg-gray-50">
                <button
                  onClick={() => {
                    setIsUnlimitedSelected(false)
                    setCustomCredits(25)
                  }}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                    !isUnlimitedSelected
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  <div className="text-gray-900">Pay per use</div>
                  <div className="text-xs text-gray-500 mt-0.5">From $0.10/credit</div>
                </button>
                <button
                  onClick={() => {
                    setIsUnlimitedSelected(true)
                    setCustomCredits(1000)
                  }}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition-all relative ${
                    isUnlimitedSelected
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="font-semibold">Unlimited</span>
                  </div>
                  <div className={`text-xs mt-0.5 ${isUnlimitedSelected ? 'text-gray-300' : 'text-gray-600'}`}>One-time $4.99</div>
                </button>
              </div>
            </div>

            {/* Social proof */}
            <div className="text-center text-sm text-gray-500">113 users choose Unlimited</div>

          {/* Content based on selection */}
          {isUnlimitedSelected ? (
            /* Unlimited Plan */
            <div className="max-w-md mx-auto">
              <div className="border border-gray-200 rounded-lg p-8 text-center bg-white">
                <div className="mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    Recommended
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Unlimited Access</h3>
                <p className="text-gray-600 mb-6 text-sm">
                  Process unlimited conversations with priority support
                </p>
                <div className="mb-8">
                  <span className="text-4xl font-semibold text-gray-900">$4.99</span>
                  <span className="text-gray-600 ml-2">one-time</span>
                </div>
                <button
                  onClick={handlePurchase}
                  disabled={processingPurchase}
                  className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  {processingPurchase ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Get unlimited access'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Pay Per Use */
            <div className="max-w-lg mx-auto space-y-6">
              {/* Credit Options */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { amount: 5 },
                  { amount: 25 },
                  { amount: 50 },
                ].map(({ amount }) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setCustomCredits(amount)
                      setCustomCreditsInput(amount.toString())
                    }}
                    className={`p-4 text-center border rounded-lg transition-all ${
                      customCredits === amount
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg font-semibold">{amount}</div>
                    <div className="text-sm opacity-80">${calculatePrice(amount)}</div>
                  </button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Custom amount
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      min="2"
                      max="10000"
                      value={customCreditsInput}
                      onChange={(e) => {
                        const value = e.target.value
                        setCustomCreditsInput(value)
                        const credits = parseInt(value) || 0
                        if (credits >= 2 && credits <= 10000) {
                          setCustomCredits(credits)
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent text-gray-900 bg-white"
                      placeholder="25"
                    />
                    <div className="px-3 py-2 bg-gray-50 border border-l-0 border-gray-300 rounded-r-lg text-sm text-gray-900 font-medium">
                      credits
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-medium">
                    Minimum 2 credits. Volume discounts automatically applied.
                  </p>
                </div>

                {/* Price Display */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-lg font-semibold text-gray-900">
                      ${calculatePrice(customCredits)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">Per credit</span>
                    <span className="text-xs text-gray-500">
                      ${getPricePerCredit(customCredits)}
                    </span>
                  </div>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={handlePurchase}
                  disabled={processingPurchase || customCredits < 5}
                  className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  {processingPurchase ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      {customCredits < 5 
                        ? 'Minimum 2 credits required' 
                        : `Purchase ${customCredits} credits`
                      }
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {!user && (
            <div className="max-w-md mx-auto text-center p-8 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign in required</h3>
              <p className="text-gray-700 mb-4 text-sm font-medium">
                Create an account to purchase credits and get started with {getNewUserCredits()} free credits
              </p>
              <button 
                onClick={handlePurchase}
                className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Sign in with Google
              </button>
            </div>
          )}
        </div>
        ) : (
          /* User already has unlimited plan */
          <div className="max-w-md mx-auto text-center p-8 border border-green-200 rounded-lg bg-green-50">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">You have Unlimited Access!</h3>
            <p className="text-gray-700 mb-4 text-sm">
              Process unlimited conversations with no restrictions. Your unlimited plan is active and ready to use.
            </p>
            <button 
              onClick={() => router.push('/process')}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Start Processing
            </button>
          </div>
        )}

        {/* Security Notice */}
        <div className="text-center mt-8 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <Shield className="h-4 w-4 mr-2" />
            Payments secured by Stripe
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center max-w-md mx-auto">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Payment Error</span>
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}