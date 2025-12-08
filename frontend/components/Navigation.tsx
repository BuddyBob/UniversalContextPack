'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import AuthModal from './AuthModal'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Settings, User, LogOut, Sun, Moon, Menu, X, Dot, CreditCard } from 'lucide-react'

export default function Navigation() {
  const { user, userProfile, signOut, loading, session, makeAuthenticatedRequest } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [theme, setTheme] = useState('dark')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Debug: Log userProfile changes
  useEffect(() => {
    if (userProfile) {
      console.log('  - credits_balance:', userProfile.credits_balance)
      console.log('  - payment_plan:', userProfile.payment_plan)
    }
  }, [userProfile])

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme === 'light' ? 'light' : '')
    localStorage.setItem('theme', newTheme)
  }

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : '')
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (loading) {
    return (
      <header className="nav-header">
        <div className="nav-container">
          <div className="nav-content">
            <div className="nav-brand">
              <Image
                src="/Logo2.png"
                alt="UCP Logo"
                width={32}
                height={32}
                className="nav-logo-img"
              />
              <h1 className="nav-title">Universal Context Pack</h1>
            </div>
            <div className="w-20 h-8 bg-card animate-pulse rounded"></div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="nav-header">
        <div className="nav-container">
          <div className="nav-content">
            <Link href="/" className="nav-brand">
              <Image
                src="/Logo2.png"
                alt="UCP Logo"
                width={25}
                height={25}
                className="nav-logo-img"
              />
              <h1 className="nav-title font-medium text-lg tracking-tight">Context Pack</h1>
            </Link>

            {/* Mobile Hamburger - Always visible on mobile */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 rounded-md text-white hover:bg-gray-800 transition-colors ml-auto"
              aria-label="Toggle mobile menu"
            >
              {showMobileMenu ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Desktop Navigation Links */}
            <nav className="nav-links hidden md:flex">
              <Link
                href="/"
                className={`nav-link ${pathname === '/' ? 'active' : ''}`}
              >
                Home
              </Link>
              <Link
                href="/packs"
                className={`nav-link ${pathname === '/packs' ? 'active' : ''}`}
              >
                Packs
              </Link>
              <Link
                href="/pricing"
                className={`nav-link ${pathname === '/pricing' ? 'active' : ''}`}
              >
                Pricing
              </Link>
              <Link
                href="/how-to-port"
                className={`nav-link ${pathname === '/how-to-port' ? 'active' : ''}`}
              >
                Docs
              </Link>
            </nav>

            {/* Desktop Right Side Navigation */}
            <div className="hidden md:flex items-center gap-4">
              {/* Status Indicator */}
              <Link href="/status" className="flex items-center text-sm hover:opacity-80 transition-opacity" title="System Status">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              </Link>

              {/* Desktop User Menu */}
              <div className="nav-user-section flex items-center gap-3">
                {user ? (
                  <>
                    <div className="relative" ref={dropdownRef}>
                      <div
                        className="nav-user-dropdown"
                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                      >
                        {userProfile?.avatar_url && (
                          <img
                            src={userProfile.avatar_url}
                            alt={userProfile.full_name || 'User'}
                            className="nav-user-avatar"
                          />
                        )}
                        <div className="nav-user-info">
                          <p className="nav-user-name">
                            {userProfile?.full_name || user.email?.split('@')[0]}
                          </p>
                          <p className="nav-user-email">{user.email}</p>
                        </div>
                      </div>


                      {showUserDropdown && (
                        <div className="nav-dropdown-menu">
                          <button
                            onClick={signOut}
                            className="nav-dropdown-item"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      )}

                    </div>
                    {user && (
                      <a
                        href="/pricing"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-all ml-auto"
                        title="Buy more credits"
                      >
                        <CreditCard className="w-5 h-5 text-gray-400" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 uppercase tracking-wide">Credits</span>
                          <span className="text-lg font-semibold text-white">
                            {userProfile?.payment_plan === 'unlimited' ? '∞' : (userProfile?.credits_balance || userProfile?.credits_balance)?.toLocaleString() || '0'}
                          </span>
                        </div>
                      </a>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="btn-white"
                  >
                    Get Started
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mt-2 pb-6 border-t border-gray-800/50">
              <nav className="flex flex-col pt-6 px-2 space-y-1">
                <Link
                  href="/"
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    pathname === '/' 
                      ? 'bg-white/10 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Home
                </Link>
                <Link
                  href="/packs"
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    pathname === '/packs' 
                      ? 'bg-white/10 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Packs
                </Link>
                <Link
                  href="/pricing"
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    pathname === '/pricing' 
                      ? 'bg-white/10 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/how-to-port"
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    pathname === '/how-to-port' 
                      ? 'bg-white/10 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Docs
                </Link>

                {/* Mobile User Section */}
                <div className="pt-6 mt-4 border-t border-gray-800/50">
                  {user ? (
                    <div className="space-y-2">
                      {/* User Info Card */}
                      <div className="flex items-center space-x-3 px-4 py-4 rounded-xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
                        {userProfile?.avatar_url ? (
                          <img
                            src={userProfile.avatar_url}
                            alt={userProfile.full_name || 'User'}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base truncate">
                            {userProfile?.full_name || user.email?.split('@')[0]}
                          </p>
                        </div>
                      </div>

                      {/* Credits Display */}
                      <Link
                        href="/pricing"
                        className="flex items-center justify-between px-4 py-4 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition-all backdrop-blur-xl"
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                          </div>
                          <span className="text-base font-medium text-gray-300">Credits</span>
                        </div>
                        <span className="text-2xl font-bold text-white">
                          {userProfile?.payment_plan === 'unlimited' ? '∞' : (userProfile?.credits_balance)?.toLocaleString() || '0'}
                        </span>
                      </Link>
                      
                      <Link
                        href="/profile"
                        className="flex items-center space-x-3 w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all"
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <Settings className="h-5 w-5" />
                        <span>Profile Settings</span>
                      </Link>
                      <button
                        onClick={() => {
                          signOut()
                          setShowMobileMenu(false)
                        }}
                        className="flex items-center space-x-3 w-full text-left px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-medium transition-all"
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowAuthModal(true)
                        setShowMobileMenu(false)
                      }}
                      className="w-full px-6 py-3 bg-white text-black font-semibold hover:bg-gray-100 rounded-xl transition-all shadow-lg"
                    >
                      Get Started
                    </button>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  )
}
