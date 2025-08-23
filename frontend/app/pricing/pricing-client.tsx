'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/components/AuthProvider'
import { CreditCard, ArrowLeft, Calculator, Sparkles, Zap, Shield, Star } from 'lucide-react'
import StripePaymentForm from '@/components/StripePaymentForm'
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
  const [customCredits, setCustomCredits] = useState(25)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { user, session, loading: authLoading } = useAuth()

  // Calculate pricing with volume discounts - much more reasonable pricing
  const calculatePrice = (credits: number) => {
    let basePrice = 0.10 // Base price per credit ($0.10)
    
    // Volume discounts
    if (credits >= 250) basePrice = 0.08      // 20% off for 250+
    else if (credits >= 100) basePrice = 0.09 // 10% off for 100+
    else if (credits >= 50) basePrice = 0.095 // 5% off for 50+
    
    return Number((credits * basePrice).toFixed(2))
  }

  const getDiscountPercent = (credits: number) => {
    if (credits >= 250) return 20
    if (credits >= 100) return 10
    if (credits >= 50) return 5
    return 0
  }

  const getPricePerCredit = (credits: number) => {
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

  const handlePurchase = () => {
    if (!user) {
      router.push('/auth')
      return
    }
    setShowPaymentForm(true)
    setError(null)
  }

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false)
    setProcessingPurchase(false)
    await fetchPaymentStatus()
    
    // Show success message and redirect
    setTimeout(() => {
      router.push('/process?upgraded=true')
    }, 2000)
  }

  const handlePaymentError = (error: string) => {
    setError(error)
    setProcessingPurchase(false)
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
              {showPaymentForm ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-xl font-medium text-white mb-2">
                      Complete Your Purchase
                    </h3>
                    <p className="text-gray-400">
                      {customCredits} credits for ${calculatePrice(customCredits)}
                    </p>
                  </div>
                  
                  <StripePaymentForm
                    credits={customCredits}
                    amount={calculatePrice(customCredits)}
                    session={session}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                  
                  <button
                    onClick={() => setShowPaymentForm(false)}
                    className="w-full text-gray-400 hover:text-white transition-colors"
                  >
                    ← Cancel
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Credit Amount Input */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Credit Amount
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={customCredits}
                        onChange={(e) => setCustomCredits(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                        className="w-full bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 text-white text-lg font-medium focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-400/20"
                        placeholder="Enter amount"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Total Cost
                      </label>
                      <div className="bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 h-12 flex items-center">
                        <span className="text-2xl font-bold text-white">${calculatePrice(customCredits)}</span>
                        <span className="text-gray-400 ml-2 text-sm">USD</span>
                      </div>
                    </div>
                  </div>

                  {/* Professional Slider */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-4">
                      Adjust Credit Amount
                    </label>
                    <div className="relative">
                      <input
                        type="range"
                        min="1"
                        max="500"
                        value={customCredits}
                        onChange={(e) => setCustomCredits(Number(e.target.value))}
                        className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #ffffff 0%, #ffffff ${(customCredits / 500) * 100}%, #374151 ${(customCredits / 500) * 100}%, #374151 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-3">
                        <span>1 credit</span>
                        <span className="text-gray-400">${getPricePerCredit(customCredits)} per credit</span>
                        <span>500 credits</span>
                      </div>
                    </div>
                  </div>

                  {/* Business Tier Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-4">
                      Popular Business Tiers
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { amount: 25, label: 'Starter', desc: 'Small projects' },
                        { amount: 100, label: 'Professional', desc: 'Regular use', popular: true },
                        { amount: 250, label: 'Business', desc: 'Team projects' },
                        { amount: 500, label: 'Enterprise', desc: 'Large scale' }
                      ].map(({ amount, label, desc, popular }) => (
                        <button
                          key={amount}
                          onClick={() => setCustomCredits(amount)}
                          className={`relative p-4 rounded-lg border transition-all text-left ${
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
                          <div className="font-semibold text-white">{amount}</div>
                          <div className="text-xs text-gray-400 mb-1">{label}</div>
                          <div className="text-xs text-gray-500">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Details */}
                  <div className="bg-gray-900 border border-gray-600 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-lg text-gray-300">Subtotal</div>
                        <div className="text-xs text-gray-500">{customCredits} credits × ${getPricePerCredit(customCredits)}</div>
                      </div>
                      <div className="text-xl font-semibold text-white">${calculatePrice(customCredits)}</div>
                    </div>
                    
                    {getDiscountPercent(customCredits) > 0 && (
                      <div className="flex items-center justify-between mb-4 text-green-400">
                        <div className="flex items-center">
                          <Zap className="h-4 w-4 mr-2" />
                          <span className="text-sm">Volume Discount ({getDiscountPercent(customCredits)}% off)</span>
                        </div>
                        <div className="font-medium">-${(customCredits * 0.10 - calculatePrice(customCredits)).toFixed(2)}</div>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-600 pt-4 flex items-center justify-between">
                      <div className="text-lg font-semibold text-white">Total</div>
                      <div className="text-2xl font-bold text-white">${calculatePrice(customCredits)} USD</div>
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
                        Purchase {customCredits} Credits - ${calculatePrice(customCredits)}
                      </>
                    )}
                  </button>

                  {/* Security & Trust Indicators */}
                  <div className="flex items-center justify-center space-x-6 text-xs text-gray-500">
                    <div className="flex items-center">
                      <Shield className="h-3 w-3 mr-1" />
                      Secure Payment
                    </div>
                    <div className="flex items-center">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Powered by Stripe
                    </div>
                    <div className="flex items-center">
                      <Star className="h-3 w-3 mr-1" />
                      Credits Never Expire
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="text-center">
          <h3 className="text-xl font-medium text-text-primary mb-6 mt-12">
            How Credits Work
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="h-5 w-5 text-accent-primary" />
              </div>
              <h4 className="font-medium text-text-primary mb-1">Pay Per Use</h4>
              <p className="text-text-secondary text-sm">
                1 credit = 1 conversation chunk analyzed with GPT-5 nano. Credits never expire.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Zap className="h-5 w-5 text-accent-primary" />
              </div>
              <h4 className="font-medium text-text-primary mb-1">Volume Discounts</h4>
              <p className="text-text-secondary text-sm">
                Save up to 33% automatically when purchasing larger amounts.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Star className="h-5 w-5 text-accent-primary" />
              </div>
              <h4 className="font-medium text-text-primary mb-1">Premium AI</h4>
              <p className="text-text-secondary text-sm">
                Each analysis uses the latest GPT-5 nano for deep conversation insights.
              </p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center max-w-md mx-auto text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Professional Slider Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 3px solid #1f2937;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          transition: all 0.2s ease;
        }
        
        .slider::-webkit-slider-thumb:hover {
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
          transform: scale(1.1);
        }
        
        .slider::-moz-range-thumb {
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 3px solid #1f2937;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .slider:focus {
          outline: none;
        }

        .slider:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}