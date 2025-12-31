'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Mail, Download, ArrowRight, Settings, Database, Zap, Clock, Bell, Sparkles } from 'lucide-react'
import { analytics } from '@/lib/analytics'
import Image from 'next/image'
import DemoVideoPopover from './DemoVideoPopover'
import ScrollReveal from './ScrollReveal'
import { useAuth } from './AuthProvider'
import UseCaseTabs from './UseCaseTabs'

const ExportGuide = () => {
  const { user } = useAuth()
  const [scrollY, setScrollY] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    // Track landing page view
    analytics.landingPage()

    const handleScroll = () => setScrollY(window.scrollY)
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const exportSteps = [
    {
      platform: 'ChatGPT',
      url: 'https://chatgpt.com/#settings/DataControls',
      icon: Settings,
    },
    {
      platform: 'Claude',
      url: 'https://claude.ai/settings/data-privacy-controls',
      icon: Database,
    }
  ]

  return (
    <div className="min-h-screen bg-[#080a09] text-white relative overflow-hidden">

      {/* Floating Value Proposition - Always visible on desktop, positioned on left */}

      {/* Stats Display - Bottom Left */}
      <div className="fixed bottom-8 left-8 z-50 hidden md:block">
        <div className="flex flex-row gap-6 items-center">
          {/* Packs Count */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">5.5k+</span>
            <span className="text-sm text-gray-400">packs</span>
          </div>
          {/* Memories Count */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">55k</span>
            <span className="text-sm text-gray-400">memories</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section - 3D Bubble Style */}
        <section className="min-h-screen flex items-center justify-center px-6 py-40 relative overflow-hidden">
          {/* Floating star particles - Visible */}
          <div className="absolute inset-0 pointer-events-none z-50">
            {[...Array(12)].map((_, i) => {
              const positions = [
                { left: 10, top: 20, delay: 0, size: 1 },
                { left: 85, top: 15, delay: 1.2, size: 1 },
                { left: 25, top: 75, delay: 2.4, size: 1 },
                { left: 70, top: 55, delay: 0.8, size: 1 },
                { left: 50, top: 30, delay: 3.6, size: 1 },
                { left: 15, top: 65, delay: 1.8, size: 1 },
                { left: 90, top: 45, delay: 4.2, size: 1 },
                { left: 35, top: 80, delay: 0.6, size: 1 },
                { left: 75, top: 25, delay: 2.8, size: 1 },
                { left: 55, top: 70, delay: 3.2, size: 1 },
                { left: 20, top: 40, delay: 1.5, size: 1 },
                { left: 80, top: 60, delay: 4.0, size: 1 }
              ];
              const pos = positions[i] || { left: 50, top: 50, delay: 0, size: 1 };

              return (
                <div
                  key={i}
                  className="absolute bg-white/40 rounded-full"
                  style={{
                    width: `${pos.size * 2}px`,
                    height: `${pos.size * 2}px`,
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    animation: `float 8s ease-in-out infinite ${pos.delay}s`,
                    boxShadow: '0 0 4px rgba(255, 255, 255, 0.3)'
                  }}
                />
              );
            })}
          </div>

          <div className="max-w-7xl mx-auto w-full relative z-10">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left Column - Text Content */}
              <div className="text-left">
                {/* Main Headline */}
                <h1 className="text-7xl md:text-7xl lg:text-7xl font-bold text-white mb-6 leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  User Owned
                  <br />
                  AI Memory
                </h1>

                {/* Subheadline */}
                <p className="text-xl text-gray-400 max-w-2xl mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  Persistent AI memory that stays with you across <br /> chats, sessions, and AI platforms.
                </p>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center gap-6 mb-10 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-400">Migrate AI Chats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-400">Upload Chat Exports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-400">Long-term Memory</span>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="relative z-30 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <a
                    href="/packs"
                    className="inline-block px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 relative overflow-hidden group"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white'
                    }}
                  >
                    <span className="relative z-10">Start Your Pack</span>
                    {/* Hover glow effect */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.1), transparent)',
                      }}
                    ></div>
                  </a>
                </div>
              </div>

              {/* Right Column - Hero Image */}
              <div className="hidden lg:block relative animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="relative w-full transform scale-125 origin-center">
                  <Image
                    src="/images/hero/main-hero-1536x1024.png"
                    alt="Context Pack interface showing AI chat memory portability across ChatGPT, Claude, and Gemini platforms"
                    width={1600}
                    height={800}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>

        </section>


        {/* Tabbed Use Cases Section */}
        <section className="py-16 md:py-24 px-6 bg-secondary">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
                Built for how you actually work
              </h2>
              <p className="text-lg text-muted">
                Context Pack adapts to your workflow, not the other way around.
              </p>
            </div>

            {/* Tab Navigation */}
            <UseCaseTabs />
          </div>
        </section>


        {/* How It Works - Enterprise Pipeline Diagram */}
        <section className="py-32 px-6 bg-[#080a09] relative">
          <div className="max-w-5xl mx-auto">
            {/* Section Header */}
            <div className="mb-20">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-4 font-mono">Architecture</p>
              <h2 className="text-3xl font-bold text-white mb-2">
                How It Works
              </h2>
              <p className="text-sm text-gray-500">
                Three-step pipeline for portable AI memory
              </p>
            </div>

            {/* Unified Pipeline Diagram */}
            <div className="relative">
              {/* The Main Pipeline Line */}
              <div className="hidden md:block absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              {/* Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
                {/* Step 01 */}
                <div className="relative">
                  {/* Node Dot */}
                  <div className="hidden md:block absolute -top-px left-0 w-4 h-4 rounded-full bg-purple-500/20 border-2 border-purple-500/50" />

                  {/* Content */}
                  <div className="md:pt-12">
                    <p className="text-xs font-mono text-gray-600 mb-3">01</p>
                    <h3 className="text-base font-semibold text-white mb-3">INGEST</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">
                      Connect ChatGPT/Claude exports or upload PDFs
                    </p>

                    {/* Specs */}
                    <div className="space-y-1.5 font-mono text-xs text-gray-600">
                      <div>→ conversations.json</div>
                      <div>→ .pdf</div>
                      <div>→ .txt</div>
                    </div>
                  </div>
                </div>

                {/* Step 02 */}
                <div className="relative">
                  {/* Node Dot */}
                  <div className="hidden md:block absolute -top-px left-0 w-4 h-4 rounded-full bg-purple-500/20 border-2 border-purple-500/50" />

                  {/* Content */}
                  <div className="md:pt-12">
                    <p className="text-xs font-mono text-gray-600 mb-3">02</p>
                    <h3 className="text-base font-semibold text-white mb-3">PROCESS</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">
                      AI analysis extracts facts into structured memory nodes
                    </p>

                    {/* Specs */}
                    <div className="space-y-1.5 font-mono text-xs text-gray-600">
                      <div>→ GPT-4o analysis</div>
                      <div>→ Entity extraction</div>
                      <div>→ Context synthesis</div>
                    </div>
                  </div>
                </div>

                {/* Step 03 */}
                <div className="relative">
                  {/* Node Dot */}
                  <div className="hidden md:block absolute -top-px left-0 w-4 h-4 rounded-full bg-purple-500/20 border-2 border-purple-500/50" />

                  {/* Content */}
                  <div className="md:pt-12">
                    <p className="text-xs font-mono text-gray-600 mb-3">03</p>
                    <h3 className="text-base font-semibold text-white mb-3">DEPLOY</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">
                      Export as portable pack & memory tree to paste into any AI chat
                    </p>

                    {/* Specs */}
                    <div className="space-y-1.5 font-mono text-xs text-gray-600">
                      <div>→ JSON format</div>
                      <div>→ Markdown format</div>
                      <div>→ Cross-platform</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Note */}
              <div className="mt-16 pt-8 border-t border-white/5">
                <p className="text-xs text-gray-600 font-mono">
                  <span className="text-purple-400">Zero lock-in:</span> Your memory pack is a plain-text file. No API calls required.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* Security & Privacy - Data Sheet Format */}
        <section className="py-32 px-6 bg-[#080a09] relative border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            {/* Section Header */}
            <div className="mb-20">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-4 font-mono">Security</p>
              <h2 className="text-3xl font-bold text-white mb-2">
                Security & Privacy
              </h2>
              <p className="text-sm text-gray-500">
                Enterprise-grade data protection
              </p>
            </div>

            {/* Specifications Table */}
            <div className="space-y-0">
              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Encryption</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400"><span className="text-purple-400">AES-256</span> bit at rest, <span className="text-purple-400">TLS 1.3</span> in transit</p>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Data Privacy</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Your data is <span className="text-purple-400">never used</span> to train our models</p>
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Data Ownership</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">You own your data. Export or delete anytime</p>
                </div>
              </div>

              {/* Row 4 */}
              {/* <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Compliance</h3>
                </div>
                <div className="md:col-span-8">
                  <div className="flex flex-wrap gap-3">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-400">
                      SOC 2 Type II
                    </span>
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-400">
                      GDPR
                    </span>
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-400">
                      CCPA
                    </span>
                  </div>
                </div>
              </div> */}

              {/* Row 5 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Documentation</h3>
                </div>
                <div className="md:col-span-8">
                  <a
                    href="/security"
                    className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors group"
                  >
                    <span>Security whitepaper</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Spacing section with subtle blue gradient */}
        <section className="py-12 bg-gradient-to-b from-transparent via-slate-700/10 to-transparent">
          <div className="max-w-4xl mx-auto px-6">
            <div className="h-8"></div>
          </div>
        </section>
      </div>

      {/* Demo Video Popover */}
      <DemoVideoPopover />

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes textShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-text-shimmer {
          background-size: 200% auto;
          animation: textShimmer 3s linear infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(120deg); }
          66% { transform: translateY(5px) rotate(240deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInDown {
          0% {
            opacity: 0;
            transform: translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes floatSubtle {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-float-subtle {
          animation: floatSubtle 6s ease-in-out infinite;
        }
        @keyframes fadeAway {
          0% { opacity: 0.8; transform: translateY(0); }
          50% { opacity: 0.4; transform: translateY(-5px); }
          100% { opacity: 0.1; transform: translateY(-10px); }
        }
        .animate-memory-fade-1 {
          animation: fadeAway 4s ease-in-out infinite alternate;
        }
        .animate-memory-fade-2 {
          animation: fadeAway 4s ease-in-out infinite alternate 1s;
        }
        .animate-memory-fade-3 {
          animation: fadeAway 4s ease-in-out infinite alternate 2s;
        }
      `}</style>
    </div >
  )
}

export default ExportGuide
