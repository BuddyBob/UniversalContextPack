'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText, Brain, BarChart3, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import FreeCreditsPrompt from '@/components/FreeCreditsPrompt'
import { useFreeCreditsPrompt } from '@/hooks/useFreeCreditsPrompt'
import { API_BASE_URL } from '@/lib/api'
import { getNewUserCredits } from '@/lib/credit-config'

interface UCPPack {
  ucpId?: string
  id?: string
  pack_name?: string
  description?: string
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
  const router = useRouter()
  const [packs, setPacks] = useState<UCPPack[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const freeCreditsPrompt = useFreeCreditsPrompt()

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

  useEffect(() => {
    if (user && session) {
      loadPacks()
    } else {
      // If user is not authenticated, show sample packs
      setLoading(false)
      const samplePacks: UCPPack[] = [
        {
          ucpId: 'sample-1',
          id: 'sample-1',
          pack_name: 'Demo - Research',
          description: 'A collection of documents and conversations',
          status: 'completed',
          total_chunks: 5,
          total_input_tokens: 25000,
          total_output_tokens: 2200,
          total_cost: 0.15,
          completedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          savedAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          ucpId: 'sample-2',
          id: 'sample-2',
          pack_name: 'Demo - Work Notes',
          description: 'Meeting notes and project documentation',
          status: 'completed',
          total_chunks: 3,
          total_input_tokens: 18000,
          total_output_tokens: 1800,
          total_cost: 0.10,
          completedAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          savedAt: new Date(Date.now() - 172800000).toISOString()
        }
      ]
      setPacks(samplePacks)
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

      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`Failed to fetch packs: ${response.status} ${response.statusText}`)
        }

        const packsData = await response.json()

        // Validate that the response is an array
        if (!Array.isArray(packsData)) {
          console.warn('Server returned non-array response:', packsData)
          throw new Error('Invalid response format from server')
        }

        // Transform the packs data to match the UCPPack interface
        const transformedPacks: UCPPack[] = packsData.map((pack: any) => ({
          ucpId: pack.pack_id,
          id: pack.pack_id,
          pack_name: pack.pack_name,
          description: pack.description,
          status: 'completed',
          total_chunks: pack.total_chunks || pack.processed_chunks || 0,
          total_input_tokens: pack.total_input_tokens || 0,
          total_output_tokens: pack.total_output_tokens || 0,
          total_cost: pack.total_cost || 0,
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


  const handleViewPack = (pack: UCPPack) => {
    const packId = pack.ucpId || pack.id

    // If not authenticated, trigger auth prompt for all packs (including demos)
    if (!user) {
      freeCreditsPrompt.triggerPrompt("accessing context packs")
      return
    }

    router.push(`/process?pack_id=${packId}`)
  }

  const handleCreatePack = () => {
    // If not authenticated, trigger auth prompt
    if (!user) {
      freeCreditsPrompt.triggerPrompt("creating a context pack")
      return
    }
    router.push('/process?create_new=true')
  }

  const handleDeletePack = async (packId: string) => {
    if (deletingPackId) return // Prevent multiple simultaneous deletes

    setDeletingPackId(packId)

    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v2/packs/${packId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete pack')
      }

      // Remove pack from local state
      setPacks(prevPacks => prevPacks.filter(p => (p.ucpId || p.id) !== packId))
      setConfirmDeleteId(null)

    } catch (error) {
      console.error('Error deleting pack:', error)
      alert('Failed to delete pack. Please try again.')
    } finally {
      setDeletingPackId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-gray-300 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading packs...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080a09]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white">Context Packs Dashboard</h1>
          <p className="text-gray-400 mt-2">Create, manage, and download your UCP analysis results</p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create New Pack Card - Always First */}
          <div
            onClick={handleCreatePack}
            className="bg-gray-800 border-2 border-gray-700 border-dashed rounded-2xl p-8 cursor-pointer transition-all hover:bg-gray-750 hover:border-gray-600 flex flex-col items-center justify-center min-h-[280px] group"
          >
            <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-gray-600 transition-all">
              <Plus className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-200 mb-2">Create New Pack</h3>
            <p className="text-gray-400 text-sm text-center">
              Start processing a new context pack
            </p>
          </div>

          {/* Pack Cards */}
          {packs.length === 0 ? (
            <div className="col-span-full flex items-center justify-center min-h-[280px]">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No packs yet</h3>
                <p className="text-gray-400 text-sm">Create your first context pack to get started</p>
              </div>
            </div>
          ) : (
            packs.map(pack => (
              <div
                key={pack.ucpId || pack.id}
                onClick={() => handleViewPack(pack)}
                className="bg-gray-900 rounded-2xl border-2 border-gray-800 p-6 cursor-pointer transition-all hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/50 flex flex-col min-h-[280px] group"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2 truncate">
                      {pack.pack_name || 'Untitled Pack'}
                    </h3>
                    {pack.description && (
                      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{pack.description}</p>
                    )}
                    <div className="px-2 py-1 bg-green-900/40 text-green-400 text-xs font-semibold rounded-lg inline-block">
                      {pack.total_chunks > 0 ? 'Completed' : 'Empty'}
                    </div>
                  </div>
                  <FileText className="w-6 h-6 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>

                {/* Stats */}
                <div className="flex-1 space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Chunks</span>
                    <span className="text-lg font-bold text-white">{pack.total_chunks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Input Tokens</span>
                    <span className="text-sm font-semibold text-gray-200">
                      {pack.total_input_tokens ? formatTokenCount(pack.total_input_tokens) : '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Output Tokens</span>
                    <span className="text-sm font-semibold text-gray-200">
                      {pack.total_output_tokens ? formatTokenCount(pack.total_output_tokens) : '0'}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-gray-800">
                  <div className="text-xs text-gray-500">
                    {new Date(pack.completedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>

                {/* Quick Actions - Show on Hover */}
                <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity space-y-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const packId = pack.ucpId || pack.id
                      if (packId) {
                        router.push(`/process?pack_id=${packId}`)

                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Sources
                  </button>
                  {/* Delete Button with Confirmation */}
                  {confirmDeleteId === (pack.ucpId || pack.id) ? (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePack(pack.ucpId || pack.id || '')
                        }}
                        disabled={deletingPackId === (pack.ucpId || pack.id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingPackId === (pack.ucpId || pack.id) ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(null)
                        }}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeleteId(pack.ucpId || pack.id || null)
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Pack
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Free Credits Prompt */}
      <FreeCreditsPrompt
        isOpen={freeCreditsPrompt.showPrompt}
        onClose={freeCreditsPrompt.closePrompt}
        feature="accessing context packs dashboard"
      />
    </div>
  )
}
