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
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Subtle vignette for depth + color accents */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/3 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-500/3 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-indigo-500/5 to-transparent rounded-full blur-3xl"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
            transition: 'all 0.3s ease-out'
          }}
        />
        <div 
          className="absolute w-64 h-64 bg-gradient-to-l from-fuchsia-500/5 to-transparent rounded-full blur-2xl"
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
      <div className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2 z-20">
        <div className="bg-gradient-to-br from-slate-800/90 via-slate-900/80 to-slate-900/90 backdrop-blur-xl border border-slate-600/50 rounded-2xl p-6 shadow-2xl max-w-xs">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#6639D0]/20 border border-[#6639D0]/30 flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-[#6639D0]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm mb-1">Why Context Pack?</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                Your AI memory, portable across any platform
              </p>
            </div>
          </div>
          
          <div className="space-y-3 border-t border-slate-700/50 pt-4">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6639D0] mt-1.5 flex-shrink-0"></div>
              <p className="text-gray-300 text-xs">Never lose important conversations</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6639D0] mt-1.5 flex-shrink-0"></div>
              <p className="text-gray-300 text-xs">Switch AI platforms without starting over</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6639D0] mt-1.5 flex-shrink-0"></div>
              <p className="text-gray-300 text-xs">One file that works everywhere</p>
            </div>
          </div>
          
          {/* Add the email feature here too */}
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-[#6639D0] mt-0.5 flex-shrink-0" />
              <p className="text-gray-300 text-xs">Large files? We email when ready</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="max-w-6xl mx-auto text-center relative z-10">
            <div className="mb-12">
              <h2 className="text-4xl md:text-5xl lg:text-7xl text-white/70 font-light mb-8">
                One Profile.
              </h2>
              <h1 className="text-6xl md:text-8xl lg:text-9xl text-white leading-tight font-light mb-12">
                Your AI.
              </h1>
              
              {/* Mobile Value Prop - Only visible on mobile/tablet */}
              <div className="lg:hidden max-w-md mx-auto mb-8">
                <div className="bg-gradient-to-br from-slate-800/70 via-slate-900/60 to-slate-900/80 backdrop-blur-xl border border-slate-600/50 rounded-xl p-5 shadow-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-[#6639D0]" />
                    <h3 className="text-white font-semibold text-sm">What's in it for you?</h3>
                  </div>
                  <div className="space-y-2 text-left">
                    <p className="text-gray-300 text-xs flex items-start gap-2">
                      <span className="text-[#6639D0] mt-0.5">✓</span>
                      <span>Never lose important AI conversations</span>
                    </p>
                    <p className="text-gray-300 text-xs flex items-start gap-2">
                      <span className="text-[#6639D0] mt-0.5">✓</span>
                      <span>Switch AI platforms without starting over</span>
                    </p>
                    <p className="text-gray-300 text-xs flex items-start gap-2">
                      <span className="text-[#6639D0] mt-0.5">✓</span>
                      <span>One portable file that works everywhere</span>
                    </p>
                    <p className="text-gray-300 text-xs flex items-start gap-2">
                      <span className="text-[#6639D0] mt-0.5">✓</span>
                      <span>Large files? We email when ready</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <a 
                href="/process"
                className="bg-[#6639D0] hover:bg-[#5428B8] text-white px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
              >
                Create Context Pack
              </a>
            </div>
          </div>

          {/* Subtle background elements */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-[#6639D0]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-[#6639D0]/5 rounded-full blur-2xl"></div>

        </section>

        

        {/* Export Guide Section */}
        <section id="export" className="py-20 px-6 relative">
          {/* Smooth gradient transition from purple to dark */}
          <div className="absolute inset-0 bg-slate-950" />
          
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
          {/* Smooth transition background */}
          <div className="absolute inset-0 bg-slate-950" />
          
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
      `}</style>
    </div>
  )
}

export default ExportGuide
