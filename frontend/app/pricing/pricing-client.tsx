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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading pricing information...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Clean Header */}
      <div className="border-b border-gray-800/50">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-400 hover:text-gray-300 mb-6 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
              Your Profile. Your AI.
            </h1>
            <p className="text-base text-gray-400 max-w-lg mx-auto">
              Simple, transparent pricing for AI conversation analysis
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Current Balance - Separate Card */}
        {paymentStatus && paymentStatus.plan !== 'unlimited' && (
          <div className="mb-6 p-5 bg-gray-900/30 border border-gray-800/60 rounded-2xl max-w-lg mx-auto shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-base text-white font-medium">Current balance</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-white">{paymentStatus.credits_balance || 0}</span>
                <span className="text-sm text-gray-400 ml-2">credits</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Pricing Card */}
        <div className="max-w-lg mx-auto bg-gray-900/30 border border-gray-800/60 rounded-2xl p-8 shadow-xl">
          {/* User already has unlimited plan */}
          {paymentStatus?.plan === 'unlimited' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">You have Unlimited Access!</h3>
              <p className="text-gray-400 mb-6">
                Process unlimited conversations with no restrictions.
              </p>
              <button
                onClick={() => router.push('/process')}
                className="w-full bg-white hover:bg-gray-50 text-gray-900 px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Start Processing
              </button>
            </div>
          ) : (
            <>
              {/* Plan Toggle */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex border border-gray-800/60 rounded-xl p-1.5 bg-gray-900/40 shadow-lg w-full">
                  <button
                    onClick={() => {
                      setIsUnlimitedSelected(false)
                      setCustomCredits(25)
                    }}
                    className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isUnlimitedSelected
                        ? 'bg-gray-800 text-white shadow-md'
                        : 'text-gray-400 hover:text-gray-300'
                      }`}
                  >
                    <div className={!isUnlimitedSelected ? 'text-white' : 'text-gray-400'}>Pay per use</div>
                    <div className={`text-xs mt-0.5 ${!isUnlimitedSelected ? 'text-gray-400' : 'text-gray-500'}`}>From $0.10/credit</div>
                  </button>
                  <button
                    onClick={() => {
                      setIsUnlimitedSelected(true)
                      setCustomCredits(1000)
                    }}
                    className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${isUnlimitedSelected
                        ? 'bg-white text-gray-900 shadow-md'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                      }`}
                  >
                    <div className="flex items-center justify-center">
                      <span className="font-semibold">Unlimited</span>
                    </div>
                    <div className={`text-xs mt-0.5 ${isUnlimitedSelected ? 'text-gray-600' : 'text-gray-500'}`}>One-time $4.99</div>
                  </button>
                </div>
              </div>

              {/* Content based on selection */}
              {isUnlimitedSelected ? (
                /* Unlimited Plan */
                <div className="text-center">
                  <div className="mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-800/60 text-gray-300 border border-gray-700/50">
                      Recommended
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Unlimited Access</h3>
                  <p className="text-gray-400 mb-8 text-sm leading-relaxed">
                    Unlimited tokens & Unlimited conversations
                  </p>
                  <div className="mb-8">
                    <span className="text-5xl font-bold text-white">$4.99</span>
                    <span className="text-gray-400 ml-2 text-base">one-time</span>
                  </div>
                  <button
                    onClick={handlePurchase}
                    disabled={processingPurchase}
                    className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-700 text-gray-900 py-3.5 px-6 rounded-xl font-semibold text-base transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
                  >
                    {processingPurchase ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      user ? 'Get unlimited access' : 'Sign in to Continue'
                    )}
                  </button>
                  {!user && (
                    <p className="text-center text-sm text-gray-400 mt-3">
                      Get {getNewUserCredits()} free credits when you sign up
                    </p>
                  )}
                </div>
              ) : (
                /* Pay Per Use */
                <div className="space-y-6">
                  {/* Credit Options */}
                  <div className="grid grid-cols-3 gap-3">
                    {[5, 25, 50].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setCustomCredits(amount)
                          setCustomCreditsInput(amount.toString())
                        }}
                        className={`p-4 text-center border rounded-xl transition-all ${customCredits === amount
                            ? 'border-white bg-white text-gray-900 shadow-lg'
                            : 'border-gray-800/60 bg-gray-900/30 text-white hover:border-gray-700'
                          }`}
                      >
                        <div className="text-lg font-semibold">{amount}</div>
                        <div className="text-sm opacity-80">${calculatePrice(amount)}</div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
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
                        className="flex-1 px-4 py-2.5 border border-gray-700/60 rounded-l-xl focus:ring-2 focus:ring-gray-600 focus:border-transparent text-white bg-gray-900/30"
                        placeholder="25"
                      />
                      <div className="px-4 py-2.5 bg-gray-800/50 border border-l-0 border-gray-700/60 rounded-r-xl text-sm text-white font-medium">
                        credits
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 font-medium">
                      Minimum 2 credits. Volume discounts automatically applied.
                    </p>
                  </div>

                  {/* Price Display */}
                  <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl p-5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Total</span>
                      <span className="text-lg font-semibold text-white">
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
                    className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-700 text-gray-900 py-3.5 px-6 rounded-xl font-semibold text-base transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
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
                          : user
                            ? `Purchase ${customCredits} credits`
                            : 'Sign in to Continue'
                        }
                      </>
                    )}
                  </button>
                  {!user && (
                    <p className="text-center text-sm text-gray-400">
                      Get {getNewUserCredits()} free credits when you sign up
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-800/40 text-center">
            <div className="flex items-center justify-center text-xs text-gray-500">
              <Shield className="h-3 w-3 mr-1" />
              Payments secured by Stripe
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-center max-w-lg mx-auto">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
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