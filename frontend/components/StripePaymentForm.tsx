'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { API_ENDPOINTS } from '@/lib/api'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface StripePaymentFormProps {
  credits: number
  amount: number
  session: any // Add session prop
  onSuccess: () => void
  onError: (error: string) => void
}

function PaymentForm({ credits, amount, session, onSuccess, onError }: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const supabase = createClientComponentClient()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    console.log('🚀 Payment form submitted')
    console.log('Credits:', credits, 'Amount:', amount)
    
    if (!stripe || !elements) {
      console.log('❌ Stripe not loaded yet')
      return
    }

    setLoading(true)

    try {
      // Use the passed session
      console.log('📝 Using provided session...')
      if (!session) {
        console.log('❌ No session provided')
        onError('Please log in to continue')
        return
      }

      console.log('✅ Session available, creating payment intent...')
      
      // Create payment intent
      const response = await fetch(API_ENDPOINTS.createPaymentIntent, {
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

      console.log('📡 Backend response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.log('❌ Backend error:', errorText)
        throw new Error(`Backend error: ${response.status}`)
      }

      const { client_secret } = await response.json()
      console.log('✅ Payment intent created, confirming with Stripe...')

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        }
      })

      if (error) {
        console.log('❌ Stripe error:', error)
        onError(error.message || 'Payment failed')
      } else if (paymentIntent?.status === 'succeeded') {
        console.log('✅ Payment succeeded!')
        
        // Manually add credits since webhook might not be working
        try {
          console.log('🔄 Manually adding credits...')
          const addCreditsResponse = await fetch(API_ENDPOINTS.addCreditsManual, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              credits: credits,
              amount: amount,
              paymentIntentId: paymentIntent.id
            })
          })
          
          if (addCreditsResponse.ok) {
            console.log('✅ Credits added manually!')
          } else {
            console.log('⚠️ Manual credit addition failed, but payment succeeded')
          }
        } catch (error) {
          console.log('⚠️ Error adding credits manually:', error)
        }
        
        onSuccess()
      }
    } catch (error) {
      console.log('❌ Payment error:', error)
      onError(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-600">
        <h3 className="text-lg font-medium text-white mb-4">Payment Details</h3>
        <div className="bg-gray-900 p-4 rounded border border-gray-600">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#ffffff',
                  '::placeholder': {
                    color: '#9CA3AF',
                  },
                },
                invalid: {
                  color: '#EF4444',
                },
              },
            }}
          />
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded border border-gray-600">
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span>{credits} Credits</span>
          <span>${amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-medium text-white">
          <span>Total</span>
          <span>${amount.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-300"
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Processing...
          </div>
        ) : (
          `Pay $${amount.toFixed(2)}`
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Testing Environment: Use card 4242 4242 4242 4242 with any future date and CVC
      </p>
    </form>
  )
}

export default function StripePaymentForm(props: StripePaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  )
}
