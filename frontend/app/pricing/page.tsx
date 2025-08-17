'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/components/AuthProvider'
import { CreditCard, ArrowLeft, Calculator, Sparkles, Zap, Shield, Star } from 'lucide-react'

interface PaymentStatus {
  plan: string
  chunks_used: number
  chunks_allowed: number
  credits_balance?: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
}

export default function PricingPage() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingPurchase, setProcessingPurchase] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customCredits, setCustomCredits] = useState(25)
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/payment/status`, {
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

    setProcessingPurchase(true)
    setError(null)

    try {
      const price = calculatePrice(customCredits)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/payment/purchase-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          credits: customCredits,
          amount: price,
          package_id: `custom_${customCredits}`
        }),
      })

      if (response.ok) {
        await fetchPaymentStatus()
        router.push('/process?upgraded=true')
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Purchase failed')
      }
    } catch (error) {
      setError('Network error occurred')
    } finally {
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
        <div className="text-center mb-16">
          
          <h1 className="text-3xl font-semibold text-text-primary mb-2">
            Purchase Chunk Analysis Credits
          </h1>
          <p className="text-lg text-text-secondary mb-4 max-w-2xl mx-auto">
            1 credit ⇒ 1 chunk <strong>(150k tokens)</strong>
          </p>
          <div className="inline-flex items-center bg-green-50 text-green-700 px-3 py-1.5 rounded-md text-sm">
            <Sparkles className="h-3 w-3 mr-1.5" />
            5 free credits included
          </div>
        </div>

        {/* Current Balance */}
        {paymentStatus && (
          <div className="text-center mb-6">
            <div className="inline-flex items-center bg-bg-card border border-border-primary rounded-lg px-5 py-3">
              <CreditCard className="h-4 w-4 text-accent-primary mr-2" />
              <span className="text-text-secondary mr-2 text-sm">Current Balance:</span>
              <span className="text-xl font-medium text-text-primary">
                {paymentStatus.credits_balance || 0} credits
              </span>
            </div>
          </div>
        )}

        {/* Credit Calculator */}
        <div className="max-w-xl mx-auto mb-16">
          <div className="bg-bg-card border border-border-primary rounded-lg p-6">
            
            <div className="space-y-6">
              {/* Credit Amount Display */}
              <div className="text-center">
                <div className="text-4xl font-medium text-accent-primary mb-1">
                  {customCredits}
                </div>
                <div className="text-sm text-text-secondary">
                  conversation chunks to analyze
                </div>
              </div>

              {/* Credit Slider */}
              <div>
                <input
                  type="range"
                  min="1"
                  max="500"
                  value={customCredits}
                  onChange={(e) => setCustomCredits(Number(e.target.value))}
                  className="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, rgb(102, 57, 208) 0%, rgb(102, 57, 208) ${(customCredits / 500) * 100}%, rgb(75, 85, 99) ${(customCredits / 500) * 100}%, rgb(75, 85, 99) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>1</span>
                  <span>500</span>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-6 gap-2">
                {[10, 25, 50, 100, 200, 350].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setCustomCredits(amount)}
                    className={`py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                      customCredits === amount
                        ? 'bg-accent-primary text-white'
                        : 'bg-bg-secondary text-text-primary hover:bg-bg-tertiary'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* Price Display */}
              <div className="bg-bg-secondary rounded-lg p-4 text-center">
                <div className="text-2xl font-medium text-text-primary mb-1">
                  ${calculatePrice(customCredits)}
                </div>
                <div className="text-sm text-text-secondary mb-2">
                  ${getPricePerCredit(customCredits)} per credit
                </div>
                {getDiscountPercent(customCredits) > 0 && (
                  <div className="inline-flex items-center bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    {getDiscountPercent(customCredits)}% volume discount
                  </div>
                )}
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                disabled={processingPurchase}
                className="w-full bg-purple-700 text-white py-3 rounded-lg font-medium hover:bg-purple-800 transition-colors disabled:opacity-50"
              >
                {processingPurchase 
                  ? 'Processing...' 
                  : `Purchase ${customCredits} Credits - $${calculatePrice(customCredits)}`
                }
              </button>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="text-center">
          <h3 className="text-xl font-medium text-text-primary mb-6">
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

      {/* Custom Slider Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: rgb(102, 57, 208);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: rgb(102, 57, 208);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}
