'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, Plus, Loader2, AlertCircle, Eye, FileJson, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import FreeCreditsPrompt from '@/components/FreeCreditsPrompt'
import { useFreeCreditsPrompt } from '@/hooks/useFreeCreditsPrompt'
import { API_BASE_URL } from '@/lib/api'
import { sendServerEvent } from '@/lib/analytics'

interface UCPPack {
  ucpId?: string
  id?: string
  pack_name?: string
  description?: string
  status: string
  total_sources?: number
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
  const searchParams = useSearchParams()

  const [packs, setPacks] = useState<UCPPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creatingPack, setCreatingPack] = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [hasActiveProcessing, setHasActiveProcessing] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null)
  const freeCreditsPrompt = useFreeCreditsPrompt()
  const activeProcessingPollInFlight = useRef(false)

  useEffect(() => {
    if (!session?.access_token) return
    if (document.referrer.includes('/process-v4')) {
      sendServerEvent('returned_to_packs_from_process', session.access_token)
    }
  }, [session])

  // Auto-onboarding: handle ?new_user=1 passed from the email verification callback.
  // Keep the landing on /packs so new users see their dashboard first.
  useEffect(() => {
    const isNewUser = searchParams.get('new_user') === '1'
    if (!isNewUser || !user || !session) return

    // Remove the flag from URL immediately so refresh doesn't trigger again
    router.replace('/packs')
  }, [searchParams, user, session])

  // Helper function to format token counts
  const formatTokenCount = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${Math.round(tokens / 1000000)}M tokens`
    } else if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k tokens`
    }
    return `${tokens} tokens`
  }


  useEffect(() => {
    console.log('[Packs] useEffect triggered - user:', !!user, 'session:', !!session);

    // Load packs whenever component mounts and user is authenticated
    if (user && session) {
      console.log('[Packs] User authenticated, loading packs...');
      loadPacks()
    } else if (!user && !session) {
      console.log('[Packs] No authentication, showing sample packs');
      // If user is not authenticated, show sample packs
      setLoading(false)
      setError(null)
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
    } else {
      // One is defined but not the other - still loading auth
      console.log('[Packs] Waiting for authentication to complete...');
      // Keep loading state active while auth is in progress
    }
  }, [user, session])

  const loadPacks = async (options: { silent?: boolean } = {}) => {
    const { silent = false } = options
    console.log('[Packs] loadPacks called, user:', user ? 'authenticated' : 'not authenticated')
    if (!user) {
      setPacks([])
      if (!silent) setLoading(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()

    try {
      console.log('[Packs] Starting to load packs...')
      if (!silent) setLoading(true)
      setError(null) // Clear any previous errors

      // Add timeout to prevent hanging requests
      // Shorter timeout since if DB is busy with tree building, we want to fail fast
      try {
        console.log('[Packs] Fetching from /api/v2/packs...')
        timeoutId = setTimeout(() => {
          console.warn('[Packs] Aborting pack list request after 2s')
          controller.abort()
          if (!silent) {
            //reload page
            // setLoading(false)
            window.location.reload()
            //force reload
          }
        }, 2000)

        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
          signal: controller.signal
        })

        console.log('[Packs] Response received:', response.status)

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
          total_sources: pack.total_sources || 0,
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

        // Check if user has active processing
        try {
          const processingController = new AbortController()
          const processingTimeout = setTimeout(() => {
            processingController.abort()
          }, 8000)

          const processingResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/user/has-active-processing`, {
            signal: processingController.signal
          })

          clearTimeout(processingTimeout)

          if (processingResponse.ok) {
            const processingData = await processingResponse.json()
            setHasActiveProcessing(processingData.has_active_processing || false)
          }
        } catch (processingError) {
          console.warn('[Packs] Failed to check active processing status:', processingError)
          // Don't block - just assume no active processing
          setHasActiveProcessing(false)
        }

        return // Success, exit early

      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn('[Packs] Fetch aborted — returning early')
          if (!silent) setLoading(false)
          return
        }
        throw fetchError
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred'
      console.error('Failed to load packs from server:', errorMessage)
      setError(errorMessage)
      setPacks([]) // Ensure we show empty state even if everything fails


    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      if (!silent) setLoading(false)
    }
  }

  // Poll for active processing to clear the UI state promptly after completion
  useEffect(() => {
    if (!user || !session || !hasActiveProcessing) return

    let cancelled = false

    const pollActiveProcessing = async () => {
      if (activeProcessingPollInFlight.current) return
      activeProcessingPollInFlight.current = true

      try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/user/has-active-processing`)
        if (!response.ok || cancelled) return

        const data = await response.json()
        const stillActive = data.has_active_processing || false
        setHasActiveProcessing(stillActive)

        // When backend finishes, refresh packs without flashing the full-page loader
        if (!stillActive) {
          await loadPacks({ silent: true })
        }
      } catch (pollError) {
        console.warn('[Packs] Active processing poll failed:', pollError)
      } finally {
        activeProcessingPollInFlight.current = false
      }
    }

    pollActiveProcessing()
    const intervalId = setInterval(pollActiveProcessing, 5000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [hasActiveProcessing, user, session, makeAuthenticatedRequest])


  const handleViewPack = (pack: UCPPack) => {
    const packId = pack.ucpId || pack.id

    // If not authenticated, redirect to auth signup
    if (!user) {
      router.push('/auth?mode=signup')
      return
    }

    router.push(`/process-v4?pack=${packId}`)
  }

  const handleCreatePack = async () => {
    if (!user) {
      router.push('/auth?mode=signup')
      return
    }
    if (creatingPack) return
    setCreatingPack(true)
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_name: 'Untitled Pack' })
      })
      if (response.ok) {
        const pack = await response.json()
        router.push(`/process-v4?pack=${pack.pack_id}`)
      } else {
        router.push('/process-v4')
      }
    } catch {
      router.push('/process-v4')
    } finally {
      setCreatingPack(false)
    }
  }

  const handleSubmitCreatePack = async () => {
    if (!newPackName.trim()) return

    setCreatingPack(true)
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_name: newPackName.trim() })
      })

      if (response.ok) {
        const pack = await response.json()
        setShowCreateModal(false)
        setNewPackName('')
        // Navigate to process-v4 with the new pack ID
        router.push(`/process-v4?pack=${pack.pack_id}`)
      } else {
        alert('Failed to create pack. Please try again.')
      }
    } catch (error) {
      console.error('[Packs] Error creating pack:', error)
      alert('Failed to create pack. Please try again.')
    } finally {
      setCreatingPack(false)
    }
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
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading packs... (reload if stalled)</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Packs</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadPacks()}
            className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Context Packs</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your analysis results</p>
          </div>
          <button
            onClick={handleCreatePack}
            disabled={hasActiveProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={hasActiveProcessing ? "Processing in progress" : ""}
          >
            <Plus className="w-4 h-4" />
            New Pack
          </button>
        </div>

        {/* Card Grid */}
        {packs.length === 0 ? (
          <div className="text-center py-20 bg-[#1a1a1a] rounded-lg border border-gray-800">
            <p className="text-base font-medium text-white mb-1">No packs yet</p>
            <p className="text-sm text-gray-400">Create your first context pack to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map((pack) => (
              <div
                key={pack.ucpId || pack.id}
                className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden transition-all hover:border-gray-700 hover:shadow-lg hover:shadow-gray-900/50 group flex flex-col"
              >
                {/* Header - Clickable */}
                <div
                  onClick={() => handleViewPack(pack)}
                  className="p-5 cursor-pointer hover:bg-[#1f1f1f] transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white mb-1 truncate">
                        {pack.pack_name || 'Untitled Pack'}
                      </h3>
                      {pack.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {pack.description}
                        </p>
                      )}
                    </div>
                    <span className={`ml-3 flex-shrink-0 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${pack.total_chunks > 0
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-gray-500/10 text-gray-400'
                      }`}>
                      {pack.total_chunks > 0 ? 'Active' : 'Empty'}
                    </span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Sources</div>
                      <div className="text-lg font-semibold text-white">{pack.total_sources || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Chunks</div>
                      <div className="text-lg font-semibold text-white">{pack.total_chunks || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Tokens</div>
                      <div className="text-sm font-semibold text-white">
                        {pack.total_input_tokens ? formatTokenCount(pack.total_input_tokens) : '0'}
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-xs text-gray-600 mt-4">
                    {new Date(pack.completedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="border-t border-gray-800 bg-[#141414] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const packId = pack.ucpId || pack.id
                        if (packId) {
                          router.push(`/tree/${packId}`)
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Tree</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const packId = pack.ucpId || pack.id
                        if (packId) {
                          router.push(`/process-v4?pack=${packId}`)
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Sources</span>
                    </button>

                    {/* Delete Button */}
                    {confirmDeleteId === (pack.ucpId || pack.id) ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePack(pack.ucpId || pack.id || '')
                          }}
                          disabled={deletingPackId === (pack.ucpId || pack.id)}
                          className="px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                        >
                          {deletingPackId === (pack.ucpId || pack.id) ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDeleteId(null)
                          }}
                          className="px-2 py-2 text-xs text-gray-400 hover:text-white rounded"
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
                        className="px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete pack"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
