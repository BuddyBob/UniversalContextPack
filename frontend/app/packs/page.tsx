'use client'

import { useState, useEffect } from 'react'
import { Download, FileText, Brain, BarChart3, Calendar, DollarSign, ExternalLink } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

const BACKEND_URL = 'http://localhost:8000'

interface UCPPack {
  ucpId?: string
  id?: string
  status: string
  totalChunks: number
  totalInputTokens?: number
  totalOutputTokens?: number
  totalCost?: number
  completedAt: string
  savedAt: string
}

export default function PacksPage() {
  const { user, session, makeAuthenticatedRequest } = useAuth()
  const [packs, setPacks] = useState<UCPPack[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<UCPPack | null>(null)

  useEffect(() => {
    if (user && session) {
      loadPacks()
    } else {
      // If user is not authenticated, stop loading immediately
      setLoading(false)
      setPacks([])
    }
  }, [user, session])

  const loadPacks = async () => {
    if (!user) {
      setPacks([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/packs`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch packs: ${response.status} ${response.statusText}`)
      }
      
      const jobs = await response.json()
      
      // Validate that the response is an array
      if (!Array.isArray(jobs)) {
        console.warn('Server returned non-array response:', jobs)
        throw new Error('Invalid response format from server')
      }
      
      // Transform the packs data to match the UCPPack interface
      const transformedPacks: UCPPack[] = jobs.map((pack: any) => ({
        ucpId: pack.job_id,
        id: pack.job_id,
        status: pack.status,
        totalChunks: pack.stats?.total_chunks || 0,
        totalInputTokens: pack.stats?.total_input_tokens || 0,
        totalOutputTokens: pack.stats?.total_output_tokens || 0,
        totalCost: pack.stats?.total_cost || 0,
        completedAt: pack.created_at,
        savedAt: pack.created_at
      }))
      
      // Sort by completedAt date, most recent first
      transformedPacks.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      
      setPacks(transformedPacks)
    } catch (e) {
      console.error('Failed to load packs from server:', e)
      // Fallback to /api/jobs endpoint
      try {
        const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/jobs`)
        
        if (response.ok) {
          const jobs = await response.json()
          
          if (Array.isArray(jobs)) {
            const transformedPacks: UCPPack[] = jobs.map((job: any) => ({
              ucpId: job.job_id,
              id: job.job_id,
              status: job.status,
              totalChunks: job.stats?.total_chunks || 0,
              totalInputTokens: job.stats?.total_input_tokens || 0,
              totalOutputTokens: job.stats?.total_output_tokens || 0,
              totalCost: job.stats?.total_cost || 0,
              completedAt: job.created_at,
              savedAt: job.created_at
            }))
            
            // Sort by completedAt date, most recent first
            transformedPacks.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            
            setPacks(transformedPacks)
            return
          }
        }
      } catch (jobsError) {
        console.error('Failed to load from jobs endpoint:', jobsError)
      }
      
      // Final fallback to localStorage for backwards compatibility
      try {
        const storedPacks = localStorage.getItem('ucp_packs')
        if (storedPacks) {
          const parsedPacks = JSON.parse(storedPacks)
          setPacks(parsedPacks)
        } else {
          setPacks([])
        }
      } catch (localError) {
        console.error('Failed to load packs from localStorage:', localError)
        setPacks([])
      }
    } finally {
      setLoading(false)
    }
  }

  const downloadComplete = async (ucpId: string) => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/download/${ucpId}/complete`, {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download complete UCP')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `complete_ucp_${ucpId}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download complete UCP')
    }
  }

  const downloadPack = async (ucpId: string) => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/download/${ucpId}/pack`, {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download pack')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ucp_pack_${ucpId}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download pack')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading packs...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Context Packs</h1>
          <p className="text-gray-600 mt-1">View and manage your completed UCP analysis results</p>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Packs List */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Packs</h2>
            <div className="space-y-3">
              {!user ? (
                <div className="bg-white border border-gray-200 p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 flex items-center justify-center mx-auto mb-4 rounded-full">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">Your Context Packs</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Process chat exports to see your packs here
                  </p>
                  <a 
                    href="/process" 
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 text-sm font-medium transition-colors inline-block rounded"
                  >
                    Get Started
                  </a>
                </div>
              ) : packs.length === 0 ? (
                <div className="bg-white border border-gray-200 p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-gray-600 text-sm mb-4">No packs found</div>
                  <a 
                    href="/process" 
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 text-sm font-medium transition-colors inline-block"
                  >
                    Process a file
                  </a>
                </div>
              ) : (
                packs.map(pack => (
                  <div
                    key={pack.ucpId}
                    onClick={() => setSelectedPack(pack)}
                    className={`bg-white  p-4 cursor-pointer transition-all ${
                      selectedPack && (selectedPack.ucpId || selectedPack.id) === (pack.ucpId || pack.id) 
                        ? 'border-gray-400 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-mono text-xs text-gray-600">
                        {(pack.ucpId || pack.id || 'unknown').slice(0, 8)}...
                      </div>
                      <div className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium">
                        Completed
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      {new Date(pack.completedAt).toLocaleDateString()}
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{pack.totalChunks} chunks</span>
                      <span>${pack.totalCost?.toFixed(3) || '0.000'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pack Details */}
          <div className="lg:col-span-3">
            {selectedPack ? (
              <div className="space-y-6">
                <div className="bg-white p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Pack Details</h3>
                      <p className="text-sm text-gray-600 mt-1">UCP ID: {selectedPack.ucpId || selectedPack.id}</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => downloadComplete(selectedPack.ucpId || selectedPack.id || '')}
                        className="bg-gray-600 hover:bg-gray-700 text-  px-4 py-2 text-sm font-medium transition-colors flex items-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download UCP</span>
                      </button>
                      <button
                        onClick={() => downloadPack(selectedPack.ucpId || selectedPack.id || '')}
                        className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium transition-colors flex items-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Pack</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedPack.totalChunks}
                      </div>
                      <div className="text-sm text-gray-600">Chunks</div>
                    </div>
                    <div className="bg-gray-50  p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <BarChart3 className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedPack.totalInputTokens?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Input Tokens</div>
                    </div>
                    <div className="bg-gray-50  p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Brain className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedPack.totalOutputTokens?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Output Tokens</div>
                    </div>
                    <div className="bg-gray-50 p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <DollarSign className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        ${selectedPack.totalCost?.toFixed(3) || '0.000'}
                      </div>
                      <div className="text-sm text-gray-600">Total Cost</div>
                    </div>
                  </div>

                  <div className="mt-6 text-center text-sm text-gray-500">
                    <div className="flex items-center justify-center space-x-4">
                      <span>Completed: {new Date(selectedPack.completedAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>Saved: {new Date(selectedPack.savedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 text-center">
                {!user ? (
                  <>
                    <div className="w-16 h-16 bg-blue-100 flex items-center justify-center mx-auto mb-6 rounded-full">
                      <Brain className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Universal Context Packs</h3>
                    <div className="text-center max-w-sm mx-auto space-y-3 text-sm text-gray-600">
                      <p>Transform chat exports into AI-ready context packs</p>
                      <div className="flex justify-center space-x-6 text-xs text-gray-500">
                        <span>✓ Smart Processing</span>
                        <span>✓ Intelligent Chunking</span>
                        <span>✓ Ready to Use</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a context pack to view details</h3>
                    <p className="text-gray-600">Choose a context pack from the sidebar to see analysis and download files.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
