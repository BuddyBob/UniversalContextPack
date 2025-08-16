'use client'

import { useEffect, useState } from 'react'

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0)
  const [isVisible, setIsVisible] = useState({
    hero: false,
    demo: false,
    problem: false,
    solution: false,
    steps: false,
    cta: false
  })

  const [demoStep, setDemoStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '-10% 0px -10% 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id
          setIsVisible(prev => ({ ...prev, [sectionId]: true }))
        }
      })
    }, observerOptions)

    // Observe all sections
    const sections = ['hero', 'demo', 'problem', 'solution', 'steps', 'cta']
    sections.forEach(id => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    // Trigger hero immediately
    setTimeout(() => setIsVisible(prev => ({ ...prev, hero: true })), 100)

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-primary overflow-hidden">
      {/* Hero Section */}
      <section id="hero" className="py-20 min-h-[80vh] flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Content */}
            <div className={`transform transition-all duration-1000 ${
              isVisible.hero ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
            }`}>
              <h1 className="text-6xl font-medium text-primary mb-6 leading-tight">
                transfer your{' '}
                <span className="text-accent relative">
                  AI relationship
                  <div className="absolute -bottom-2 left-0 w-full h-1 bg-accent/30 transform scale-x-0 animate-[scaleX_1s_ease-out_0.5s_forwards] origin-left"></div>
                </span>
                <br />
                across models,{' '}
                <span className="text-secondary relative overflow-hidden">
                  instantly
                  <div className="absolute inset-0 bg-primary transform translate-x-0 animate-[slideOut_0.8s_ease-out_1.2s_forwards]"></div>
                </span>
              </h1>
              
              <div className={`transform transition-all duration-1000 delay-300 ${
                isVisible.hero ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
              }`}>
                <p className="text-secondary text-lg mb-8 leading-relaxed">
                  Months of AI conversations, context, and understanding - packaged into one transferable file.
                  <br />
                  <span className="text-muted">Switch between ChatGPT, Claude, and Gemini without losing who you are.</span>
                </p>
              </div>

              <div className={`flex items-center gap-4 transform transition-all duration-1000 delay-500 ${
                isVisible.hero ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
              }`}>
                <a 
                  href="/process" 
                  className="btn-primary-improved group relative overflow-hidden"
                >
                  <span className="relative z-10">Create My Context Pack</span>
                  <div className="absolute inset-0 bg-accent-primary-hover transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </a>
                <a 
                  href="#demo" 
                  className="text-secondary hover:text-accent transition-all duration-300 flex items-center gap-2 group"
                >
                  See How It Works 
                  <span className="transform group-hover:translate-x-1 transition-transform duration-300">→</span>
                </a>
              </div>
            </div>

            {/* Right side - Visual */}
            <div className={`transform transition-all duration-1000 delay-300 ${
              isVisible.hero ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'
            }`}>
              <div className="bg-card border border-primary rounded-lg p-8 relative overflow-hidden">
                <div className="text-xs text-muted mb-4 font-mono">context-pack.txt</div>
                <div className="space-y-2 text-sm font-mono">
                  <div className="text-accent"># Universal Context Pack</div>
                  <div className="text-secondary">## Architecture: Next.js + FastAPI</div>
                  <div className="text-muted">## Goal: Simplify AI context sharing</div>
                  <div className="text-secondary opacity-60">...</div>
                  <div className="text-muted">## Key Components:</div>
                  <div className="text-secondary">- Frontend: React/Next.js</div>
                  <div className="text-secondary">- Backend: FastAPI</div>
                  <div className="text-secondary">- Storage: Supabase</div>
                  <div className="text-muted opacity-60">...</div>
                </div>
                <div className="absolute top-4 right-4 w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="py-20 bg-primary">
        <div className="max-w-7xl mx-auto px-6">
          <div className={`transform transition-all duration-1000 ${
            isVisible.demo ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}>
            <div className="text-center mb-16">
              <h2 className="text-5xl font-medium text-primary mb-6">
                Watch Your <span className="text-accent">ChatGPT History</span> Transform
              </h2>
              <p className="text-secondary text-xl max-w-3xl mx-auto leading-relaxed">
                See how months of ChatGPT conversations become a portable context pack in real-time
              </p>
            </div>

            {/* Interactive Demo Container */}
            <div className="bg-secondary rounded-2xl p-8 border border-primary relative overflow-hidden">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                
                {/* Left: Step-by-step Screenshots */}
                <div className="space-y-6">
                  <div className="relative">
                    {/* Step Navigation */}
                    <div className="flex gap-4 mb-6">
                      {[0, 1, 2].map((step) => (
                        <button
                          key={step}
                          onClick={() => setDemoStep(step)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                            demoStep === step 
                              ? 'bg-accent text-white' 
                              : 'bg-card text-secondary hover:bg-card-hover'
                          }`}
                        >
                          Step {step + 1}
                        </button>
                      ))}
                    </div>

                    {/* Screenshot Display */}
                    <div className="relative bg-card rounded-xl overflow-hidden border border-primary">
                      <div className="absolute top-4 left-4 flex gap-2 z-10">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      
                      <div className="pt-12">
                        {demoStep === 0 && (
                          <div className="relative">
                            <img 
                              src="/first_step.png" 
                              alt="Step 1: Export ChatGPT Data"
                              className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                          </div>
                        )}
                        {demoStep === 1 && (
                          <div className="relative">
                            <img 
                              src="/second_step.png" 
                              alt="Step 2: Download conversations.json"
                              className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                          </div>
                        )}
                        {demoStep === 2 && (
                          <div className="relative">
                            <img 
                              src="/third_step.png" 
                              alt="Step 3: Upload to Context Pack"
                              className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step Descriptions */}
                    <div className="mt-6 p-4 bg-card rounded-lg">
                      {demoStep === 0 && (
                        <div>
                          <h3 className="text-lg font-medium text-primary mb-2">
                            1. Export Your ChatGPT Data
                          </h3>
                          <p className="text-secondary text-sm">
                            Go to ChatGPT Settings → Data Controls → Export Data. 
                            This gives you access to all your conversation history.
                          </p>
                        </div>
                      )}
                      {demoStep === 1 && (
                        <div>
                          <h3 className="text-lg font-medium text-primary mb-2">
                            2. Download Your conversations.json
                          </h3>
                          <p className="text-secondary text-sm">
                            Extract the conversations.json file from your downloaded data. 
                            This contains your entire ChatGPT relationship history.
                          </p>
                        </div>
                      )}
                      {demoStep === 2 && (
                        <div>
                          <h3 className="text-lg font-medium text-primary mb-2">
                            3. Create Your Context Pack
                          </h3>
                          <p className="text-secondary text-sm">
                            Upload the JSON file to our platform and get a compressed, 
                            transferable context pack that works with any AI model.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Live Transformation Preview */}
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-medium text-primary mb-4">
                      Real-Time Transformation
                    </h3>
                    <p className="text-secondary text-sm">
                      See how your ChatGPT data becomes a universal context pack
                    </p>
                  </div>

                  {/* Before/After Comparison */}
                  <div className="space-y-4">
                    {/* Before: Raw ChatGPT Data */}
                    <div className="bg-card border border-primary rounded-lg p-4">
                      <div className="text-xs text-muted mb-2 font-mono">conversations.json (Raw) (File Size: 100 mb +)</div>
                      <div className="text-xs font-mono text-secondary space-y-1 max-h-32 overflow-hidden">
                        <div>{"{"}</div>
                        <div className="ml-2">"conversations": [</div>
                        <div className="ml-4">{"{"}</div>
                        <div className="ml-6">"id": "conv-abc123",</div>
                        <div className="ml-6">"messages": [</div>
                        <div className="ml-8">{"{"}"role": "user", "content": "Help me with React"{"}"}</div>
                        <div className="ml-8">{"{"}"role": "assistant", "content": "Sure! React is..."{"}"}</div>
                        <div className="ml-6">],</div>
                        <div className="ml-6">"create_time": 1692147600</div>
                        <div className="ml-4">{"}"}</div>
                        <div className="text-muted">... 847 more conversations</div>
                      </div>
                    </div>

                    {/* Transformation Arrow */}
                    <div className="text-center py-2">
                      <div className="inline-flex items-center gap-2 text-accent">
                        <div className="w-8 h-0.5 bg-accent"></div>
                        <div className="text-2xl">⚡</div>
                        <div className="w-8 h-0.5 bg-accent"></div>
                      </div>
                    </div>

                    {/* After: Context Pack */}
                    <div className="bg-card border border-accent rounded-lg p-4">
                      <div className="text-xs text-accent mb-2 font-mono">context-pack.txt (Optimized)</div>
                      <div className="text-xs font-mono space-y-1">
                        <div className="text-accent"># Personal AI Context Pack</div>
                        <div className="text-secondary">## Communication Style: Technical, direct</div>
                        <div className="text-muted">## Expertise Areas: React, Next.js, Python</div>
                        <div className="text-secondary">## Recent Projects: Web development, API design</div>
                        <div className="text-muted">## Preferences: Clean code, minimal design</div>
                        <div className="text-secondary">## Problem-solving approach: Systematic, iterative</div>
                        <div className="text-muted">## Context patterns extracted from 847 conversations</div>
                      </div>
                    </div>
                  </div>

                  {/* Try It Button */}
                  <div className="text-center pt-4">
                    <a 
                      href="/process"
                      className="btn-primary-improved inline-flex items-center gap-2 px-6 py-3"
                    >
                      <span>Try With Your ChatGPT Data</span>
                      <div className="w-4 h-4 text-white">→</div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-12 bg-secondary">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className={`transform transition-all duration-1000 ${
            isVisible.problem ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}>
            <h2 className="text-3xl font-medium text-primary mb-4">
              The Problem: <span className="text-accent">AI Memory Loss</span>
            </h2>
            <p className="text-secondary text-lg mb-8 leading-relaxed">
              Switch AI models → Lose months of relationship history → Start explaining yourself from scratch
            </p>
            
            <div className="bg-card border border-primary rounded-lg p-6 max-w-2xl mx-auto">
              <p className="text-primary font-medium mb-2">You to ChatGPT (again):</p>
              <p className="text-muted text-sm italic">
                "I'm a developer working on React projects. I prefer clean code, minimal design. 
                I'm currently building a landing page with animations..."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="py-12 bg-primary">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className={`transform transition-all duration-1000 ${
            isVisible.solution ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}>
            <h2 className="text-3xl font-medium text-primary mb-4">
              The Solution: <span className="text-accent">Universal Context Packs</span>
            </h2>
            <p className="text-secondary text-lg mb-8 leading-relaxed">
              Your AI relationship, compressed into one transferable file
            </p>
            
            <div className="bg-card border border-accent rounded-lg p-6 max-w-2xl mx-auto">
              <div className="text-xs text-accent mb-2 font-mono">my-context-pack.txt</div>
              <div className="text-xs font-mono text-left space-y-1">
                <div className="text-accent"># Personal AI Context Pack</div>
                <div className="text-secondary">## Style: Technical, direct</div>
                <div className="text-muted">## Focus: React, clean code</div>
                <div className="text-secondary">## Current: Landing page project</div>
                <div className="text-muted">## Patterns from 847 conversations</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section id="steps" className="py-12 bg-secondary">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className={`transform transition-all duration-1000 ${
            isVisible.steps ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}>
            <h2 className="text-3xl font-medium text-primary mb-8">
              How It <span className="text-accent">Works</span>
            </h2>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
                <span>Upload conversations</span>
              </div>
              <div className="text-accent text-2xl md:rotate-0 rotate-90">→</div>
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center text-sm font-medium">2</div>
                <span>AI extracts patterns</span>
              </div>
              <div className="text-accent text-2xl md:rotate-0 rotate-90">→</div>
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center text-sm font-medium">3</div>
                <span>Get universal pack</span>
              </div>
            </div>

            <div className="mt-12">
              <a 
                href="/process"
                className="btn-primary-improved inline-flex items-center gap-2 px-8 py-4"
              >
                <span>Create My Context Pack</span>
                <div className="w-4 h-4 text-white">→</div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="py-12 bg-primary">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className={`transform transition-all duration-1000 ${
            isVisible.cta ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}>
            <h2 className="text-3xl font-medium text-primary mb-4">
              Ready to <span className="text-accent">preserve</span> your AI relationships?
            </h2>
            <p className="text-secondary mb-8 leading-relaxed">
              Stop losing months of AI context. Create your personal context pack today.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/process" 
                className="btn-primary-improved group px-6 py-3"
              >
                <span className="relative z-10">Create My Context Pack</span>
              </a>
              <a 
                href="/packs" 
                className="btn-secondary-improved px-6 py-3"
              >
                See Examples
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
