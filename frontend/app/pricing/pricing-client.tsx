'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/components/AuthProvider'
import { CreditCard, ArrowLeft, Calculator, Zap, Shield, CheckCircle, Infinity } from 'lucide-react'
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
  const calculatePrice = (credits: number, unlimited: boolean = false) => {
    if (unlimited) return 4.99 // Unlimited for $4.99

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
        amount: calculatePrice(isUnlimitedSelected ? 0 : customCredits, isUnlimitedSelected)
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

      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Current Balance - Separate Card */}
        {paymentStatus && paymentStatus.plan !== 'unlimited' && (
          <div className="mb-12 p-5 bg-[#181818] border border-[#2e2e2e] rounded-xl max-w-md mx-auto shadow-lg">
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

        {/* Conditional Rendering: Single Card for Unlimited, 3 Cards for Others */}
        {paymentStatus?.plan === 'unlimited' ? (
          /* Unlimited User - Single Professional Active Plan Card */
          <div className="max-w-xl mx-auto">
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8 shadow-lg relative">
              {/* Active Badge */}
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black shadow-md">
                  ACTIVE PLAN
                </span>
              </div>
              
              {/* Icon */}
              <div className="flex justify-center mb-6 mt-2">
                <div className="w-16 h-16 bg-[#2d2d2d] rounded-lg flex items-center justify-center">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>

              {/* Title & Description */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-white mb-2">Unlimited Access</h3>
                <p className="text-[#9ca3af] text-base leading-relaxed">
                  You have full unlimited access to process conversations with no restrictions.
                </p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center">
                  <div className="w-5 h-5 rounded-md bg-[#2d2d2d] flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#e5e7eb] font-medium">Unlimited chunks processing</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 rounded-md bg-[#2d2d2d] flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#e5e7eb] font-medium">Full AI analysis</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 rounded-md bg-[#2d2d2d] flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#e5e7eb] font-medium">Priority processing</span>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => router.push('/process')}
                className="w-full bg-white hover:bg-gray-100 text-black py-3 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg flex items-center justify-center"
              >
                Start Processing
                <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
              </button>
            </div>
          </div>
        ) : (
          /* Non-Unlimited Users - 3 Column Pricing Cards Layout */
          <>
            {/* Shared Features Strip */}
            <div className="mb-12 text-center">
              <p className="text-sm text-[#9ca3af] mb-6">All plans include</p>
              <div className="flex flex-wrap justify-center gap-8 max-w-2xl mx-auto">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#6b7280]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-[#9ca3af]">Full AI analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#6b7280]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-[#9ca3af]">Secure processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#6b7280]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-[#9ca3af]">Instant results</span>
                </div>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className={`grid grid-cols-1 gap-8 mx-auto ${!user ? 'md:grid-cols-3 max-w-6xl' : 'md:grid-cols-2 max-w-4xl justify-center'}`}>
              {/* Free Plan Card */}
              {!user && (
                <div className="bg-[#0a0a0a] border border-[#2e2e2e] rounded-xl p-8 flex flex-col">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-semibold text-white mb-3">Free</h3>
                    <div className="mb-2">
                      <span className="text-5xl font-bold text-white">{getNewUserCredits()}</span>
                    </div>
                    <p className="text-sm text-[#6b7280]">credits to start</p>
                  </div>
                  
                  <div className="flex-grow mb-8">
                    <p className="text-sm text-[#9ca3af] text-center">Perfect for trying out the platform</p>
                  </div>

                  <button
                    onClick={handlePurchase}
                    className="w-full border border-[#323232] hover:border-[#3a3a3a] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200"
                  >
                    Sign Up Free
                  </button>
                </div>
              )}

              {/* Unlimited Plan Card - DOMINANT */}
              <div className="bg-[#1E1E1E] border-2 border-white/20 rounded-xl p-10 flex flex-col relative transform md:scale-105 shadow-[0_0_50px_-12px_rgba(255,255,255,0.15)]">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold bg-white text-black">
                    RECOMMENDED
                  </span>
                </div>
                
                <div className="text-center mb-10">
                  <h3 className="text-xl font-semibold text-white mb-4">Unlimited</h3>
                  <div className="mb-2">
                    <span className="text-6xl font-bold text-white">$4.99</span>
                  </div>
                  <p className="text-sm text-[#9ca3af]">one-time payment</p>
                </div>
                
                <div className="flex-grow mb-10">
                  <p className="text-sm text-[#9ca3af] text-center mb-6">Unlimited conversations forever</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-white font-medium">No limits</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-white font-medium">Priority support</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsUnlimitedSelected(true)
                    handlePurchase()
                  }}
                  disabled={processingPurchase}
                  className="w-full bg-white hover:bg-gray-100 text-black py-4 px-6 rounded-lg font-semibold transition-all duration-200 shadow-lg"
                >
                  {processingPurchase ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent mr-2 inline-block"></div>
                      Processing...
                    </>
                  ) : user ? (
                    'Get Unlimited'
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>

              {/* Pay Per Use Card */}
              <div className="bg-[#0a0a0a] border border-[#2e2e2e] rounded-xl p-8 flex flex-col">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-white mb-3">Flexible</h3>
                  {!user ? (
                    <>
                      <div className="mb-2">
                        <span className="text-5xl font-bold text-white">$0.08</span>
                      </div>
                      <p className="text-sm text-[#6b7280]">per credit</p>
                    </>
                  ) : (
                    <>
                      <div className="mb-2">
                        <span className="text-5xl font-bold text-white">${calculatePrice(customCredits, false)}</span>
                      </div>
                      <p className="text-sm text-[#6b7280]">total price</p>
                    </>
                  )}
                </div>
                
                <div className="flex-grow mb-8">
                  {!user ? (
                    <p className="text-sm text-[#9ca3af] text-center">Pay only for what you use</p>
                  ) : (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm text-[#9ca3af] mb-2 block text-center">Number of credits</span>
                        <input
                          type="number"
                          min="2"
                          max="10000"
                          value={customCreditsInput}
                          onChange={(e) => {
                            const value = e.target.value
                            setCustomCreditsInput(value)
                            const credits = parseInt(value) || 2
                            const finalCredits = Math.max(2, Math.min(10000, credits))
                            setCustomCredits(finalCredits)
                            setIsUnlimitedSelected(false)
                          }}
                          onFocus={() => setIsUnlimitedSelected(false)}
                          className="w-full bg-[#181818] border border-[#2e2e2e] rounded-lg px-4 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:border-[#3a3a3a]"
                        />
                      </label>
                      <div className="text-center pt-2">
                        <p className="text-xs text-[#6b7280]">
                          ${getPricePerCredit(customCredits)} per credit
                          {getDiscountPercent(customCredits) > 0 && ` • ${getDiscountPercent(customCredits)}% discount`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsUnlimitedSelected(false)
                    handlePurchase()
                  }}
                  disabled={processingPurchase}
                  className="w-full border border-[#323232] hover:border-[#3a3a3a] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingPurchase && !isUnlimitedSelected ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 inline-block"></div>
                      Processing...
                    </>
                  ) : user ? (
                    `Buy ${customCredits} Credits`
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center text-xs text-gray-500">
            <Shield className="h-3 w-3 mr-1" />
            Payments secured by Stripe
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