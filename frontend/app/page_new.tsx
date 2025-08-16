'use client'

import { useEffect, useState } from 'react'

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [demoStep, setDemoStep] = useState(0)

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-blue-500/10 to-transparent rounded-full blur-3xl"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
            transition: 'all 0.3s ease-out'
          }}
        />
        <div 
          className="absolute w-64 h-64 bg-gradient-to-l from-purple-500/10 to-transparent rounded-full blur-2xl"
          style={{
            left: mousePosition.x - 128,
            top: mousePosition.y + 100,
            transition: 'all 0.5s ease-out'
          }}
        />
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animation: 'float 6s ease-in-out infinite'
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section - Full viewport with diagonal split */}
        <section className="min-h-screen flex items-center justify-center px-6 relative">
          {/* Diagonal split background */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 transform skew-y-1"></div>
          
          <div className="max-w-6xl mx-auto text-center relative z-10">
            <div 
              className="transform transition-all duration-1000"
              style={{ transform: `translateY(${scrollY * 0.3}px)` }}
            >
              <div className="mb-8">
                <div className="text-sm text-blue-400 font-mono mb-4">~/universal-context-pack</div>
                <h1 className="text-7xl font-light text-white mb-6 leading-tight tracking-tight">
                  Your AI
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent font-medium">
                    remembers
                  </span>
                  <br />
                  <span className="text-gray-400 text-5xl">everywhere</span>
                </h1>
              </div>
              
              <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                Transfer months of conversation history between any AI model in seconds
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <a 
                  href="/process" 
                  className="group relative bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-lg text-lg font-medium overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105"
                >
                  <span className="relative z-10">Start Transfer</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </a>
                
                <button 
                  onClick={() => {
                    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group border border-gray-600 hover:border-blue-500 px-6 py-3 rounded-lg"
                >
                  <span>See it work</span>
                  <div className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300">→</div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Demo - Floating cards with physics */}
        <section id="demo" className="min-h-screen flex items-center justify-center px-6 relative">
          <div 
            className="absolute inset-0 opacity-30"
            style={{ 
              background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.1) 0%, transparent 50%)` 
            }}
          />
          
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-light text-white mb-4">
                Watch the <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent font-medium">transformation</span>
              </h2>
            </div>

            {/* Physics-based floating cards */}
            <div className="grid lg:grid-cols-3 gap-8 items-center mb-16">
              
              {/* Before Card */}
              <div 
                className="relative group cursor-pointer"
                style={{ transform: `translateY(${Math.sin(scrollY * 0.01) * 15}px) rotateX(${Math.sin(scrollY * 0.005) * 5}deg)` }}
                onClick={() => setDemoStep(0)}
              >
                <div className={`bg-gray-800/50 backdrop-blur-sm border rounded-2xl p-8 transition-all duration-500 ${
                  demoStep === 0 ? 'border-blue-500 shadow-2xl shadow-blue-500/20 scale-105' : 'border-gray-600 hover:border-gray-500'
                }`}>
                  <div className="text-sm text-gray-400 mb-4 font-mono">conversations.json</div>
                  <div className="text-xs font-mono text-gray-300 space-y-1 opacity-60">
                    <div>{"{"}"conversations": [847 items],</div>
                    <div>"messages": [12,439 items],</div>
                    <div>"metadata": {"{"+"..."+"}"}</div>
                    <div>"timestamps": [...]{"}"}</div>
                  </div>
                  <div className="mt-6 text-center">
                    <div className="text-2xl text-red-400">⚠️</div>
                    <div className="text-sm text-gray-400 mt-2">Raw, overwhelming data</div>
                  </div>
                </div>
              </div>

              {/* Transformation Animation */}
              <div className="text-center">
                <div 
                  className="inline-block transition-transform duration-1000"
                  style={{ transform: `rotate(${scrollY * 0.2}deg) scale(${1 + Math.sin(Date.now() * 0.001) * 0.1})` }}
                >
                  <div className="text-6xl bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">⚡</div>
                  <div className="text-sm text-gray-300 mt-2">AI Magic</div>
                </div>
              </div>

              {/* After Card */}
              <div 
                className="relative group cursor-pointer"
                style={{ transform: `translateY(${Math.sin(scrollY * 0.01 + Math.PI) * 15}px) rotateX(${Math.sin(scrollY * 0.005 + Math.PI) * 5}deg)` }}
                onClick={() => setDemoStep(1)}
              >
                <div className={`bg-gray-800/50 backdrop-blur-sm border rounded-2xl p-8 transition-all duration-500 ${
                  demoStep === 1 ? 'border-green-500 shadow-2xl shadow-green-500/20 scale-105' : 'border-gray-600 hover:border-gray-500'
                }`}>
                  <div className="text-sm text-green-400 mb-4 font-mono">context-pack.txt</div>
                  <div className="text-xs font-mono space-y-1">
                    <div className="text-green-400"># Your AI DNA</div>
                    <div className="text-gray-300">Style: Direct, technical</div>
                    <div className="text-gray-400">Focus: React, clean UX</div>
                    <div className="text-gray-300">Current: Landing optimization</div>
                  </div>
                  <div className="mt-6 text-center">
                    <div className="text-2xl text-green-400">🎯</div>
                    <div className="text-sm text-green-400 mt-2">Pure context gold</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Screenshots with 3D effect */}
            <div className="mt-16">
              <div className="flex justify-center gap-4 mb-8">
                {[0, 1, 2].map((step) => (
                  <button
                    key={step}
                    onClick={() => setDemoStep(step)}
                    className={`w-4 h-4 rounded-full transition-all duration-500 ${
                      demoStep === step 
                        ? 'bg-blue-500 scale-125 shadow-lg shadow-blue-500/50' 
                        : 'bg-gray-600 hover:bg-blue-400/50'
                    }`}
                  />
                ))}
              </div>

              <div className="relative max-w-4xl mx-auto perspective-1000">
                <div 
                  className="bg-gray-800/30 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-600 transform transition-transform duration-700 hover:rotateX-2 hover:rotateY-2"
                  style={{ 
                    transform: `rotateX(${Math.sin(scrollY * 0.002) * 2}deg) rotateY(${Math.cos(scrollY * 0.002) * 2}deg)`,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <div className="flex gap-2 p-4 border-b border-gray-700">
                    <div className="w-3 h-3 bg-red-500/60 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500/60 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500/60 rounded-full"></div>
                  </div>
                  
                  <div className="relative">
                    {demoStep === 0 && (
                      <img 
                        src="/first_step.png" 
                        alt="Export ChatGPT Data"
                        className="w-full h-auto opacity-90 transition-opacity duration-500"
                      />
                    )}
                    {demoStep === 1 && (
                      <img 
                        src="/second_step.png" 
                        alt="Download conversations.json"
                        className="w-full h-auto opacity-90 transition-opacity duration-500"
                      />
                    )}
                    {demoStep === 2 && (
                      <img 
                        src="/third_step.png" 
                        alt="Upload to Context Pack"
                        className="w-full h-auto opacity-90 transition-opacity duration-500"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Single flowing section with the problem/solution */}
        <section className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="max-w-6xl mx-auto">
            
            {/* Split layout: Problem | Solution */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              
              {/* Problem Side */}
              <div 
                className="transform transition-all duration-1000 space-y-8"
                style={{ 
                  opacity: Math.max(0, Math.min(1, (scrollY - 1200) / 400)),
                  transform: `translateX(${Math.max(-50, Math.min(0, (scrollY - 1200) / 10))}px)` 
                }}
              >
                <div className="text-red-400 text-sm font-mono mb-4">Error 404: Context Not Found</div>
                <h2 className="text-4xl font-light text-white mb-6 leading-tight">
                  Switch AI models
                  <br />
                  <span className="text-red-400">lose everything</span>
                </h2>
                
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
                  <div className="text-lg text-gray-300 mb-4 italic">
                    "I'm a developer working on React projects. I prefer clean code, minimal design. I'm currently building a landing page with animations..."
                  </div>
                  <div className="text-sm text-red-400">← You, explaining yourself again... and again... and again.</div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Time wasted: 100+ hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Context lost: Everything</span>
                  </div>
                </div>
              </div>

              {/* Solution Side */}
              <div 
                className="transform transition-all duration-1000 space-y-8"
                style={{ 
                  opacity: Math.max(0, Math.min(1, (scrollY - 1400) / 400)),
                  transform: `translateX(${Math.min(50, Math.max(0, 50 - (scrollY - 1400) / 10))}px)` 
                }}
              >
                <div className="text-green-400 text-sm font-mono mb-4">Solution Found</div>
                <h3 className="text-4xl font-light text-white mb-6 leading-tight">
                  One file. 
                  <br />
                  <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent font-medium">Universal memory.</span>
                </h3>

                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
                  <div className="text-xs text-green-400 mb-2 font-mono">my-context-pack.txt</div>
                  <div className="text-xs font-mono text-left space-y-1">
                    <div className="text-green-400"># Personal AI Context Pack</div>
                    <div className="text-gray-300">## Style: Technical, direct</div>
                    <div className="text-gray-400">## Focus: React, clean code</div>
                    <div className="text-gray-300">## Current: Landing page project</div>
                    <div className="text-gray-400">## Patterns from 847 conversations</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Time saved: Hours → Seconds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Context preserved: 100%</span>
                  </div>
                </div>

                <a 
                  href="/process"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-green-500 to-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:scale-105 group"
                >
                  <span>Create My Memory File</span>
                  <div className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1">→</div>
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        .perspective-1000 {
          perspective: 1000px;
        }
        
        .hover\\:rotateX-2:hover {
          transform: rotateX(2deg);
        }
        
        .hover\\:rotateY-2:hover {
          transform: rotateY(2deg);
        }
      `}</style>
    </div>
  )
}
