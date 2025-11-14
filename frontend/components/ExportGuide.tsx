'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Mail, Download, ArrowRight, Settings, Database, Zap, Clock, Bell } from 'lucide-react'
import { analytics } from '@/lib/analytics'
import Image from 'next/image'

const ExportGuide = () => {
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
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Subtle purple hint in background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/[0.02] rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-500/[0.015] rounded-full blur-3xl"></div>
      </div>
      
      {/* Dynamic Background - Subtle purple hint */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-purple-600/[0.03] to-transparent rounded-full blur-3xl"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
            transition: 'all 0.3s ease-out'
          }}
        />
        <div 
          className="absolute w-64 h-64 bg-gradient-to-l from-purple-500/[0.02] to-transparent rounded-full blur-2xl"
          style={{
            left: mousePosition.x - 128,
            top: mousePosition.y + 100,
            transition: 'all 0.5s ease-out'
          }}
        />
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => {
            const positions = [
              { left: 10, top: 20, delay: 0 },
              { left: 85, top: 15, delay: 1.2 },
              { left: 25, top: 80, delay: 2.4 },
              { left: 70, top: 60, delay: 0.8 },
              { left: 50, top: 30, delay: 3.6 },
              { left: 15, top: 70, delay: 1.8 },
              { left: 90, top: 45, delay: 4.2 },
              { left: 35, top: 85, delay: 0.6 },
              { left: 75, top: 25, delay: 2.8 },
              { left: 55, top: 75, delay: 3.2 },
              { left: 20, top: 40, delay: 1.5 },
              { left: 80, top: 70, delay: 4.0 },
              { left: 45, top: 10, delay: 2.2 },
              { left: 65, top: 55, delay: 0.4 },
              { left: 30, top: 65, delay: 3.8 },
              { left: 85, top: 35, delay: 1.0 },
              { left: 40, top: 90, delay: 2.6 },
              { left: 75, top: 20, delay: 4.4 },
              { left: 60, top: 50, delay: 1.4 },
              { left: 25, top: 35, delay: 3.0 }
            ];
            const pos = positions[i] || { left: 50, top: 50, delay: 0 };
            
            return (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/20 rounded-full"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  animation: `float 6s ease-in-out infinite ${pos.delay}s`
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Floating Value Proposition - Always visible on desktop, positioned on left */}
    

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section - Mem0 Style */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20 relative">
          <div className="max-w-7xl mx-auto w-full relative z-10">
            {/* Header */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 mb-6">
                <span className="text-sm text-gray-400">Backed by</span>
                <span className="text-sm font-semibold text-white">YC</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                AI Chats Forget.<br />
                Context Pack Remembers.
              </h1>
              
              <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                Your AI memory, portable across any platform
              </p>
              
              <a 
                href="/process"
                className="inline-block bg-white hover:bg-gray-100 text-black px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-xl"
              >
                Get Started
              </a>
            </div>

            {/* Interactive Demo - Multiple Chats → One Memory Chip */}
            <div className="flex items-center gap-8 lg:gap-16 max-w-6xl mx-auto flex-col lg:flex-row">
              {/* Left Side - Multiple Chat Conversations */}
              <div className="flex-1 space-y-3 w-full">
                {/* Chat 1 */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500 font-medium">ChatGPT Conversation</span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400 bg-black/30 rounded px-3 py-2">
                      "I prefer aisle seats when flying..."
                    </div>
                    <div className="text-sm text-gray-400 bg-black/30 rounded px-3 py-2">
                      "My favorite color is blue..."
                    </div>
                  </div>
                </div>

                {/* Chat 2 */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500 font-medium">Claude Conversation</span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400 bg-black/30 rounded px-3 py-2">
                      "I work in software engineering..."
                    </div>
                    <div className="text-sm text-gray-400 bg-black/30 rounded px-3 py-2">
                      "I'm allergic to peanuts..."
                    </div>
                  </div>
                </div>

                {/* Chat 3 */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500 font-medium">Gemini Conversation</span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400 bg-black/30 rounded px-3 py-2">
                      "I live in San Francisco..."
                    </div>
                    <div className="text-sm text-gray-400 bg-black/30 rounded px-3 py-2">
                      "My goal is to learn Spanish..."
                    </div>
                  </div>
                </div>
              </div>

              {/* Center - Processing Arrow */}
              <div className="flex lg:flex-col items-center gap-4">
                <ArrowRight className="w-8 h-8 lg:rotate-0 rotate-90 text-gray-600" />
              </div>

              {/* Right Side - Single Unified Memory Chip */}
              <div className="flex-1 w-full">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Database className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-white">Memory Chip</h3>
                    <div className="ml-auto px-2 py-1 bg-indigo-600/20 border border-indigo-600/30 rounded text-xs text-indigo-400 font-medium">
                      Universal
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex items-start gap-3">
                      <span className="text-indigo-500">•</span>
                      <span>Travel: Prefers aisle seats, window for long flights</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-indigo-500">•</span>
                      <span>Style: Favorite color blue</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-indigo-500">•</span>
                      <span>Work: Software engineer</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-indigo-500">•</span>
                      <span>Health: Peanut allergy</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-indigo-500">•</span>
                      <span>Location: San Francisco</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-indigo-500">•</span>
                      <span>Goals: Learning Spanish</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Ready to upload to any AI</span>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-gray-400">Complete</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compatibility badges */}
                <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-500">
                  <span>Works with:</span>
                  <span className="text-gray-400">ChatGPT</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">Claude</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">Gemini</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle background elements - Very subtle purple */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-purple-600/[0.04] rounded-full blur-3xl"></div>
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-500/[0.02] rounded-full blur-3xl"></div>

        </section>

        

        {/* Export Guide Section */}
        <section id="export" className="py-20 px-6 relative">
          {/* Smooth gradient transition - muted black */}
          <div className="absolute inset-0 bg-[#0a0a0a]" />
          
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">
                Download Your ChatGPT History
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Keep your important conversations safe. Get your ChatGPT and Claude chat history in just a few clicks.
              </p>
            </div>

            {/* Clean Export Interface */}
            <div className="max-w-3xl mx-auto mb-16">
              <div className="rounded-xl p-8 bg-gradient-to-br from-slate-800/70 via-slate-900/60 to-slate-900/80 backdrop-blur-xl border border-slate-600/50 shadow-[0_20px_50px_rgba(15,_23,_42,_0.3)] hover:shadow-[0_20px_50px_rgba(15,_23,_42,_0.4)] transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-6">Download Your Chats</h3>
                
                <div className="space-y-3">
                  {exportSteps.map((step) => (
                    <a 
                      key={step.platform}
                      href={step.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-700/60 hover:from-slate-700/90 hover:to-slate-600/70 backdrop-blur-sm border border-slate-600/60 hover:border-slate-500/80 shadow-lg hover:shadow-xl transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <step.icon className="h-5 w-5 text-slate-300 group-hover:text-white transition-colors" />
                        <span className="text-white font-medium">{step.platform}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-sm text-slate-200 group-hover:text-white transition-colors">Download My Chats</span>

                        <ExternalLink className="h-4 w-4" />
                      </div>
                    </a>
                  ))}
                </div>
                
                <p className="text-gray-500 text-sm mt-4">
                  Files sent to your email in 5-10 minutes
                </p>
              </div>
            </div>

            {/* Simple Process Steps */}
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-slate-800/70 via-slate-900/60 to-slate-900/80 backdrop-blur-xl border border-slate-600/50 shadow-[0_15px_35px_rgba(15,_23,_42,_0.2)] hover:shadow-[0_20px_45px_rgba(15,_23,_42,_0.3)] transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700/80 to-slate-800/90 border border-slate-600/60 mx-auto mb-4 flex items-center justify-center shadow-lg">
                  <span className="text-white font-semibold">1</span>
                </div>
                <h3 className="text-white font-medium mb-2">Download</h3>
                <p className="text-gray-400 text-sm">Get your ChatGPT files</p>
              </div>

              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-slate-800/70 via-slate-900/60 to-slate-900/80 backdrop-blur-xl border border-slate-600/50 shadow-[0_15px_35px_rgba(15,_23,_42,_0.2)] hover:shadow-[0_20px_45px_rgba(15,_23,_42,_0.3)] transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-indigo-600 border border-indigo-500/60 mx-auto mb-4 flex items-center justify-center shadow-lg">
                  <span className="text-white font-semibold">2</span>
                </div>
                <h3 className="text-white font-medium mb-2">Backup</h3>
                <p className="text-gray-400 text-sm mb-4">Keep your chats safe forever</p>
                <a 
                  href="/process"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Start Backup
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-slate-800/70 via-slate-900/60 to-slate-900/80 backdrop-blur-xl border border-slate-600/50 shadow-[0_15px_35px_rgba(15,_23,_42,_0.2)] hover:shadow-[0_20px_45px_rgba(15,_23,_42,_0.3)] transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700/80 to-slate-800/90 border border-slate-600/60 mx-auto mb-4 flex items-center justify-center shadow-lg">
                  <span className="text-white font-semibold">3</span>
                </div>
                <h3 className="text-white font-medium mb-2">Move to Any AI</h3>
                <p className="text-gray-400 text-sm mb-4">Use with Claude, Gemini, etc.</p>
                <a 
                  href="/how-to-port"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
text-white border border-slate-700/60 hover:border-slate-500/80
bg-transparent hover:bg-slate-800/60 ring-1 ring-slate-500/10"
                >
                  How to Use
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="py-16 px-6 relative">
          {/* Smooth transition background - muted black */}
          <div className="absolute inset-0 bg-[#0a0a0a]" />
          
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl rounded-2xl p-8 border border-white/30 ">
              <div className="text-center mb-8">
                <div className="w-16 h-16  backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Data Security & Privacy</h2>
                <p className="text-gray-300 text-lg">Your conversations are processed securely through encrypted infrastructure</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Encrypted Storage</h3>
                  <p className="text-gray-400 text-sm">Files are encrypted during processing and securely stored using industry-standard protocols.</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Secure Processing</h3>
                  <p className="text-gray-400 text-sm">All data processing happens through encrypted channels with automatic cleanup protocols.</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Confidential Processing</h3>
                  <p className="text-gray-400 text-sm">Your conversations remain confidential - we don't read, analyze, or use your data for any other purpose.</p>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                <p className="text-gray-300 text-sm text-center">
                  <strong>Security Standards:</strong> We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. 
                  Your files are processed in isolated environments and automatically purged after Context Pack generation.
                </p>
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

      {/* Custom Styles */}
      <style jsx>{`
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
      `}</style>
    </div>
  )
}

export default ExportGuide
