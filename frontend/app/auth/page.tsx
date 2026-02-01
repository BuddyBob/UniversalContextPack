'use client'

import { useState, useEffect } from 'react'
import { Chrome, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Redirect to /packs if user is already logged in
  useEffect(() => {
    if (user) {
      router.push('/packs')
    }
  }, [user, router])

  // Sync isSignUp state with URL params
  useEffect(() => {
    const mode = searchParams.get('mode')
    setIsSignUp(mode === 'signup')
  }, [searchParams])

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      await signInWithGoogle()
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      if (isSignUp) {
        await signUpWithEmail(email, password)
        // Only show success message if no error was thrown
        setSuccess('Check your email to verify your account!')
        setLoading(false)
      } else {
        await signInWithEmail(email, password)
        // Redirect to /packs after successful sign in
        router.push('/packs')
      }
    } catch (error: any) {
      // Handle specific error for existing user
      const errorMessage = error.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`
      if (errorMessage.includes('already registered') || errorMessage.includes('already exists') || errorMessage.includes('User already registered')) {
        setError('An account with this email already exists. Please sign in instead.')
      } else {
        setError(errorMessage)
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Matrix-style background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
        <MatrixRain />
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 bg-[#0F0F0F] flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-medium text-white mb-8">
            {isSignUp ? 'Create Account' : 'Log in to Your Pack'}
          </h1>

          {success && (
            <div className="border px-4 py-3 rounded-lg mb-6 text-sm bg-green-500/10 border-green-500/30 text-green-400">
              {success}
            </div>
          )}

          {error && (
            <div className="border px-4 py-3 rounded-lg mb-6 text-sm bg-red-500/10 border-red-500/30 text-red-400">
              {error}
            </div>
          )}

          {/* Email Input */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm text-gray-400 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3.5 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#3A3A3C] transition-colors"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          {/* Password Input */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full px-4 py-3.5 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#3A3A3C] transition-colors pr-12"
                disabled={loading}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Remember me checkbox - only on sign in */}
          {!isSignUp && (
            <div className="mb-6 flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#3A3A3C] bg-[#2C2C2E] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="remember" className="ml-2.5 text-sm text-gray-400 cursor-pointer select-none">
                Keep me logged in for up to 30 days
              </label>
            </div>
          )}

          {/* Sign in/up button */}
          <button
            onClick={handleEmailAuth}
            disabled={loading}
            className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#3A3A3C]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0F0F0F] text-gray-500">or</span>
            </div>
          </div>

            {/* If signing in, show Google sign-in button */}


          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mb-8"
          >
            <Chrome className="h-5 w-5" />
            <span>{isSignUp ? 'Sign up with Google' : 'Log in with Google'}</span>
          </button>

          {/* Sign up link */}
          <div className="text-center text-sm">
            <span className="text-gray-500">
              {isSignUp ? 'Already have an account? ' : "Not on Your Pack? "}
            </span>
            <button
              onClick={() => {
                router.push(`/auth?mode=${isSignUp ? 'login' : 'signup'}`)
                setError(null)
                setSuccess(null)
              }}
              className="text-white underline hover:text-gray-300 transition-colors font-medium"
            >
              {isSignUp ? 'Lo in' : 'Create an account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Matrix rain effect component
function MatrixRain() {
  useEffect(() => {
    const canvas = document.getElementById('matrix-canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth / 2
    canvas.height = window.innerHeight

    const barWidth = 2
    const barSpacing = 14
    const columns = Math.floor(canvas.width / barSpacing)
    let phase = 0
    
    function draw() {
      if (!ctx || !canvas) return
      
      // Clear with black background
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#ffffff'

      for (let i = 0; i < columns; i++) {
        const x = i * barSpacing
        
        // Create wave effect using sine wave
        // Each column is offset in the wave based on its position
        const waveOffset = Math.sin(phase + i * 0.3) * 40
        
        // Calculate bar height based on wave
        const barHeight = 50 + waveOffset
        
        // Center the bar vertically with wave motion
        const y = canvas.height / 2 - barHeight / 2 + Math.sin(phase + i * 0.2) * 30
        
        // Draw the vertical bar
        ctx.fillRect(x, y, barWidth, barHeight)
      }
      
      // Increment phase for animation
      phase += 0.05
    }

    const interval = setInterval(draw, 33) // ~30fps

    const handleResize = () => {
      canvas.width = window.innerWidth / 2
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <canvas id="matrix-canvas" className="absolute inset-0" />
}
