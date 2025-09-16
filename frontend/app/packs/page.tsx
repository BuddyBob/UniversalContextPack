'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, FileText, Brain, BarChart3, Calendar, DollarSign, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import AuthModal from '@/components/AuthModal'
import FreeCreditsPrompt from '@/components/FreeCreditsPrompt'
import { useFreeCreditsPrompt } from '@/hooks/useFreeCreditsPrompt'
import { API_BASE_URL } from '@/lib/api'

interface UCPPack {
  ucpId?: string
  id?: string
  status: string
  total_chunks: number
  total_input_tokens?: number
  total_output_tokens?: number
  total_cost?: number
  completedAt: string
  completed_at?: string
  savedAt: string
}

export default function PacksPage() {
  const { user, session, makeAuthenticatedRequest } = useAuth()
  const searchParams = useSearchParams()
  const [packs, setPacks] = useState<UCPPack[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<UCPPack | null>(null)
  const freeCreditsPrompt = useFreeCreditsPrompt()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const PACKS_PER_PAGE = 10

  // Helper function to format token counts
  const formatTokenCount = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${Math.round(tokens / 1000000)}M tokens`
    } else if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k tokens`
    }
    return `${tokens} tokens`
  }

  // Check if download options should be enabled
  const canDownloadCompact = (outputTokens: number | undefined): boolean => {
    return !outputTokens || outputTokens >= 50000
  }

  const canDownloadStandard = (outputTokens: number | undefined): boolean => {
    return !outputTokens || outputTokens >= 100000
  }

  // Pagination calculations
  const totalPages = Math.ceil(packs.length / PACKS_PER_PAGE)
  const startIndex = currentPage * PACKS_PER_PAGE
  const endIndex = startIndex + PACKS_PER_PAGE
  const currentPacks = packs.slice(startIndex, endIndex)

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  useEffect(() => {
    if (user && session) {
      loadPacks()
    } else {
      // If user is not authenticated, stop loading immediately
      setLoading(false)
      setPacks([])
    }
  }, [user, session])

  // Auto-select pack if ID is provided in URL
  useEffect(() => {
    const packId = searchParams.get('id')
    if (packId && packs.length > 0) {
      const targetPack = packs.find(pack => 
        (pack.ucpId === packId) || (pack.id === packId)
      )
      if (targetPack) {
        setSelectedPack(targetPack)
      }
    }
  }, [packs, searchParams])

  const loadPacks = async () => {
    if (!user) {
      setPacks([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/packs`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        
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
          total_chunks: pack.stats?.total_chunks || 0,
          total_input_tokens: pack.stats?.total_input_tokens || 0,
          total_output_tokens: pack.stats?.total_output_tokens || 0,
          total_cost: pack.stats?.total_cost || 0,
          completedAt: pack.created_at,
          savedAt: pack.created_at
        }))
        
        // Sort by completedAt date, most recent first
        transformedPacks.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        
        setPacks(transformedPacks)
        return // Success, exit early
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Request timed out after 30 seconds')
          throw new Error('Request timed out. Please try again.')
        }
        throw fetchError
      }
    } catch (e) {
      console.error('Failed to load packs from server:', e)
      // Fallback to /api/jobs endpoint
      try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/jobs`)
        
        if (response.ok) {
          const jobs = await response.json()
          
          if (Array.isArray(jobs)) {
            const transformedPacks: UCPPack[] = jobs.map((job: any) => ({
              ucpId: job.job_id,
              id: job.job_id,
              status: job.status,
              total_chunks: job.stats?.total_chunks || 0,
              total_input_tokens: job.stats?.total_input_tokens || 0,
              total_output_tokens: job.stats?.total_output_tokens || 0,
              total_cost: job.stats?.total_cost || 0,
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

      const response = await fetch(`${API_BASE_URL}/api/download/${ucpId}/complete`, {
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

  const downloadCompact = async (ucpId: string) => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/download/${ucpId}/ultra-compact`, {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download compact UCP')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compact_ucp_${ucpId}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download compact UCP')
    }
  }

  const downloadStandard = async (ucpId: string) => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/download/${ucpId}/standard`, {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download standard UCP')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `standard_ucp_${ucpId}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download standard UCP')
    }
  }

  const downloadPack = async (ucpId: string) => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/download/${ucpId}/pack`, {
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Recent Packs</h2>
              {packs.length > PACKS_PER_PAGE && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 0}
                    className={`p-1 rounded-full transition-colors ${
                      currentPage === 0 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-500">
                    {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage >= totalPages - 1}
                    className={`p-1 rounded-full transition-colors ${
                      currentPage >= totalPages - 1 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {!user ? (
                <div className="bg-white border border-gray-200 p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 flex items-center justify-center mx-auto mb-4 rounded-full">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">Your Context Packs</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Process chat exports to see your packs here. <strong>Get 2 free credits</strong> when you sign in!
                  </p>
                  <button 
                    onClick={() => freeCreditsPrompt.triggerPrompt("viewing your processed context packs")}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 text-sm font-medium transition-colors inline-block rounded"
                  >
                    Sign In & Get Started
                  </button>
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
                currentPacks.map(pack => (
                  <div
                    key={pack.ucpId}
                    onClick={() => setSelectedPack(pack)}
                    className={`bg-white border p-4 cursor-pointer transition-all ${
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
                      <span>{pack.total_chunks} chunks</span>
                      <span>${pack.total_cost?.toFixed(3) || '0.000'}</span>
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
                  </div>

                  {/* How to Port Button */}
                  <div className="mb-6">
                    <a 
                      href="/how-to-port"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>How to Port This Pack</span>
                    </a>
                  </div>

                  {/* Download Options */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Download Options</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <button
                        onClick={canDownloadCompact(selectedPack.total_output_tokens) ? () => downloadCompact(selectedPack.ucpId || selectedPack.id || '') : undefined}
                        disabled={!canDownloadCompact(selectedPack.total_output_tokens)}
                        className={`p-3 border rounded-lg transition-all text-center group ${
                          canDownloadCompact(selectedPack.total_output_tokens)
                            ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer'
                            : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <Download className={`h-4 w-4 mx-auto mb-1 group-hover:scale-110 transition-transform ${
                          canDownloadCompact(selectedPack.total_output_tokens) ? 'text-gray-600' : 'text-gray-400'
                        }`} />
                        <div className={`text-sm font-medium ${
                          canDownloadCompact(selectedPack.total_output_tokens) ? 'text-gray-900' : 'text-gray-500'
                        }`}>Compact</div>
                        <div className={`text-xs ${
                          canDownloadCompact(selectedPack.total_output_tokens) ? 'text-gray-500' : 'text-gray-400'
                        }`}>~50k tokens</div>
                      </button>
                      
                      <button
                        onClick={canDownloadStandard(selectedPack.total_output_tokens) ? () => downloadStandard(selectedPack.ucpId || selectedPack.id || '') : undefined}
                        disabled={!canDownloadStandard(selectedPack.total_output_tokens)}
                        className={`p-3 border rounded-lg transition-all text-center group ${
                          canDownloadStandard(selectedPack.total_output_tokens)
                            ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer'
                            : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <Download className={`h-4 w-4 mx-auto mb-1 group-hover:scale-110 transition-transform ${
                          canDownloadStandard(selectedPack.total_output_tokens) ? 'text-gray-600' : 'text-gray-400'
                        }`} />
                        <div className={`text-sm font-medium ${
                          canDownloadStandard(selectedPack.total_output_tokens) ? 'text-gray-900' : 'text-gray-500'
                        }`}>Standard</div>
                        <div className={`text-xs ${
                          canDownloadStandard(selectedPack.total_output_tokens) ? 'text-gray-500' : 'text-gray-400'
                        }`}>~100k tokens</div>
                      </button>
                      
                      <button
                        onClick={() => downloadComplete(selectedPack.ucpId || selectedPack.id || '')}
                        className="p-3 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg transition-all text-center group"
                      >
                        <Download className="h-4 w-4 text-gray-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                        <div className="text-sm font-medium text-gray-900">complete_ucp.txt</div>
                        <div className="text-xs text-gray-500">
                          {selectedPack.total_output_tokens 
                            ? `~${formatTokenCount(selectedPack.total_output_tokens)}` 
                            : 'All tokens'
                          }
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 border border-gray-200 p-4 text-center rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedPack.total_chunks || 0}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Chunks</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 p-4 text-center rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <BarChart3 className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedPack.total_input_tokens ? selectedPack.total_input_tokens.toLocaleString() : '0'}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Input Tokens</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 p-4 text-center rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <Brain className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedPack.total_output_tokens ? selectedPack.total_output_tokens.toLocaleString() : '0'}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Output Tokens</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 p-4 text-center rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <DollarSign className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        ${selectedPack.total_cost ? selectedPack.total_cost.toFixed(3) : '0.000'}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Total Cost</div>
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

      {/* Free Credits Prompt */}
      <FreeCreditsPrompt
        isOpen={freeCreditsPrompt.showPrompt}
        onClose={freeCreditsPrompt.closePrompt}
        feature="viewing your processed context packs"
      />
    </div>
  )
}
