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
          {[...Array(20)].map((_, i) => {
            // Use predetermined positions to avoid hydration mismatch
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

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section - Full viewport with diagonal split */}
        <section className="min-h-screen flex items-center justify-center px-6 relative">
          {/* Diagonal split background */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 transform skew-y-1"></div>
          
          <div className="max-w-6xl mx-auto text-center relative z-10">
            <div className="mb-8">
              <div className="text-sm text-blue-400 font-mono mb-4">~/universal-context-pack</div>
              <h1 className="text-7xl font-light text-white mb-6 leading-tight tracking-tight">
                Your AI
                <br />
                <span className="text-white font-medium">
                  Memory
                </span>
                <br />
                <span className="text-gray-400 text-5xl">Everywhere</span>
              </h1>
            </div>
            
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              Transfer months of conversation history between any AI model in seconds
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <a 
                href="/process" 
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:scale-105"
              >
                Start Transfer
              </a>
              
              <button 
                onClick={() => {
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group border border-gray-600 hover:border-purple-500 px-6 py-3 rounded-lg"
              >
                <span>See it work</span>
                <div className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300">→</div>
              </button>
            </div>
          </div>
        </section>

        {/* How to Download Section */}
        <section id="demo" className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="max-w-5xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-light text-white mb-6">
                How to Download Your <span className="text-white font-medium">ChatGPT Conversations</span>
              </h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                Follow these simple steps to export your conversation history from ChatGPT
              </p>
            </div>

            {/* Step Navigation */}
            <div className="flex justify-center gap-6 mb-12">
              {[
                { step: 0, title: "1. ChatGPT Settings"},
                { step: 1, title: "2. Data Controls -> Export Data"},
                { step: 2, title: "3. Download Data", desc: "Create your context pack" }
              ].map((item) => (
                <button
                  key={item.step}
                  onClick={() => setDemoStep(item.step)}
                  className={`px-6 py-4 rounded-xl text-left transition-all duration-300 border ${
                    demoStep === item.step 
                      ? 'bg-purple-500/20 border-purple-500 text-white' 
                      : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-purple-400 hover:text-gray-300'
                  }`}
                >
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm opacity-75">{item.desc}</div>
                </button>
              ))}
            </div>

            {/* Screenshot Display */}
            <div className="relative max-w-2xl mx-auto">
              <div className="bg-gray-800/30 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-600">
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
                      className="w-full h-auto opacity-90"
                    />
                  )}
                  {demoStep === 1 && (
                    <img 
                      src="/second_step.png" 
                      alt="Download conversations.json"
                      className="w-full h-auto opacity-90"
                    />
                  )}
                  {demoStep === 2 && (
                    <img 
                      src="/third_step.png" 
                      alt="Upload to Context Pack"
                      className="w-full h-auto opacity-90"
                    />
                  )}
                </div>
              </div>
              
              {/* Step Description */}
              <div className="mt-8 text-center">
                {demoStep === 0 && (
                  <p className="text-gray-300 text-lg">
                    Go to ChatGPT Settings → Data Controls → Export Data to request your conversation history
                  </p>
                )}
                {demoStep === 1 && (
                  <p className="text-gray-300 text-lg">
                    Once ready, download and extract the conversations.json file from your data export
                  </p>
                )}
                {demoStep === 2 && (
                  <p className="text-gray-300 text-lg">
                    Upload your conversations.json file to our platform to create your universal context pack
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Problem and Solution Section */}
        <section className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="max-w-6xl mx-auto">
            
            {/* Split layout: Problem | Solution */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              
              {/* Problem Side */}
              <div className="space-y-8">
                <div className="text-red-400 text-sm font-mono mb-4">Error 404: Context Not Found</div>
                <h2 className="text-4xl font-light text-white mb-6 leading-tight">
                  You built a relationship
                  <br />
                  <span className="text-red-400">then had to move</span>
                </h2>
                
                <p className="text-gray-300 text-lg mb-6">
                  You spent months teaching your GPT 4o your preferences, style, and context. 
                  Then GPT 5 rolls out and you want to switch to Gemeni. Except you cant because gemeni doesnt know you at all.
                </p>
                
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
                  <div className="text-lg text-gray-300 mb-4 italic">
                    "I'm a developer working on React projects. I prefer clean code, minimal design. 
                    I'm currently building a landing page with animations. My coding style is..."
                  </div>
                  <div className="text-sm text-red-400">← You, explaining yourself to every new AI model. Again. And again.</div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Time wasted: Hours every switch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Relationship lost: Everything</span>
                  </div>
                </div>
              </div>

              {/* Solution Side */}
              <div className="space-y-8">
                <div className="text-green-400 text-sm font-mono mb-4">Solution</div>
                <h3 className="text-4xl font-light text-white mb-6 leading-tight">
                  One file carries 
                  <br />
                  <span className="text-green-400 font-medium">your entire context</span>
                </h3>

                <p className="text-gray-300 text-lg mb-6">
                  Upload your conversations, get a compressed context pack, 
                  then paste it into any AI model.
                </p>

                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 mb-6">
                  <div className="text-sm text-green-400 mb-3">After you upload your context pack:</div>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      <span>Copy your personalized context pack</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      <span>Paste it into ChatGPT, Claude, or Gemini</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      <span>Start chatting - it knows you instantly</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400 mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Time saved: Hours → 30 seconds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Context preserved: 100%</span>
                  </div>
                </div>

                <a 
                  href="/process"
                  className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:scale-105 group"
                >
                  <span>Create My Context Pack</span>
                  <div className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1">→</div>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Challenge Section */}
        <section className="min-h-screen flex items-center justify-center px-6 relative bg-gray-900/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="text-gray-300 text-sm font-mono mb-4">The Technical Challenge</div>
              <h2 className="text-5xl font-light text-white mb-6 leading-tight">
                The real problem isn't just 
                <br />
                <span className="text-white font-medium">size and mess</span>
              </h2>
              <p className="text-gray-300 text-xl max-w-3xl mx-auto leading-relaxed">
                ChatGPT exports can be massive - thousands of conversations, millions of tokens. 
                The data is messy, unstructured, and would take hours to manually extract and format.
              </p>
            </div>

            {/* Problem Stats */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <div className="text-center p-6 bg-black/50 rounded-xl border border-gray-600">
                <div className="text-3xl font-bold text-white mb-2">100-200MB</div>
                <div className="text-gray-300">Typical export size</div>
                <div className="text-sm text-gray-400 mt-2">Too large to paste anywhere</div>
              </div>
              <div className="text-center p-6 bg-black/50 rounded-xl border border-gray-600">
                <div className="text-3xl font-bold text-white mb-2">1000+</div>
                <div className="text-gray-300">Conversations to parse</div>
                <div className="text-sm text-gray-400 mt-2">Mixed with timestamps, metadata</div>
              </div>
              <div className="text-center p-6 bg-black/50 rounded-xl border border-gray-600">
                <div className="text-3xl font-bold text-white mb-2">20+ Hours</div>
                <div className="text-gray-300">Manual extraction time</div>
                <div className="text-sm text-gray-400 mt-2">If you could even do it</div>
              </div>
            </div>

            {/* Solution Process */}
            <div className="bg-gray-800/30 border border-gray-600 rounded-2xl p-8">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-light text-white mb-4">
                  Our <span className="text-white font-medium">AI-Powered Solution</span>
                </h3>
                <p className="text-gray-300 text-lg">
                  We built advanced algorithms and AI processing to handle the heavy lifting
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">1</div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">Smart Data Extraction</h4>
                      <p className="text-gray-300 text-sm">Our algorithms parse through messy JSON, filter out noise, and extract only meaningful conversation content.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">2</div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">AI Chunking & Analysis</h4>
                      <p className="text-gray-300 text-sm">We break your conversations into optimal chunks and feed them to advanced AI models for pattern recognition.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">3</div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">Comprehensive Profile Generation</h4>
                      <p className="text-gray-300 text-sm">AI creates a detailed report of your communication style, preferences, expertise areas, and behavioral patterns.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/50 rounded-xl p-6 border border-gray-600">
                  <div className="text-xs text-gray-300 mb-3 font-mono">Generated Context Report</div>
                  <div className="text-xs font-mono space-y-2 text-gray-300">
                    <div className="text-white"># Personal AI Context Pack</div>
                    <div>## Communication Style Analysis:</div>
                    <div className="ml-4">- Direct, technical communication</div>
                    <div className="ml-4">- Prefers concise explanations</div>
                    <div className="ml-4">- Values clean, minimal design</div>
                    <div></div>
                    <div>## Expertise Areas Detected:</div>
                    <div className="ml-4">- React/Next.js development</div>
                    <div className="ml-4">- Frontend architecture</div>
                    <div className="ml-4">- UI/UX design principles</div>
                    <div></div>
                    <div>## Current Project Context:</div>
                    <div className="ml-4">- Building landing pages</div>
                    <div className="ml-4">- Animation implementation</div>
                    <div className="ml-4">- User experience optimization</div>
                    <div></div>
                    <div className="text-gray-500">## Patterns extracted from 847 conversations</div>
                  </div>
                </div>
              </div>

              <div className="text-center mt-12">
                <p className="text-gray-300 text-lg mb-6">
                  <strong className="text-white">Result:</strong> A comprehensive, portable context file that any AI can understand instantly
                </p>
                <a 
                  href="/process"
                  className="inline-flex items-center gap-3 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:scale-105"
                >
                  <span>Try Our AI Processing</span>
                  <div className="w-6 h-6">→</div>
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
