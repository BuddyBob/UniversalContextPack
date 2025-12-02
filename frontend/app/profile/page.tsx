'use client'

import { useState } from 'react'
import AuthWrapper from '@/components/AuthWrapper'
import UserProfileComponent from '@/components/UserProfileComponent'
import PaymentNotification, { usePaymentNotifications } from '@/components/PaymentNotification'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const { notification, hideNotification, showUpgradeSuccess } = usePaymentNotifications()

  const handleUpgrade = () => {
    // This will be replaced with Stripe integration
    alert('Stripe integration coming soon! You will be redirected to secure payment.')
    // For demo purposes, show success notification
    setTimeout(() => {
      showUpgradeSuccess()
    }, 1000)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Payment Notification */}
        <PaymentNotification
          show={notification.show}
          type={notification.type}
          message={notification.message}
          chunksUsed={notification.chunksUsed}
          chunksAllowed={notification.chunksAllowed}
          onClose={hideNotification}
          onUpgrade={handleUpgrade}
          autoHide={notification.type === 'upgrade_success'}
        />

        <div className="max-w-5xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-gray-800 mb-3">Profile Settings</h1>
            <p className="text-gray-500 text-lg">Manage your account and billing</p>
          </div>

          {/* Profile Content */}
          <div className="space-y-6">
            {/* User Profile Component */}
            <UserProfileComponent 
              onUpgrade={handleUpgrade}
            />
            
            {/* Sign Out Section */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Account Actions</span>
              </h2>
              <button
                onClick={signOut}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-xl font-medium transition-all hover:shadow-lg"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthWrapper>
  )
}
