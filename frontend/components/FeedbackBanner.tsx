'use client'

import { useState } from 'react'

export default function FeedbackBanner() {
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!feedback.trim()) return

    setIsSubmitting(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: feedback.trim() }),
      })

      if (response.ok) {
        setShowSuccess(true)
        setFeedback('')
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setShowSuccess(false)
        }, 3000)
      } else {
        alert('Failed to submit feedback. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    // Store in localStorage so it stays hidden for this session
    localStorage.setItem('feedbackBannerDismissed', 'true')
  }

  // Check if banner was previously dismissed
  if (typeof window !== 'undefined' && localStorage.getItem('feedbackBannerDismissed') === 'true') {
    return null
  }

  if (!isVisible) return null

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 border-b border-purple-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex-1 w-full sm:w-auto">
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <label htmlFor="feedback" className="text-white text-sm font-medium whitespace-nowrap">
                Taking feature requests and feedback Nov 22-Nov-30!
              </label>
              <input
                id="feedback"
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="(Anonymous) Tell us what you'd like to see..."
                className="flex-1 px-3 py-1.5 text-sm rounded-md bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white transition-colors"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting || !feedback.trim()}
                className="px-4 py-1.5 text-sm font-medium text-purple-600 bg-white rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Submit'}
              </button>
            </form>
          </div>
          
          <div className="flex items-center gap-2">
            {showSuccess && (
              <span className="text-white text-sm font-medium animate-fade-in">
                ✓ Thank you!
              </span>
            )}
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white text-sm font-medium transition-colors"
              aria-label="Dismiss feedback banner"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
