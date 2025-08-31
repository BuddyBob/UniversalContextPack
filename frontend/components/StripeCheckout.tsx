'use client'

import { useState } from 'react'
import { API_ENDPOINTS } from '@/lib/api'

interface StripeCheckoutProps {
  credits: number
  amount: number
  session: any
  onSuccess: () => void
  onError: (error: string) => void
}

export default function StripeCheckout({ 
  credits, 
  amount, 
  session, 
  onSuccess, 
  onError 
}: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    if (!session) {
      onError('Please log in to continue')
      return
    }

    setLoading(true)

    try {
      // Create checkout session
      const response = await fetch(API_ENDPOINTS.createCheckoutSession, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          credits,
          amount
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to create checkout session')
      }

      const data = await response.json()
      
      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url

    } catch (error: any) {
      console.error('Checkout error:', error)
      onError(error.message || 'Failed to create checkout session')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Secure Payment</h3>
        <p className="text-gray-300 text-sm mb-4">
          You'll be redirected to Stripe's secure payment page to complete your purchase.
        </p>
        
        {/* Order Summary */}
        <div className="border-t border-gray-700 pt-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">{credits} Credits</span>
            <span className="text-white">${amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-white border-t border-gray-700 pt-2">
            <span>Total</span>
            <span>${amount.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
        >
          {loading ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <>
              <span>Continue to Secure Payment</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </>
          )}
        </button>

        {/* Trust indicators */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400 mb-2">Secured by Stripe</p>
          <div className="flex justify-center space-x-4">
            <span className="text-xs text-gray-500">🔒 SSL Encrypted</span>
            <span className="text-xs text-gray-500">💳 PCI Compliant</span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-gray-400 text-center">
        Testing Environment: Use card 4242 4242 4242 4242 with any future date and CVC
      </div>
    </div>
  )
}
