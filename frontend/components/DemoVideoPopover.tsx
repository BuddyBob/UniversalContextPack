'use client'

import { useState, useEffect } from 'react'
import { Play, X, HelpCircle } from 'lucide-react'

export default function DemoVideoPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  // Hide button when scrolling down far
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      const windowHeight = window.innerHeight

      // Hide after scrolling 2 viewport heights
      if (scrollPosition > windowHeight * 2) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* Minimal floating help button */}
      <div
        className={`fixed bottom-8 right-8 z-50 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'
          }`}
      >
        <div className="relative">
          <button
            onClick={handleOpen}
            className="relative group bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-white rounded-full px-5 py-3 transition-all duration-200 flex items-center gap-2.5 z-10 animate-glow border border-transparent"
            aria-label="Watch demo video"
          >
            {/* Icon */}
            <Play className="w-4 h-4" />

            {/* Text Label */}
            <span className="text-sm font-medium">Watch Demo</span>
          </button>
        </div>
      </div>

      {/* Video Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/95 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-5xl animate-scaleIn">
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute -top-12 right-0 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
              aria-label="Close video"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Video Container */}
            <div className="relative bg-[#0a0a0a] rounded-xl overflow-hidden shadow-2xl border border-gray-800/50">
              {/* Video */}
              <div className="relative aspect-video bg-black">
                <video
                  className="w-full h-full"
                  controls
                  muted
                  playsInline
                  preload="auto"
                  controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
                  disablePictureInPicture
                  onVolumeChange={(e) => {
                    // Force mute if user tries to unmute
                    const video = e.currentTarget
                    if (!video.muted) {
                      video.muted = true
                    }
                  }}
                  onError={(e) => {
                    console.error('Video failed to load:', e)
                  }}
                >
                  <source src="/demo-help.mov" type="video/quicktime" />
                  <source src="/demo-help.mov" type="video/mp4" />
                  Your browser does not support the video format. Please use Chrome, Safari, or Edge.
                </video>
              </div>

              {/* Video Info Bar */}
              <div className="relative bg-[#1a1a1a] px-6 py-4 border-t border-gray-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium text-base">How to Use Context Pack</h3>
                    <p className="text-gray-500 text-sm mt-0.5">A quick walkthrough of the platform</p>
                  </div>
                  <HelpCircle className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            </div>

            {/* Keyboard hint */}
            <div className="text-center mt-4 text-gray-600 text-sm">
              Press <kbd className="px-2 py-1 bg-[#1a1a1a] rounded border border-gray-800 text-gray-400">Esc</kbd> to close
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(168, 85, 247, 0.1);
            border-color: rgba(168, 85, 247, 0.1);
          }
          50% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
            border-color: rgba(168, 85, 247, 0.3);
          }
        }

        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }

        kbd {
          font-family: inherit;
          font-size: 0.875rem;
        }
      `}</style>
    </>
  )
}
