'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/components/AuthProvider'
import { CreditCard, ArrowLeft, Calculator, Sparkles, Zap, Shield, Star } from 'lucide-react'
import { API_ENDPOINTS } from '@/lib/api'
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
  const [isUnlimitedSelected, setIsUnlimitedSelected] = useState(false)
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
        const finalCredits = Math.max(5, credits) // Ensure minimum 5
        setCustomCredits(finalCredits)
        setCustomCreditsInput(finalCredits.toString())
      }
    }
  }, [searchParams])

  // Calculate pricing with updated rates
  const calculatePrice = (credits: number) => {
    if (isUnlimitedSelected) return 12.99 // Unlimited for $12.99
    
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
          
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/Logo.png"
                alt="Universal Context Pack"
                width={64}
                height={64}
                className="rounded-lg"
              />
            </div>
            <h1 className="text-h1 text-gray-900 mb-2">
              Professional AI Analysis
            </h1>
            <p className="text-body text-gray-600 max-w-2xl mx-auto">
              Enterprise-grade conversation analysis with transparent, pay-as-you-go pricing.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Current Balance */}
        {paymentStatus && (
          <div className="text-center mb-12">
            <div className="inline-flex items-center bg-blue-50 border border-blue-200 rounded-xl px-6 py-4">
              <CreditCard className="h-5 w-5 text-blue-600 mr-3" />
              <span className="text-gray-700 mr-2 font-medium">Available Credits:</span>
              <span className="text-2xl font-bold text-blue-600">
                {paymentStatus.credits_balance || 0}
              </span>
            </div>
          </div>
        )}

        {/* Trust Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Secure & Encrypted</h3>
            <p className="text-sm text-gray-600">Enterprise-grade security with end-to-end encryption</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Fast Processing</h3>
            <p className="text-sm text-gray-600">Advanced AI models deliver results in minutes</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Star className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Professional Quality</h3>
            <p className="text-sm text-gray-600">Trusted by professionals and enterprises</p>
          </div>
        </div>

        {!user ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sign in to purchase credits</h2>
            <p className="text-gray-600 mb-6">
              Create an account to get started with 5 free credits
            </p>
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
              Sign In
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gray-50 px-8 py-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 text-center">Choose Your Plan</h2>
              <p className="text-center text-gray-600 mt-2">Flexible pricing that scales with your needs</p>
            </div>
            
            <div className="p-8">
              {/* Plan Selection */}
              <div className="grid-12 mb-8">
                <button
                  onClick={() => {
                    setIsUnlimitedSelected(false)
                    setCustomCredits(25)
                  }}
                  className={`col-span-12 md:col-span-6 p-6 rounded-xl border-2 transition-all ${
                    !isUnlimitedSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">Pay Per Use</h3>
                      <Calculator className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Perfect for occasional use</p>
                    <div className="text-sm text-gray-500">
                      • Credits never expire<br/>
                      • Volume discounts available<br/>
                      • Pay only for what you use
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setIsUnlimitedSelected(true)
                    setCustomCredits(1000)
                  }}
                  className={`col-span-12 md:col-span-6 relative p-6 rounded-xl border-2 transition-all ${
                    isUnlimitedSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="absolute -top-3 left-6">
                    <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">Unlimited Access</h3>
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Best value for power users</p>
                    <div className="text-sm text-gray-500">
                      • Process unlimited conversations<br/>
                      • One-time payment<br/>
                      • Priority processing
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-purple-600">$12.99</span>
                      <span className="text-sm text-gray-500 ml-1">One Time</span>
                    </div>
                  </div>
                </button>
              </div>
              {!isUnlimitedSelected && (
                <div className="space-y-6">
                  {/* Preset Credit Options */}
                  <div className="grid-12">
                    {[
                      { amount: 5, price: '$0.50' },
                      { amount: 25, price: '$2.50' },
                      { amount: 50, price: '$4.50', popular: true },
                      { amount: 100, price: '$8.50' }
                    ].map(({ amount, price, popular }) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setCustomCredits(amount)
                          setCustomCreditsInput(amount.toString())
                        }}
                        className={`col-span-6 lg:col-span-3 relative p-4 rounded-lg border-2 transition-all text-center ${
                          customCredits === amount
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {popular && (
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                            <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-2 py-1 rounded-full">
                              Popular
                            </span>
                          </div>
                        )}
                        <div className="text-2xl font-bold text-gray-900">{amount}</div>
                        <div className="text-green-600 font-medium">{price}</div>
                        <div className="text-xs text-gray-500 mt-1">credits</div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Or enter a custom amount:
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        min="5"
                        max="10000"
                        value={customCreditsInput}
                        onChange={(e) => {
                          const value = e.target.value
                          setCustomCreditsInput(value)
                          const credits = parseInt(value) || 0
                          if (credits >= 5 && credits <= 10000) {
                            setCustomCredits(credits)
                          }
                        }}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="25"
                      />
                      <span className="text-gray-600 font-medium">credits</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      Minimum: 5 credits ($0.50) • Recommended: 25-250 credits for most conversations
                    </div>
                  </div>
                </div>
              )}

              {/* Price Display */}
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  ${calculatePrice(customCredits)}
                </div>
                <div className="text-gray-600 text-sm">
                  {isUnlimitedSelected ? 'One-time payment for unlimited access' : `$${getPricePerCredit(customCredits)} per credit`}
                </div>
                {!isUnlimitedSelected && getDiscountPercent(customCredits) > 0 && (
                  <div className="mt-2 inline-flex items-center bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    <span className="mr-1">💰</span>
                    {getDiscountPercent(customCredits)}% volume discount applied
                  </div>
                )}
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                disabled={processingPurchase || (!isUnlimitedSelected && customCredits < 5)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-lg font-semibold transition-all flex items-center justify-center shadow-lg disabled:shadow-none"
              >
                {processingPurchase ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-3" />
                    {(!isUnlimitedSelected && customCredits < 5) ? 
                      'Minimum 5 credits required' : 
                      `Continue to Payment - ${isUnlimitedSelected ? '$12.99' : '$' + calculatePrice(customCredits)}`
                    }
                  </>
                )}
              </button>

              {/* Security Badge */}
              <div className="flex items-center justify-center text-sm text-gray-500 bg-gray-50 rounded-lg py-3">
                <Shield className="h-4 w-4 mr-2 text-green-600" />
                <span>Secure Payment Powered by</span>
                <span className="font-semibold text-blue-600 ml-1">Stripe</span>
              </div>
            </div>
          </div>
        )}

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