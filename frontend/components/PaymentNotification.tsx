'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle, Crown, Info } from 'lucide-react'

interface PaymentNotificationProps {
  show: boolean
  type: 'warning' | 'limit_reached' | 'upgrade_success' | 'info'
  message: string
  chunksUsed?: number
  chunksAllowed?: number
  onClose: () => void
  onUpgrade?: () => void
  autoHide?: boolean
  autoHideDelay?: number
}

export default function PaymentNotification({
  show,
  type,
  message,
  chunksUsed,
  chunksAllowed,
  onClose,
  onUpgrade,
  autoHide = false,
  autoHideDelay = 5000
}: PaymentNotificationProps) {
  const [isVisible, setIsVisible] = useState(show)

  useEffect(() => {
    setIsVisible(show)
    
    if (show && autoHide) {
      const timer = setTimeout(() => {
        handleClose()
      }, autoHideDelay)
      
      return () => clearTimeout(timer)
    }
  }, [show, autoHide, autoHideDelay])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(), 150) // Wait for animation
  }

  const getNotificationStyles = () => {
    switch (type) {
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: 'text-yellow-600',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        }
      case 'limit_reached':
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: 'text-red-600',
          button: 'bg-red-600 hover:bg-red-700'
        }
      case 'upgrade_success':
        return {
          container: 'bg-green-50 border-green-200 text-green-800',
          icon: 'text-green-600',
          button: 'bg-green-600 hover:bg-green-700'
        }
      case 'info':
      default:
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: 'text-blue-600',
          button: 'bg-blue-600 hover:bg-blue-700'
        }
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'warning':
      case 'limit_reached':
        return <AlertTriangle size={20} />
      case 'upgrade_success':
        return <Crown size={20} />
      case 'info':
      default:
        return <Info size={20} />
    }
  }

  const styles = getNotificationStyles()

  if (!show) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className={`
        transform transition-all duration-150 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}>
        <div className={`
          border rounded-lg p-4 shadow-lg backdrop-blur-sm
          ${styles.container}
        `}>
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${styles.icon} mr-3 mt-0.5`}>
              {getIcon()}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-5">
                {message}
              </p>
              
              {/* Usage Progress for warnings */}
              {(type === 'warning' || type === 'limit_reached') && chunksUsed !== undefined && chunksAllowed !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Usage</span>
                    <span>{chunksUsed} / {chunksAllowed} chunks</span>
                  </div>
                  <div className="w-full bg-white bg-opacity-60 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        type === 'limit_reached' ? 'bg-current' : 'bg-current opacity-70'
                      }`}
                      style={{ width: `${Math.min((chunksUsed / chunksAllowed) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="mt-3 flex gap-2">
                {onUpgrade && (type === 'warning' || type === 'limit_reached') && (
                  <button
                    onClick={onUpgrade}
                    className={`
                      text-white text-xs px-3 py-1.5 rounded-md font-medium
                      transition-colors duration-150
                      ${styles.button}
                    `}
                  >
                    Upgrade to Pro - $4.99
                  </button>
                )}
                
                <button
                  onClick={handleClose}
                  className="text-xs px-3 py-1.5 rounded-md font-medium
                           bg-white bg-opacity-20 hover:bg-opacity-30
                           transition-all duration-150"
                >
                  {type === 'upgrade_success' ? 'Thanks!' : 'Dismiss'}
                </button>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 ml-4 text-current opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper hook for managing payment notifications
export function usePaymentNotifications() {
  const [notification, setNotification] = useState<{
    show: boolean
    type: PaymentNotificationProps['type']
    message: string
    chunksUsed?: number
    chunksAllowed?: number
  }>({
    show: false,
    type: 'info',
    message: ''
  })

  const showNotification = (
    type: PaymentNotificationProps['type'],
    message: string,
    options?: {
      chunksUsed?: number
      chunksAllowed?: number
    }
  ) => {
    setNotification({
      show: true,
      type,
      message,
      ...options
    })
  }

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, show: false }))
  }

  const showLimitWarning = (chunksUsed: number, chunksAllowed: number) => {
    const remaining = chunksAllowed - chunksUsed
    if (remaining <= 0) {
      showNotification(
        'limit_reached',
        'Free tier limit reached! Upgrade to Pro plan to continue analyzing chunks.',
        { chunksUsed, chunksAllowed }
      )
    } else if (remaining === 1) {
      showNotification(
        'warning',
        'Only 1 chunk remaining in your free tier. Consider upgrading to Pro plan.',
        { chunksUsed, chunksAllowed }
      )
    }
  }

  const showUpgradeSuccess = () => {
    showNotification(
      'upgrade_success',
      'Welcome to Pro! You now have unlimited chunk analysis.'
    )
  }

  return {
    notification,
    showNotification,
    hideNotification,
    showLimitWarning,
    showUpgradeSuccess
  }
}
