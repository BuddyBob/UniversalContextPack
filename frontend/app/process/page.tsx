'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Brain, FileText, BarChart3, CheckCircle, Play, Download, Terminal, X, ExternalLink, CreditCard, Loader, Lock, Info, HelpCircle, ChevronDown, Plus, FolderOpen, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthModal from '@/components/AuthModal';
import PaymentNotification, { usePaymentNotifications } from '@/components/PaymentNotification';
import FreeCreditsPrompt from '@/components/FreeCreditsPrompt';
import { useFreeCreditsPrompt } from '@/hooks/useFreeCreditsPrompt';
import { API_ENDPOINTS, API_BASE_URL } from '@/lib/api';
import { analytics } from '@/lib/analytics';
import { getNewUserCredits } from '@/lib/credit-config';
import { supabase } from '@/lib/supabase';

interface PaymentStatus {
  plan: string
  credits_balance: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
}

interface Pack {
  pack_id: string
  pack_name: string
  description?: string
  custom_system_prompt?: string
  total_sources: number
  total_tokens: number
  created_at?: string
}

export default function ProcessPage() {
  const { user, session, makeAuthenticatedRequest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingExtraction, setPendingExtraction] = useState(false); // Track if extraction is pending after auth
  const freeCreditsPrompt = useFreeCreditsPrompt();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [extractionData, setExtractionData] = useState<any>(null);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [timeEstimate, setTimeEstimate] = useState<any>(null);
  const [analysisTimeEstimate, setAnalysisTimeEstimate] = useState<any>(null);
  const [selectedChunksEstimatedTime, setSelectedChunksEstimatedTime] = useState<number>(0);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const [chunkData, setChunkData] = useState<any>(null);
  const [availableChunks, setAvailableChunks] = useState<any[]>([]);
  const [selectedChunks, setSelectedChunks] = useState<Set<number>>(new Set());
  const [maxChunks, setMaxChunks] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'uploaded' | 'extracting' | 'extracted' | 'chunking' | 'chunked' | 'analyzing' | 'analyzed' | 'email_mode' | 'email_completed'>('upload');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showChunkModal, setShowChunkModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sessionId] = useState(() => Date.now().toString()); // Unique session ID
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [lastProgressTimestamp, setLastProgressTimestamp] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'warning'>('connected');
  const [paymentLimits, setPaymentLimits] = useState<{ canProcess: boolean, credits_balance: number, plan?: string, isUnlimited?: boolean } | null>(null);
  const [emailModeStartTime, setEmailModeStartTime] = useState<number | null>(null);
  const [paymentLimitsError, setPaymentLimitsError] = useState<boolean>(false);
  const [lastPaymentCheck, setLastPaymentCheck] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFileTypes, setShowFileTypes] = useState(false);
  const [conversationUrl, setConversationUrl] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancellingSource, setIsCancellingSource] = useState(false);
  const [currentProcessedChunks, setCurrentProcessedChunks] = useState<number>(0);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'files' | 'url' | 'chat_export' | 'document' | 'text' | null>(null);
  const [showCreditsTooltip, setShowCreditsTooltip] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [textError, setTextError] = useState<string | null>(null);
  const [isLogPanelCollapsed, setIsLogPanelCollapsed] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [shouldHighlightOptions, setShouldHighlightOptions] = useState(false);

  // Pack-based workflow state
  const [showPackSelector, setShowPackSelector] = useState(false);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [availablePacks, setAvailablePacks] = useState<Pack[]>([]);
  const [packSources, setPackSources] = useState<any[]>([]);
  const [showCreatePack, setShowCreatePack] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [newPackDescription, setNewPackDescription] = useState('');
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const [hasHandledCreateNew, setHasHandledCreateNew] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [isEditingPackName, setIsEditingPackName] = useState(false);
  const [editedPackName, setEditedPackName] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [isSavingCustomPrompt, setIsSavingCustomPrompt] = useState(false);
  const [customPromptSavedAt, setCustomPromptSavedAt] = useState<number | null>(null);
  const [customPromptError, setCustomPromptError] = useState<string | null>(null);
  const [showPackUpdateNotification, setShowPackUpdateNotification] = useState(false);
  const [sourcePendingAnalysis, setSourcePendingAnalysis] = useState<{
    sourceId: string;
    totalChunks: number;
    creditsRequired: number;
    userCredits: number;
    hasUnlimited: boolean;
    canProceed: boolean;
    creditsNeeded: number;
  } | null>(null);
  const [analysisLimits, setAnalysisLimits] = useState<Record<string, number>>({});
  const [isAnalysisStarting, setIsAnalysisStarting] = useState<string | null>(null); // Track source ID that's starting analysis

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const paymentLimitsRequestRef = useRef<Promise<any> | null>(null);
  const isExtractionPollingRef = useRef<boolean>(false);
  const extractionAbortControllerRef = useRef<AbortController | null>(null);
  const hasAutoCreatedRef = useRef<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Payment notifications
  const {
    notification,
    hideNotification,
    showLimitWarning,
    showNotification
  } = usePaymentNotifications();

  // Load packs on mount (including sample packs for unauthenticated users)
  useEffect(() => {
    loadPacks();
  }, [user]);

  // Sync custom prompt state when pack changes
  useEffect(() => {
    setCustomSystemPrompt(selectedPack?.custom_system_prompt || '');
  }, [selectedPack]);

  // Check for ready_for_analysis sources and restore modal if needed
  useEffect(() => {
    if (!selectedPack || !packSources.length) return;

    // Find any source that's ready for analysis and not currently showing in modal
    const readySource = packSources.find((s: any) => s.status === 'ready_for_analysis');

    if (readySource && !sourcePendingAnalysis && !isAnalysisStarting) {
      // Fetch credit check and open modal
      const fetchCreditCheck = async () => {
        try {
          const creditResponse = await makeAuthenticatedRequest(
            `${API_BASE_URL}/api/v2/sources/${readySource.source_id}/credit-check`
          );
          if (creditResponse.ok) {
            const creditData = await creditResponse.json();
            setSourcePendingAnalysis({
              sourceId: creditData.sourceId || readySource.source_id,
              totalChunks: creditData.totalChunks,
              creditsRequired: creditData.creditsRequired,
              userCredits: creditData.userCredits,
              hasUnlimited: creditData.hasUnlimited,
              canProceed: creditData.canProceed,
              creditsNeeded: creditData.creditsNeeded || 0
            });
            setUploadMethod(null); // Switch UI from URL input to analysis modal
            setCurrentStep('upload');
          }
        } catch (error) {
          console.error('Error fetching credit check:', error);
        }
      };
      fetchCreditCheck();
    }
  }, [selectedPack, packSources, sourcePendingAnalysis, isAnalysisStarting]);

  // Poll for source status updates
  useEffect(() => {
    if (!selectedPack) return;

    const pollSourcesStatus = async () => {
      try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}`);
        if (response.ok) {
          const data = await response.json();
          const sources = data.sources || [];
          setPackSources(sources);

          // Check if source that was starting is now actually analyzing
          if (isAnalysisStarting) {
            const startedSource = sources.find((s: any) => s.source_id === isAnalysisStarting);
            const analyzingStatuses = ['analyzing', 'processing', 'analyzing_chunks'];
            if (startedSource && analyzingStatuses.includes(startedSource.status?.toLowerCase())) {
              setIsAnalysisStarting(null);
            } else if (startedSource && startedSource.status === 'completed') {
              // Source finished already, clear the starting flag
              setIsAnalysisStarting(null);
            } else if (startedSource && startedSource.status === 'failed') {
              // Source failed, clear the starting flag
              setIsAnalysisStarting(null);
            }
          }

          // Check if any source just completed
          const justCompleted = sources.find((s: any) =>
            s.status === 'completed' &&
            !packSources.find((ps: any) => ps.source_id === s.source_id && ps.status === 'completed')
          );
          if (justCompleted) {
            setShowPackUpdateNotification(true);
            setTimeout(() => setShowPackUpdateNotification(false), 3000);
            setAnalysisLimits((prev) => {
              if (prev[justCompleted.source_id]) {
                const updated = { ...prev };
                delete updated[justCompleted.source_id];
                return updated;
              }
              return prev;
            });

            // Clear the pending analysis modal if this source was pending
            if (sourcePendingAnalysis && sourcePendingAnalysis.sourceId === justCompleted.source_id) {
              setSourcePendingAnalysis(null);
            }
          }
        }
      } catch (error) {
        console.error('Error polling source status:', error);
      }
    };

    // Check if any sources are actively processing
    const hasActiveProcessing = packSources.some((s: any) =>
      ['extracting', 'analyzing', 'processing', 'analyzing_chunks', 'pending'].includes(s.status?.toLowerCase())
    );

    const shouldPoll = hasActiveProcessing || isAnalysisStarting;

    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Always poll once immediately to check current status
    pollSourcesStatus();

    // Set up continuous polling if there are active sources, waiting for analysis, or pending analysis modal
    if (shouldPoll) {
      // Poll every 2 seconds
      pollingIntervalRef.current = setInterval(pollSourcesStatus, 2000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [selectedPack, isAnalysisStarting, sourcePendingAnalysis]);

  // Auto-create pack function
  const autoCreatePack = async () => {
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const defaultName = `New Pack - ${timestamp}`;

    setIsCreatingPack(true);
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_name: defaultName,
          description: ''
        })
      });

      if (response.ok) {
        const pack = await response.json();
        setSelectedPack(pack);
        setCurrentStep('upload');
        setShowUploadOptions(true);
        addLog(`Created new pack: ${pack.pack_name}`);
        await loadPacks();
      }
    } catch (error) {
      console.error('Error creating pack:', error);
      addLog('Error creating pack');
    } finally {
      setIsCreatingPack(false);
    }
  };

  // Check for pack_id or create_new in URL params
  useEffect(() => {
    if (!user) return;

    const packId = searchParams.get('pack_id');
    const createNew = searchParams.get('create_new');

    if (createNew === 'true' && !hasHandledCreateNew) {
      // Show create pack modal when create_new=true in URL (only once per session)
      setShowCreatePack(true);
      setShowPackSelector(false);
      setHasHandledCreateNew(true);

      // Remove the create_new parameter from URL to prevent re-showing modal on navigation
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('create_new');
      window.history.replaceState({}, '', newUrl.toString());
    } else if (packId && packId !== 'undefined') {
      // Only load if we don't already have this pack selected
      if (!selectedPack || (selectedPack as any).pack_id !== packId) {
        loadPackDetails(packId);
      }
    } else if (!selectedPack && !hasHandledCreateNew) {
      // User is logged in but no pack selected - show pack selector
      // Don't show if we just handled create_new (they might be creating a pack)
      loadPacks();
    }
  }, [searchParams, user]);

  // Load session from localStorage on mount
  useEffect(() => {
    // Track process page view
    analytics.processPageView()

    const savedSession = localStorage.getItem('ucp_process_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setCurrentStep(session.currentStep || 'upload');
        setExtractionData(session.extractionData || null);
        setCostEstimate(session.costEstimate || null);
        setChunkData(session.chunkData || null);
        setAvailableChunks(session.availableChunks || []);
        setSelectedChunks(new Set(session.selectedChunks || []));
        setProgress(session.progress || 0);
        setLogs(session.logs || []);
        setAnalysisStartTime(session.analysisStartTime || null);
        setEmailModeStartTime(session.emailModeStartTime || null);
        setConversationUrl(session.chatgptUrl || '');
        setMaxChunks(session.maxChunks || null);
        setCurrentProcessedChunks(session.currentProcessedChunks || 0);
        setSelectedChunksEstimatedTime(session.selectedChunksEstimatedTime || 0);
        if (session.currentJobId) {
          setCurrentJobId(session.currentJobId);
          // If we were in the middle of analysis, start polling
          if (session.currentStep === 'analyzing') {
            setIsProcessing(true);
            startPollingAnalysisStatus(session.currentJobId);
            addLog(`Resumed monitoring analysis progress... (Start: ${session.analysisStartTime ? new Date(session.analysisStartTime).toLocaleTimeString() : 'unknown'}, Estimated: ${session.selectedChunksEstimatedTime || 0}s)`);

            // Force update to restart progress interval for time-based progress
            setTimeout(() => {
              setForceUpdate(prev => prev + 1);
            }, 100);
          }
        }
        addLog('Session restored from localStorage');

        // Force a re-render after restoration to ensure progress bar updates
        setTimeout(() => {
          setForceUpdate(prev => prev + 1);
        }, 500);
      } catch (error) {
        console.error('Failed to restore session:', error);
        addLog('Failed to restore previous session');
      }
    }
  }, []);

  // Check payment limits when user logs in (reduce frequency)
  useEffect(() => {
    if (user && session) {
      // Only check once per session, not on every change
      const lastCheck = localStorage.getItem('last_payment_check');
      const now = Date.now();
      if (!lastCheck || now - parseInt(lastCheck) > 300000) { // 5 minutes
        checkPaymentLimits()
          .then((limits) => {
            setPaymentLimits(limits);
            setPaymentLimitsError(false); // Clear any previous error
          })
          .catch((error) => {
            console.error('Error loading payment limits:', error);
            setPaymentLimitsError(true); // Mark error state
            // Set fallback state so user doesn't see "Loading..." forever
            setPaymentLimits({ canProcess: false, credits_balance: 0 });
          });
        localStorage.setItem('last_payment_check', now.toString());
      } else {
        // If we're using cached data, still try to get limits for initial load
        if (!paymentLimits) {
          checkPaymentLimits()
            .then((limits) => {
              setPaymentLimits(limits);
              setPaymentLimitsError(false); // Clear any previous error
            })
            .catch((error) => {
              console.error('Error loading initial payment limits:', error);
              setPaymentLimitsError(true); // Mark error state
              // Set fallback state so user doesn't see "Loading..." forever
              setPaymentLimits({ canProcess: false, credits_balance: 0 });
            });
        }
      }
    }
  }, [user?.id]); // Only depend on user ID, not session object

  // Handle payment success from URL parameters
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment_success');
    const sessionId = searchParams.get('session_id');

    if (paymentSuccess === 'true' && sessionId && user) {
      addLog('Payment successful! Refreshing credit balance...');

      // Show success notification
      showNotification(
        'upgrade_success',
        'Payment successful! Your credits have been added to your account.'
      );

      // Refresh payment limits after a short delay to allow webhook processing
      setTimeout(() => {
        checkPaymentLimits()
          .then((limits) => {
            setPaymentLimits(limits);
            setPaymentLimitsError(false);
            addLog(`Credit balance updated: ${limits.isUnlimited || limits.plan === 'unlimited' ? 'Unlimited access' : `${limits.credits_balance} credits available`}`);
          })
          .catch((error) => {
            console.error('Error refreshing payment limits after payment:', error);
            // If webhook hasn't processed yet, try manual credit verification
            addLog('Payment is processing...');
            manualCreditVerification(sessionId);
          });
      }, 1000); // Wait 1 second first, then try the fallback verification

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    const paymentCancelled = searchParams.get('payment_cancelled');
    if (paymentCancelled === 'true') {
      addLog('Payment was cancelled');
      showNotification(
        'info',
        'Payment was cancelled. No charges were made.'
      );

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    // Handle payment failures
    const paymentFailed = searchParams.get('payment_failed');
    if (paymentFailed === 'true') {
      const errorReason = searchParams.get('error_reason') || 'Payment processing failed';
      const errorCode = searchParams.get('error_code') || 'unknown_error';

      addLog(`Payment failed: ${errorReason}`);

      // Show appropriate notification based on error type
      if (errorCode === 'card_declined' || errorReason.toLowerCase().includes('card') || errorReason.toLowerCase().includes('declined')) {
        showNotification(
          'warning',
          'Payment failed: Your card was declined. Please try a different payment method or contact your bank.'
        );
      } else if (errorCode === 'insufficient_funds' || errorReason.toLowerCase().includes('insufficient')) {
        showNotification(
          'warning',
          'Payment failed: Insufficient funds. Please check your account balance and try again.'
        );
      } else if (errorCode === 'expired_card' || errorReason.toLowerCase().includes('expired')) {
        showNotification(
          'warning',
          'Payment failed: Your card has expired. Please update your payment method.'
        );
      } else if (errorCode === 'incorrect_cvc' || errorReason.toLowerCase().includes('cvc') || errorReason.toLowerCase().includes('security code')) {
        showNotification(
          'warning',
          'Payment failed: Incorrect security code (CVC). Please check your card details and try again.'
        );
      } else if (errorCode === 'processing_error' || errorReason.toLowerCase().includes('processing')) {
        showNotification(
          'warning',
          'Payment failed: Processing error. Please try again in a few minutes.'
        );
      } else {
        showNotification(
          'warning',
          `Payment failed: ${errorReason}. Please try again or contact support if the issue persists.`
        );
      }

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    // Handle payment timeout/session expiry
    const paymentExpired = searchParams.get('payment_expired');
    if (paymentExpired === 'true') {
      addLog('Payment session expired');
      showNotification(
        'info',
        'Payment session expired. Please try again to complete your purchase.'
      );

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, user]);

  // Save session to localStorage less frequently for better performance
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const session = {
        currentStep,
        extractionData,
        costEstimate,
        chunkData,
        availableChunks,
        selectedChunks: Array.from(selectedChunks),
        maxChunks,
        currentProcessedChunks,
        progress,
        logs: logs.slice(-50), // Only keep last 50 logs to reduce storage size
        currentJobId,
        analysisStartTime,
        emailModeStartTime,
        sessionId,
        conversationUrl,
        selectedChunksEstimatedTime
      };
      localStorage.setItem('ucp_process_session', JSON.stringify(session));
    }, 1000); // Debounce by 1 second to reduce frequency

    return () => clearTimeout(timeoutId);
  }, [currentStep, currentJobId, progress, analysisStartTime, selectedChunksEstimatedTime]); // Save when analysis state changes

  // Update time-based progress every second during analysis
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    if (currentStep === 'analyzing' && analysisStartTime && selectedChunksEstimatedTime > 0) {
      progressInterval = setInterval(() => {
        // Force re-render to update progress bar
        setForceUpdate(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [currentStep, analysisStartTime, selectedChunksEstimatedTime]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      // Cancel any ongoing payment limits request
      if (paymentLimitsRequestRef.current) {
        paymentLimitsRequestRef.current = null;
      }
    };
  }, [pollingInterval]);

  // Save session on page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const session = {
        currentStep,
        extractionData,
        costEstimate,
        chunkData,
        availableChunks,
        selectedChunks: Array.from(selectedChunks),
        progress,
        logs,
        currentJobId,
        analysisStartTime,
        emailModeStartTime,
        sessionId,
        conversationUrl,
        selectedChunksEstimatedTime,
        maxChunks,
        currentProcessedChunks
      };
      localStorage.setItem('ucp_process_session', JSON.stringify(session));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentStep, extractionData, costEstimate, chunkData, availableChunks, selectedChunks, progress, logs, currentJobId, analysisStartTime, emailModeStartTime, sessionId, conversationUrl, selectedChunksEstimatedTime, maxChunks, currentProcessedChunks]);

  // Utility function to format time estimates (rounds up)
  const formatAnalysisTime = (totalSeconds: number): string => {
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.ceil(totalSeconds / 60); // Round up to next minute
      return `${minutes}m`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const remainingSeconds = totalSeconds % 3600;
      const minutes = Math.ceil(remainingSeconds / 60); // Round up remaining minutes
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  // Handle automatic extraction after authentication
  useEffect(() => {
    if (user && pendingExtraction && file) {
      // User just authenticated and we have a pending extraction
      setPendingExtraction(false);
      setShowAuthModal(false);
      addLog('Authentication successful! Continuing with extraction...');

      // Automatically start extraction by calling the extraction logic directly
      performExtraction();
    }
  }, [user, pendingExtraction, file]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing polling when component unmounts
      if (extractionAbortControllerRef.current) {
        extractionAbortControllerRef.current.abort();
      }
      isExtractionPollingRef.current = false;
    };
  }, []);

  // Extracted function to perform the actual extraction logic
  const manualCreditVerification = async (stripeSessionId: string) => {
    try {
      addLog('Verifying payment with Stripe session...');

      // Try the new manual session processing endpoint first
      try {
        const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/process-stripe-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: stripeSessionId
          }),
        });

        if (response.ok) {
          const data = await response.json();
          addLog(`✅ ${data.message}`);

          // Refresh payment limits
          const limits = await checkPaymentLimits();
          setPaymentLimits(limits);
          setPaymentLimitsError(false);
          addLog(`Credit balance updated: ${limits.isUnlimited || limits.plan === 'unlimited' ? 'Unlimited access' : `${limits.credits_balance} credits available`}`);
          return; // Success, no need to do fallback checks
        } else {
          const errorData = await response.json();
          addLog(`⚠️ Session processing: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        addLog(`⚠️ Session processing failed: ${error}`);
      }

      // Fallback: Check payment limits multiple times in case webhook is delayed
      addLog('Checking payment status with fallback method...');
      let attempts = 0;
      const maxAttempts = 5;

      const checkWithDelay = async (delay: number) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;

        try {
          const limits = await checkPaymentLimits();
          setPaymentLimits(limits);
          setPaymentLimitsError(false);

          if (limits.credits_balance > 0 || attempts >= maxAttempts) {
            if (limits.credits_balance > 0) {
              addLog(`Payment processed! ${limits.isUnlimited || limits.plan === 'unlimited' ? 'Unlimited access activated' : `Credit balance: ${limits.credits_balance} credits available`}`);
            } else {
              addLog('Payment is still processing. Please refresh the page in a few minutes if credits don\'t appear.');
            }
            return;
          }

          // Try again with longer delay
          if (attempts < maxAttempts) {
            addLog(`Attempt ${attempts}/${maxAttempts}: Payment still processing...`);
            await checkWithDelay(delay * 1.5);
          }
        } catch (error) {
          console.error(`Payment check attempt ${attempts} failed:`, error);
          if (attempts >= maxAttempts) {
            addLog('Unable to verify payment. Please refresh the page or contact support if the issue persists.');
          }
        }
      };

      // Start with 5 second delay, then increase
      await checkWithDelay(5000);

    } catch (error) {
      addLog(`Payment verification error: ${error}`);
      console.error('Payment verification error:', error);
    }
  };


  const performExtraction = async () => {
    if (!file || !user) return;

    // Track extraction start
    analytics.extractionStart();

    setIsProcessing(true);
    setCurrentStep('extracting');
    addLog('Starting text extraction...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers: Record<string, string> = {};

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.extract, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // The extraction now happens in background, so we get a job_id and need to poll
      setJobId(data.job_id);
      setCurrentJobId(data.job_id);
      setCurrentStep('extracting');
      addLog(`Extraction started. Job ID: ${data.job_id}`);

      // Start polling for extraction completion
      startPollingExtractionStatus(data.job_id);
    } catch (error) {
      console.error('File extraction failed:', error);

      let errorMessage = 'File extraction failed';
      let showResetSuggestion = false;

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = 'Connection failed: Unable to reach the extraction server. Please check your internet connection and try again.';
        showResetSuggestion = true;
        addLog(`Network error during file extraction: ${error.message}`);
      } else if (error instanceof Error) {
        errorMessage = `Extraction failed: ${error.message}`;
        if (error.message.includes('HTTP') || error.message.includes('server')) {
          showResetSuggestion = true;
        }
      }

      addLog(errorMessage);

      if (showResetSuggestion) {
        showNotification(
          'warning',
          'Connection issue. Try using Reset to restart.'
        );
      } else {
        showNotification(
          'warning',
          'Upload failed. Please try again.'
        );
      }

      setCurrentStep('upload'); // Return to upload state so user can retry
    } finally {
      setIsProcessing(false);
    }
  };


  // Check payment limits when user authenticates - removed duplicate check

  // Helper function to create fetch with timeout
  const fetchWithTimeout = (url: string, options: RequestInit = {}, timeoutMs: number = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
      ...options,
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  };

  // Helper function to format time in minutes and seconds
  const formatElapsedTime = (startTime: number) => {
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Calculate time-based progress for analysis
  const getTimeBasedProgress = () => {
    if (!analysisStartTime || !selectedChunksEstimatedTime || currentStep !== 'analyzing') {
      return progress; // Fall back to chunk-based progress
    }

    const elapsedSeconds = Math.floor((Date.now() - analysisStartTime) / 1000);
    const timeProgress = Math.min(100, (elapsedSeconds / selectedChunksEstimatedTime) * 100);

    // Calculate chunk-based progress from processed chunks
    const chunkProgress = currentProcessedChunks > 0 && selectedChunks.size > 0
      ? Math.min(100, (currentProcessedChunks / selectedChunks.size) * 100)
      : progress;

    // Use chunk progress if available, otherwise blend time and chunk progress
    const finalProgress = currentProcessedChunks > 0
      ? chunkProgress
      : Math.max(progress, Math.round(timeProgress));

    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Progress Debug:', {
        analysisStartTime: new Date(analysisStartTime).toLocaleTimeString(),
        elapsedSeconds,
        selectedChunksEstimatedTime,
        timeProgress: Math.round(timeProgress),
        chunkProgress: Math.round(chunkProgress),
        currentProcessedChunks,
        selectedChunksSize: selectedChunks.size,
        progress,
        finalProgress: Math.round(finalProgress)
      });
    }

    return Math.round(finalProgress);
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Pack management functions
  const loadPacks = async () => {
    // If user is not authenticated, show sample packs
    if (!user) {
      const samplePacks = [
        {
          pack_id: 'sample-1',
          pack_name: 'Research Project',
          description: 'A collection of documents and conversations',
          total_sources: 5,
          total_tokens: 45000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          pack_id: 'sample-2',
          pack_name: 'Work Notes',
          description: 'Meeting notes and project documentation',
          total_sources: 3,
          total_tokens: 28000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setAvailablePacks(samplePacks);
      return;
    }

    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`);
      if (response.ok) {
        const data = await response.json();
        setAvailablePacks(data);
      }
    } catch (error) {
      console.error('Error loading packs:', error);
    }
  };

  const loadPackDetails = async (packId: string) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${packId}`);
      if (response.ok) {
        const data = await response.json();
        // Backend returns { pack: {...}, sources: [...] }
        const packData = data.pack || data;
        const sources = data.sources || [];
        setSelectedPack(packData);
        setPackSources(sources);
        addLog(`Loaded pack: ${packData.pack_name} with ${sources.length} source(s)`);
      }
    } catch (error) {
      console.error('Error loading pack details:', error);
    }
  };

  const createPack = async () => {

    if (!newPackName.trim()) {
      console.log('[DEBUG] Pack name is empty, aborting');
      return;
    }

    // Check if user is authenticated
    if (!user) {
      console.log('[DEBUG] User not authenticated');
      setShowAuthModal(true);
      addLog('Please sign in to create a pack');
      return;
    }

    setIsCreatingPack(true);
    try {
      console.log('[DEBUG] Sending request to:', `${API_BASE_URL}/api/v2/packs`);
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_name: newPackName,
          description: newPackDescription
        })
      });

      console.log('[DEBUG] Response received:', { ok: response.ok, status: response.status });

      if (response.ok) {
        const pack = await response.json();
        console.log('[DEBUG] Pack created successfully:', pack);

        // Load packs first to refresh the list
        await loadPacks();

        // Then set the newly created pack as selected
        setSelectedPack(pack);
        setCustomSystemPrompt(pack.custom_system_prompt || '');
        setShowCreatePack(false);
        setNewPackName('');
        setNewPackDescription('');
        setShowPackSelector(false);
        setCurrentStep('upload');
        setShowUploadOptions(true);
        addLog(`Created new pack: ${pack.pack_name}`);

        // Update URL with pack_id so navigation back works correctly
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('pack_id', pack.pack_id);
        window.history.replaceState({}, '', newUrl.toString());
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[ERROR] Failed to create pack:', { status: response.status, error: errorData });
        addLog(`Failed to create pack: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[ERROR] Exception creating pack:', error);
      addLog('Error creating pack');
    } finally {
      setIsCreatingPack(false);
    }
  };

  const selectPack = (pack: Pack) => {
    // Check if user is authenticated
    if (!user) {
      setShowAuthModal(true);
      addLog('Please sign in to access this pack');
      return;
    }

    setSelectedPack(pack);
    setShowPackSelector(false);
    addLog(`Selected pack: ${pack.pack_name}`);
  };

  const updatePackName = async () => {
    if (!selectedPack || !editedPackName.trim()) {
      setIsEditingPackName(false);
      return;
    }

    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_name: editedPackName.trim()
        })
      });

      if (response.ok) {
        const updatedData = await response.json();
        // Update selected pack with new data while preserving structure
        const updatedPack = {
          ...selectedPack,
          pack_name: updatedData.pack_name,
          description: updatedData.description,
          custom_system_prompt: updatedData.custom_system_prompt,
          total_sources: updatedData.total_sources,
          total_tokens: updatedData.total_tokens,
          updated_at: updatedData.updated_at
        };
        setSelectedPack(updatedPack);
        setEditedPackName('');
        addLog(`Pack renamed to: ${updatedData.pack_name}`);
        // Reload packs list to show updated name
        await loadPacks();
      }
    } catch (error) {
      console.error('Error updating pack name:', error);
      addLog('Error updating pack name');
    } finally {
      setIsEditingPackName(false);
    }
  };

  const saveCustomPrompt = async () => {
    if (!selectedPack) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsSavingCustomPrompt(true);
    setCustomPromptError(null);
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_system_prompt: customSystemPrompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save prompt');
      }

      const updatedData = await response.json();
      const updatedPack = {
        ...selectedPack,
        custom_system_prompt: updatedData.custom_system_prompt
      };
      setSelectedPack(updatedPack);
      setCustomPromptSavedAt(Date.now());
      addLog('Custom system prompt saved');
      // Refresh packs so list view stays in sync
      await loadPacks();
    } catch (error: any) {
      console.error('Error saving custom prompt:', error);
      setCustomPromptError(error.message || 'Failed to save prompt');
    } finally {
      setIsSavingCustomPrompt(false);
    }
  };

  const startSourceAnalysis = async (maxChunks?: number) => {
    if (!sourcePendingAnalysis) return;

    const sourceId = sourcePendingAnalysis.sourceId;
    const totalChunks = sourcePendingAnalysis.totalChunks;
    const allowedChunks = sourcePendingAnalysis.hasUnlimited
      ? totalChunks
      : Math.min(sourcePendingAnalysis.userCredits, totalChunks);

    if (!sourcePendingAnalysis.hasUnlimited && allowedChunks <= 0) {
      showNotification('warning', 'You need credits before analyzing this source');
      return;
    }

    const chunksToProcess = typeof maxChunks === 'number'
      ? Math.min(maxChunks, allowedChunks)
      : allowedChunks;

    if (chunksToProcess <= 0) {
      showNotification('warning', 'Unable to start analysis without available chunks');
      return;
    }

    const requestBody: { max_chunks?: number } = {};
    if (!sourcePendingAnalysis.hasUnlimited || chunksToProcess < totalChunks) {
      requestBody.max_chunks = chunksToProcess;
    }

    // Close modal immediately for instant feedback
    setSourcePendingAnalysis(null);
    setIsAnalysisStarting(sourceId);
    setAnalysisLimits((prev) => ({ ...prev, [sourceId]: chunksToProcess }));

    // Start analysis in background
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v2/sources/${sourceId}/start-analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            Object.keys(requestBody).length ? requestBody : {}
          )
        }
      );

      if (response.ok) {
        const data = await response.json();
        addLog(
          data.message ||
          `Starting analysis of ${chunksToProcess} chunk${chunksToProcess === 1 ? '' : 's'}...`
        );

        // Refresh pack sources in background (don't await)
        if (selectedPack) {
          makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}`)
            .then(packResponse => {
              if (packResponse.ok) {
                return packResponse.json();
              }
            })
            .then(packData => {
              if (packData) {
                const sources = packData.sources || [];
                setPackSources(sources);

                // Check if source is now analyzing
                const analyzingStatuses = ['analyzing', 'processing', 'analyzing_chunks'];
                const analyzingSource = sources.find((s: any) =>
                  s.source_id === sourceId && analyzingStatuses.includes(s.status?.toLowerCase())
                );
                if (analyzingSource) {
                  setIsAnalysisStarting(null);
                }
              }
            })
            .catch(error => {
              console.error('Error refreshing pack sources:', error);
            });
        }
      } else if (response.status === 402) {
        // Insufficient credits - reopen modal
        const data = await response.json();
        showNotification('warning', `Insufficient credits: ${data.detail}`);
        setIsAnalysisStarting(null);
      } else {
        throw new Error('Failed to start analysis');
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      showNotification('warning', 'Failed to start analysis');
      setIsAnalysisStarting(null);
    }
  };

  const handleBuyCredits = () => {
    // Close the modal and show the upgrade modal/payment flow
    setSourcePendingAnalysis(null);
    // send user to /prices page
    router.push('/pricing');
  };

  const handleCancelAnalysis = async () => {
    if (!sourcePendingAnalysis || !selectedPack || isCancellingSource) return;

    const sourceId = sourcePendingAnalysis.sourceId;

    // Prevent multiple clicks
    setIsCancellingSource(true);

    // Close the modal immediately for better UX
    setSourcePendingAnalysis(null);

    // Immediately remove from local state to prevent modal from reopening
    setPackSources(prev => prev.filter((s: any) => s.source_id !== sourceId));

    try {
      // Delete the source from the backend (removes from pack)
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources/${sourceId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        showNotification('info', 'Source removed from pack');

        // Refresh from server to ensure consistency
        const packResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}`);
        if (packResponse.ok) {
          const packData = await packResponse.json();
          setPackSources(packData.sources || []);
        }
      } else {
        // Rollback optimistic update on error
        const packResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}`);
        if (packResponse.ok) {
          const packData = await packResponse.json();
          setPackSources(packData.sources || []);
        }
        throw new Error('Failed to remove source');
      }
    } catch (error) {
      console.error('Error removing source:', error);
      showNotification('warning', 'Failed to remove source. Please try again.');
    } finally {
      setIsCancellingSource(false);
    }
  };

  const checkPaymentLimits = async () => {
    // If there's already a request in progress, wait for it
    if (paymentLimitsRequestRef.current) {
      try {
        return await paymentLimitsRequestRef.current;
      } catch (error) {
      }
    }

    // Debounce: Don't check if we checked within the last 10 seconds, unless we don't have limits yet
    const now = Date.now()
    if (now - lastPaymentCheck < 10000 && paymentLimits) {
      return paymentLimits || { canProcess: false, credits_balance: 0 };
    }

    // Create the request promise and store it
    const requestPromise = (async () => {
      try {
        setLastPaymentCheck(now)

        const response = await makeAuthenticatedRequest(
          API_ENDPOINTS.userProfile,
          {
            method: 'GET'
          }
        );

        if (response.ok) {
          const data = await response.json();
          const isUnlimited = data.payment_plan === 'unlimited';
          const canProcess = isUnlimited || data.credits_balance > 0;
          const result = {
            canProcess,
            credits_balance: data.credits_balance || 0,
            plan: data.payment_plan || 'credits',
            isUnlimited
          };
          return result;
        } else {
          console.error('Failed to fetch payment limits:', response.status, response.statusText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('Payment limits request timed out after 10 seconds');
          throw new Error('Request timed out - please check your connection');
        } else {
          console.error('Error checking credit balance:', error);
          throw error;
        }
      } finally {
        // Clear the request reference when done
        paymentLimitsRequestRef.current = null;
      }
    })();

    // Store the request promise
    paymentLimitsRequestRef.current = requestPromise;

    return requestPromise;
  };

  // Server-Sent Events helper function
  const startSSEWithAuth = async (url: string, headers: Record<string, string>) => {
    try {
      // Use fetch to establish the SSE connection with timeout
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...headers
          }
        },
        30000 // 15 second timeout for SSE connection
      );

      if (!response.ok) {
        if (response.status === 403) {
          console.error('Authentication failed for SSE connection - token may be expired');
          addLog('Warning: Authentication error for real-time updates. You may need to refresh the page.');
        }
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available for SSE stream');
      }

      // Read the stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            // Convert bytes to text
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix

                  if (data.type === 'complete') {
                    return;
                  } else if (data.type === 'error') {
                    addLog(`Error: ${data.message}`);
                    return;
                  } else {
                    // Regular progress update
                    const timestamp = new Date().toLocaleTimeString();
                    let message = data.message;

                    // Format message with chunk info if available
                    if (data.current_chunk && data.total_chunks) {
                      message = `Chunk ${data.current_chunk}/${data.total_chunks}: ${data.message}`;
                    }

                    // Add to logs (avoid duplicates)
                    setLogs(prev => {
                      const messageExists = prev.some(log => log.includes(data.message));
                      if (!messageExists) {
                        return [...prev, `[${timestamp}] ${message}`];
                      }
                      return prev;
                    });

                    // Update progress percentage
                    if (data.progress !== undefined) {
                      setProgress(data.progress);
                    }

                    // Track current processed chunks
                    if (data.current_chunk !== undefined) {
                      setCurrentProcessedChunks(data.current_chunk);
                    }
                  }
                } catch (parseError) {
                  // Silently ignore parse errors
                }
              }
            }
          }
        } catch (streamError) {
          addLog('Real-time connection lost');
        }
      };

      // Start processing the stream
      processStream();

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        addLog('Real-time connection timed out, using standard updates');
      } else if (error instanceof Error && error.message.includes('timed out')) {
        addLog('Real-time connection timeout, using standard updates');
      } else {
      }
    }
  };

  const startPollingAnalysisStatus = (jobId: string) => {
    // Clear any existing polling first
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    let consecutiveFailures = 0;
    const maxFailures = 5; // Increased from 3 to handle more server issues
    const startTime = Date.now();
    const maxPollingDuration = 30 * 60 * 1000; // 30 minutes max

    // Set up the status polling with exponential backoff and server warming
    const poll = async () => {
      // Check if we've been polling too long
      if (Date.now() - startTime > maxPollingDuration) {
        addLog('⚠️ Status polling timed out. Please refresh the page to check status.');
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        return;
      }

      try {
        // If we've had failures, try a health check first to warm the server
        if (consecutiveFailures > 0) {
          setConnectionStatus('connecting');
          try {
            // Use longer timeout during analysis periods to account for server load
            const healthTimeout = currentStep === 'analyzing' ? 85000 : 20000; // 85s during analysis, 20s otherwise

            const healthResponse = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/health`,
              {
                method: 'GET',
                signal: AbortSignal.timeout(healthTimeout)
              }
            );

            if (healthResponse.ok) {
              const healthData = await healthResponse.json();
              console.log('Server warmed up, health status:', healthData.status);
              addLog(`🔄 Server reconnected (attempt ${consecutiveFailures + 1})`);
            }
          } catch (healthError) {
            console.warn('Health check failed during retry:', healthError);
          }
        }

        const statusResponse = await makeAuthenticatedRequest(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/status/${jobId}`,
          {
            method: 'GET'
          }
        );

        if (!statusResponse.ok) {
          consecutiveFailures++;
          setConnectionStatus('warning');

          // Add different retry delays based on failure count
          const retryDelay = Math.min(2000 * Math.pow(2, consecutiveFailures - 1), 30000); // Exponential backoff, max 30s

          if (statusResponse.status === 403) {
            console.error('Authentication failed for status check - token may be expired');
            addLog('Warning: Authentication error checking status. You may need to refresh the page.');
          } else if (statusResponse.status === 408) {
            console.error('Request timeout - server may be stalled');
            addLog(`⚠️ Server timeout detected (attempt ${consecutiveFailures}). Retrying in ${retryDelay / 1000}s...`);
          } else {
            console.error('Status check failed:', statusResponse.status, statusResponse.statusText);
            addLog(`⚠️ Status check failed (attempt ${consecutiveFailures}). Retrying in ${retryDelay / 1000}s...`);
          }

          // Stop polling after too many failures
          if (consecutiveFailures >= maxFailures) {
            setConnectionStatus('disconnected');
            addLog('❌ Too many failed attempts. Server may be down. Please try refreshing the page.');
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            return;
          }

          // Schedule retry with exponential backoff
          setTimeout(poll, retryDelay);
          return;
        }

        // Reset failure count on success
        if (consecutiveFailures > 0) {
          addLog('✅ Server connection restored');
          consecutiveFailures = 0;
        }
        setConnectionStatus('connected');

        const data = await statusResponse.json();

        // Update progress if available from status
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }

        // Update processed chunks if available
        if (data.processed_chunks !== undefined) {
          setCurrentProcessedChunks(data.processed_chunks);
        }

        if (data.status === 'completed') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          setIsProcessing(false);
          setCurrentStep('analyzed');

          // Reload pack details to get updated info
          if (selectedPack) {
            loadPackDetails(selectedPack.pack_id);
          }
        } else if (data.status === 'partial') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          setIsProcessing(false);
          setCurrentStep('analyzed');
          addLog(`✅ Analysis completed with ${data.processed_chunks}/${data.total_chunks} chunks`);
          addLog('Free tier limit reached. Upgrade to Pro for complete analysis.');

          if (data.upgrade_required) {
            showLimitWarning(data.processed_chunks, data.chunks_to_process || 2);
          }
        } else if (data.status === 'limit_reached') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          setIsProcessing(false);
          addLog('❌ Insufficient credits. Please purchase more credits to continue.');

          showNotification(
            'limit_reached',
            'Insufficient credits! Purchase more credits to analyze all chunks.'
          );
        } else if (data.status === 'failed') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          setIsProcessing(false);
          addLog(`❌ Analysis failed: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        consecutiveFailures++;
        if (error instanceof Error && error.message.includes('Authentication')) {
          console.error('Authentication failed during status polling - token may be expired');
          addLog('Warning: Authentication error checking status. You may need to refresh the page.');
          // Stop polling on auth errors
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          return;
        } else if (error instanceof Error && error.name === 'AbortError') {
        } else if (error instanceof Error && error.message.includes('timed out')) {
        } else {
          console.error('Status polling error:', error);
        }

        // Stop polling after too many failures
        if (consecutiveFailures >= maxFailures) {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          addLog('⚠️ Status polling stopped due to connection issues. Refresh page to resume.');
        }
      }
    };

    // Initial poll
    poll();

    // Set up interval with exponential backoff based on failures
    const getPollingInterval = () => {
      const baseInterval = 3000; // 3 seconds base for faster feedback
      return baseInterval * Math.min(Math.pow(1.5, consecutiveFailures), 8); // Max 24 seconds
    };

    const statusInterval = setInterval(poll, getPollingInterval());

    setPollingInterval(statusInterval);

    // Disable SSE for now - causing conflicts with polling
    // Set up Server-Sent Events for real-time progress
    /*
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/progress-stream/${jobId}`;
      
      // Start SSE with authentication
      startSSEWithAuth(url, headers);
      
    } catch (error) {
      // Silently fall back to status polling only
    }
    */
  };

  const startPollingExtractionStatus = (jobId: string) => {


    // Cancel any existing polling
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }

    // Create new abort controller for this polling session
    extractionAbortControllerRef.current = new AbortController();
    isExtractionPollingRef.current = true;


    // Poll for extraction completion with improved error handling
    let consecutiveFailures = 0;
    const maxFailures = 5;
    const startTime = Date.now();
    const maxPollingDuration = 10 * 60 * 1000; // 10 minutes max for extraction

    const poll = async () => {
      // Check if polling was cancelled
      if (extractionAbortControllerRef.current?.signal.aborted) {
        console.log('Extraction polling was cancelled');
        isExtractionPollingRef.current = false;
        return;
      }

      // Check if we've been polling too long
      if (Date.now() - startTime > maxPollingDuration) {
        addLog('⚠️ Extraction polling timed out. Please refresh the page to check status.');
        isExtractionPollingRef.current = false;
        return;
      }

      try {
        // If we've had failures, try a health check first to warm the server
        if (consecutiveFailures > 0) {
          setConnectionStatus('connecting');
          try {
            const healthResponse = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/health`,
              {
                method: 'GET',
                signal: AbortSignal.timeout(15000)
              }
            );

            if (healthResponse.ok) {
              console.log('Server warmed up for extraction check');
              addLog(`🔄 Server reconnected (attempt ${consecutiveFailures + 1})`);
            }
          } catch (healthError) {
            console.warn('Health check failed during extraction retry:', healthError);
            addLog(`⚠️ Server warming failed, retrying extraction check...`);
          }
        }

        // Check if extraction is complete by checking source status
        const resultsResponse = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v2/sources/${jobId}/status`, {
          method: 'GET',
          signal: extractionAbortControllerRef.current?.signal
        });

        if (!resultsResponse.ok) {
          consecutiveFailures++;
          setConnectionStatus('warning');

          const retryDelay = Math.min(3000 * Math.pow(2, consecutiveFailures - 1), 30000); // Start with 3s, max 30s

          if (resultsResponse.status === 408) {
            addLog(`⚠️ Server timeout during extraction check (attempt ${consecutiveFailures}). Retrying in ${retryDelay / 1000}s...`);
          } else {
            addLog(`⚠️ Extraction check failed (attempt ${consecutiveFailures}). Retrying in ${retryDelay / 1000}s...`);
          }

          if (consecutiveFailures >= maxFailures) {
            setConnectionStatus('disconnected');
            addLog('❌ Too many failed attempts checking extraction. Please refresh the page.');
            isExtractionPollingRef.current = false;
            return;
          }

          // Schedule retry with exponential backoff
          setTimeout(() => {
            if (!extractionAbortControllerRef.current?.signal.aborted) {
              poll();
            }
          }, retryDelay);
          return;
        }

        // Reset failure count and connection status on success
        if (consecutiveFailures > 0) {
          addLog('✅ Server connection restored');
          consecutiveFailures = 0;
        }
        setConnectionStatus('connected');

        const resultsData = await resultsResponse.json();

        // Check if source failed
        if (resultsData.status === 'failed') {
          isExtractionPollingRef.current = false;
          setIsProcessing(false);
          setCurrentStep('upload');
          addLog(`❌ Processing failed: ${resultsData.error_message || 'Unknown error occurred'}`);
          return;
        }

        // Update progress and show detailed status
        const progress = resultsData.progress || 0;
        setProgress(progress);

        // Show chunking progress with actual numbers
        if (resultsData.status === 'processing' && resultsData.total_chunks) {
          const lastChunkLog = logs[logs.length - 1];
          const currentProgressMsg = `✂️ Chunking: ${resultsData.total_chunks} chunks created (${progress}% complete)`;

          // Only add if it's different from last message
          if (!lastChunkLog || !lastChunkLog.includes('Chunking:') || !lastChunkLog.includes(`${resultsData.total_chunks} chunks`)) {
            addLog(currentProgressMsg);
          }
        } else if (progress < 30) {
          if (!logs.some(log => log.includes('Extracting text'))) {
            addLog(`📝 Extracting text from ${file?.name || 'source'}...`);
          }
        }

        // Check if ready for analysis (chunking completed)
        if (resultsData.status === 'ready_for_analysis') {
          isExtractionPollingRef.current = false;
          setIsProcessing(false);
          setCurrentStep('upload');
          setUploadMethod(null); // Ensure upload UI hides and analysis modal shows

          // Show success notification for chunking completion

          // Fetch credit check directly and show modal
          try {
            const creditCheck = await makeAuthenticatedRequest(
              `${API_BASE_URL}/api/v2/sources/${jobId}/credit-check`
            );
            if (creditCheck.ok) {
              const creditData = await creditCheck.json();
              setSourcePendingAnalysis(creditData);

              // Also refresh pack sources to ensure UI is in sync
              if (selectedPack) {
                const packResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}`);
                if (packResponse.ok) {
                  const packData = await packResponse.json();
                  setPackSources(packData.sources || []);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching credit check:', error);
          }

          return;
        }

        // Check if completed
        if (resultsData.status === 'completed' && progress >= 100) {
          isExtractionPollingRef.current = false;
          setIsProcessing(false);
          setCurrentStep('upload'); // Reset to upload state to allow adding more sources

          // Show success notification for analysis completion
          showNotification('upgrade_success', `🎉 Analysis complete! ${resultsData.total_chunks || 0} chunks analyzed`);
          addLog(`✅ Processing complete! ${resultsData.total_chunks || 0} chunks analyzed`);
          addLog(`💰 Cost: $${(resultsData.total_input_tokens * 0.00015 / 1000 + resultsData.total_output_tokens * 0.0006 / 1000).toFixed(4)}`);

          // Clear the file input to allow uploading another source
          setFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          // Reload pack to show updated source with visual feedback
          if (selectedPack) {
            loadPackDetails(selectedPack.pack_id);
            // Show visual notification
            setShowPackUpdateNotification(true);
            setTimeout(() => {
              setShowPackUpdateNotification(false);
            }, 3000);
          }
          return;
        }

        // Still processing, schedule next poll
        setTimeout(() => {
          if (!extractionAbortControllerRef.current?.signal.aborted) {
            poll();
          }
        }, 5000); // 5 second interval for normal polling

      } catch (error) {
        // Check if error is due to cancellation
        if (extractionAbortControllerRef.current?.signal.aborted) {
          console.log('Extraction polling request was cancelled');
          isExtractionPollingRef.current = false;
          return;
        }

        consecutiveFailures++;
        setConnectionStatus('warning');

        // Handle authentication errors more gracefully
        if (error instanceof Error && error.message.includes('Authentication')) {
          addLog('Warning: Authentication error during extraction status check. You may need to refresh the page.');
          isExtractionPollingRef.current = false;
          return; // Stop polling on auth errors
        }

        console.error('Error checking extraction status:', error);

        const retryDelay = Math.min(3000 * Math.pow(2, consecutiveFailures - 1), 30000);
        addLog(`⚠️ Error checking extraction status (attempt ${consecutiveFailures}). Retrying in ${retryDelay / 1000}s...`);

        if (consecutiveFailures >= maxFailures) {
          setConnectionStatus('disconnected');
          addLog('❌ Too many failed attempts. Please refresh the page.');
          isExtractionPollingRef.current = false;
          return;
        }

        setTimeout(() => {
          if (!extractionAbortControllerRef.current?.signal.aborted) {
            poll();
          }
        }, retryDelay);
      }
    };

    // Start the polling
    poll();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check if pack is selected
      if (!selectedPack) {
        addLog('Error: Please select or create a pack first');
        showNotification('warning', 'Please select a pack before uploading files');
        return;
      }

      // Validate file type based on upload method
      const fileName = selectedFile.name.toLowerCase();

      if (uploadMethod === 'chat_export') {
        // Allow conversations.json or .zip files for chat export
        if (fileName !== 'conversations.json') {
          showNotification('warning', 'Please upload a conversations.json file from ChatGPT');
          if (event.target) event.target.value = '';
          return;
        }
      } else if (uploadMethod === 'document') {
        // Allow pdf, txt, md, html for documents
        if (!fileName.endsWith('.pdf') && !fileName.endsWith('.txt') && !fileName.endsWith('.md') && !fileName.endsWith('.html') && !fileName.endsWith('.htm')) {
          showNotification('warning', 'Please upload a PDF, TXT, HTML, or MD file');
          if (event.target) event.target.value = '';
          return;
        }
      }

      await processSelectedFile(selectedFile);
      // Reset the file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Look for conversations.json file in the uploaded folder
      const conversationsFile = Array.from(files).find(file =>
        file.name === 'conversations.json' || file.webkitRelativePath.endsWith('/conversations.json')
      );

      if (conversationsFile) {
        addLog(`Found conversations.json in ChatGPT export folder`);
        await processSelectedFile(conversationsFile);
      } else {
        addLog('Error: No conversations.json file found in the uploaded folder. Please make sure you\'re uploading a ChatGPT data export folder.');
        alert('No conversations.json found in folder. Upload exported AI folder');
      }

      // Reset the file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };


  const processSelectedFile = async (selectedFile: File) => {
    if (!selectedPack || !user) {
      addLog('Error: Pack not selected or user not authenticated');
      return;
    }

    setFile(selectedFile);
    setConversationUrl('');
    setIsProcessing(true);
    setCurrentStep('extracting');
    addLog(`Uploading source to pack: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`);

    // Track file upload
    analytics.fileUpload(selectedFile.size);

    try {
      // Upload source directly to pack via v2 API
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('source_name', selectedFile.name);
      formData.append('source_type', selectedFile.name.includes('conversation') ? 'chat_export' : 'document');

      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      const sourceId = data.source_id || data.job_id;

      setJobId(sourceId);
      setCurrentJobId(sourceId);
      addLog(`Source uploaded successfully: ${sourceId}`);
      addLog('🔄 Extraction and chunking started...');

      // Clear file state since it's now in packSources
      setFile(null);

      // Start polling for extraction/chunking completion
      startPollingExtractionStatus(sourceId);

    } catch (error) {
      console.error('Source upload failed:', error);
      addLog(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      showNotification('warning', 'Upload failed. Please try again.');
      setCurrentStep('upload');
      setIsProcessing(false);
    }
  };

  const validateConversationUrl = (url: string): { isValid: boolean; error?: string; platform?: string } => {
    if (!url.trim()) {
      return { isValid: false, error: "URL is required" };
    }

    // Only accept ChatGPT URLs for now
    if (!url.includes('chatgpt.com/share/')) {
      return { isValid: false, error: "Only ChatGPT shared conversation links are supported at this time" };
    }

    try {
      const urlObj = new URL(url);
      const conversationId = urlObj.pathname.split('/').pop();
      if (!conversationId || conversationId.length < 10) {
        return { isValid: false, error: "Invalid ChatGPT conversation ID in URL" };
      }
      return { isValid: true, platform: 'ChatGPT' };
    } catch {
      return { isValid: false, error: "Invalid ChatGPT URL format" };
    }
  };

  const processConversationUrl = async (url: string) => {
    if (!selectedPack || !user) {
      addLog('Error: Please select or create a pack first');
      showNotification('warning', 'Please select a pack before adding sources');
      return;
    }

    const validation = validateConversationUrl(url);
    if (!validation.isValid) {
      setUrlError(validation.error || 'Invalid URL format');
      return;
    }

    // Clear any previous errors
    setUrlError(null);

    setFile(null);
    setConversationUrl(url);
    setIsProcessing(true);
    setCurrentStep('extracting');
    addLog(`${validation.platform} URL ready: ${url}`);

    // Track URL input
    analytics.fileUpload(0); // Size 0 for URL

    try {
      // Upload source directly to pack via v2 API
      const formData = new FormData();
      // Append empty file blob to satisfy FastAPI's multipart form validation
      formData.append('file', new Blob([]), '');
      formData.append('url', url);
      formData.append('source_name', `Conversation from ${validation.platform}`);
      formData.append('source_type', 'chat_export');

      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      const sourceId = data.source_id

      setJobId(sourceId);
      setCurrentJobId(sourceId);
      addLog('Extraction and chunking started...');
      setConversationUrl('');
      startPollingExtractionStatus(sourceId);

    } catch (error) {
      console.error('URL extraction failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Upload failed: ${errorMessage}`);
      setUrlError(errorMessage);
      showNotification('warning', 'URL extraction failed. Please try again.');
      setCurrentStep('upload');
      setIsProcessing(false);
    }
  };

  const processPastedText = async (text: string) => {
    if (!selectedPack || !user) {
      addLog('Error: Please select or create a pack first');
      showNotification('warning', 'Please select a pack before adding sources');
      return;
    }

    if (!text.trim()) {
      setTextError('Please enter some text');
      return;
    }

    // Clear any previous errors
    setTextError(null);

    setFile(null);
    setPastedText(text);
    setIsProcessing(true);
    setCurrentStep('extracting');
    addLog(`Processing pasted text (${text.length} chars)`);

    // Track text input
    analytics.fileUpload(text.length);

    try {
      // Upload source directly to pack via v2 API
      const formData = new FormData();
      // Append empty file blob to satisfy FastAPI's multipart form validation
      formData.append('file', new Blob([]), '');
      formData.append('text_content', text);
      formData.append('source_name', `Pasted Text (${new Date().toLocaleTimeString()})`);
      formData.append('source_type', 'text');

      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      const sourceId = data.source_id

      setJobId(sourceId);
      setCurrentJobId(sourceId);
      addLog('Text processing started...');
      setPastedText('');
      startPollingExtractionStatus(sourceId);

    } catch (error) {
      console.error('Text processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Processing failed: ${errorMessage}`);
      setTextError(errorMessage);
      showNotification('warning', 'Text processing failed. Please try again.');
      setCurrentStep('upload');
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedItems = e.dataTransfer.items;
    const droppedFiles = Array.from(e.dataTransfer.files);

    console.log('Dropped items:', droppedItems.length, 'Dropped files:', droppedFiles.length);

    // Check if we're dropping a folder (DataTransferItem with kind 'file' and webkitGetAsEntry)
    if (droppedItems && droppedItems.length > 0) {
      const firstItem = droppedItems[0];
      if (firstItem.webkitGetAsEntry) {
        const entry = firstItem.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          addLog('Folder detected via drag and drop. Please use the "Choose Export Folder" button for folder uploads.');
          alert('Folder upload detected!\n\nFor folder uploads, please use the "Choose Export Folder" button below for the best experience.');
          return;
        }
      }
    }

    // First, check if there's a conversations.json file among the dropped files
    const conversationsFile = droppedFiles.find(file =>
      file.name === 'conversations.json' || file.webkitRelativePath?.endsWith('/conversations.json')
    );

    if (conversationsFile) {
      addLog(`Found conversations.json in dropped files`);
      processSelectedFile(conversationsFile);
      return;
    }

    // If multiple files were dropped (likely from a folder), search through them for conversations.json
    if (droppedFiles.length > 1) {
      addLog('Multiple files detected - searching for conversations.json...');
      const foundConversationsFile = droppedFiles.find(file =>
        file.name.toLowerCase() === 'conversations.json' ||
        file.webkitRelativePath?.toLowerCase().includes('conversations.json')
      );

      if (foundConversationsFile) {
        addLog(`Found conversations.json in export folder!`);
        processSelectedFile(foundConversationsFile);
        return;
      } else {
        addLog('No conversations.json file found in the dropped files.');
        alert('No conversations.json file found in the dropped files.\n\nFor ChatGPT export folders, please use the "Choose Export Folder" button, or make sure your export contains a conversations.json file.');
        return;
      }
    }

    // Otherwise, look for any valid individual file
    const validFile = droppedFiles.find(file =>
      ['.json', '.txt', '.csv', '.zip', '.html', '.htm'].some(ext =>
        file.name.toLowerCase().endsWith(ext)
      )
    );

    if (validFile) {
      processSelectedFile(validFile);
    } else {
      addLog('Please drop a valid file: conversations.json, .json, .txt, .csv, .zip, or .html');
      alert('Invalid file type!\n\nSupported formats:\n• conversations.json (ChatGPT export)\n• .txt, .html, .csv (text documents)\n• .zip archives\n\nFor ChatGPT export folders, use the "Choose Export Folder" button.');
    }
  };




  const handleCancel = async () => {
    if (!currentJobId || isCancelling) return;

    setIsCancelling(true);
    addLog('🚫 Requesting job cancellation...');

    try {
      // Stop any active polling immediately
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
        addLog('⏹️ Stopped status polling');
      }

      // Close any active EventSource connections
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        addLog('🔌 Closed real-time connection');
      }

      // Abort any ongoing extraction requests
      if (extractionAbortControllerRef.current) {
        extractionAbortControllerRef.current.abort();
        extractionAbortControllerRef.current = null;
        addLog('🛑 Aborted extraction requests');
      }

      // Send cancellation request to backend
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cancel/${currentJobId}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        addLog('✅ Cancellation request sent successfully');
        addLog('⏱️ Stopping OpenAI requests and analysis...');

        // Reset state immediately for better UX
        setIsProcessing(false);
        setProgress(0);
        setAnalysisStartTime(null);

        // Handle chunk removal for partial processing
        if (currentProcessedChunks >= 10) {
          const chunksToRemove = currentProcessedChunks;
          const remainingChunks = availableChunks.slice(chunksToRemove);
          setAvailableChunks(remainingChunks);

          // Clear selected chunks since the indices have changed
          setSelectedChunks(new Set());

          addLog(`💳 Removed ${chunksToRemove} processed chunks. ${remainingChunks.length} chunks remaining.`);
          addLog(`📊 Credits deducted for ${chunksToRemove} completed chunks`);
          showNotification('warning', `Job cancelled. ${chunksToRemove} chunks were processed and charged.`);

          // Return to chunked state so user can reselect
          setCurrentStep('chunked');
        } else {
          addLog('🆓 Job cancelled before significant processing - no charges applied');
          showNotification('info', 'Job cancelled successfully. No charges applied.');

          // Return to chunked state for reselection
          setCurrentStep('chunked');
        }

        // Reset processed chunks counter
        setCurrentProcessedChunks(0);
        setIsCancelling(false);

        addLog('🔄 Ready to start a new analysis');
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }
    } catch (error) {
      console.error('Cancel failed:', error);
      addLog(`❌ Cancel request failed: ${error}`);
      setIsCancelling(false);
      showNotification('warning', 'Failed to cancel job. It may still be running on the server.');

      // Even if cancel request fails, stop local polling and reset UI
      setIsProcessing(false);
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  };

  const handleReset = async () => {
    // Cancel any ongoing AI processing first
    if (currentJobId && !isCancelling) {
      await handleCancel();
    }

    // Stop any polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // Reset all state
    if (conversationUrl) {
      setConversationUrl('');
    } else {
      setFile(null);
    }
    setCurrentStep('upload');
    setTimeEstimate(null);
    setCostEstimate(null);
    setIsProcessing(false);
    setProgress(0);
    setAnalysisStartTime(null);
    setCurrentJobId(null);
    setCurrentProcessedChunks(0);
    setAnalysisLimits({});

    addLog('Reset complete - all processing cancelled');
  };

  const handleChunkToggle = (index: number) => {
    setSelectedChunks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedChunks.size === availableChunks.length) {
      setSelectedChunks(new Set());
    } else {
      setSelectedChunks(new Set(availableChunks.map((_, index) => index)));
    }
  };

  const downloadPack = async (type: 'complete' | 'ultra-compact' | 'standard') => {
    // Use selectedPack.pack_id if available, otherwise fall back to currentJobId
    const packId = selectedPack?.pack_id || currentJobId;
    if (!packId || isDownloading) return;

    setIsDownloading(true);

    // Track download
    analytics.downloadPack();

    try {
      addLog(`Starting ${type} pack download...`);

      // Use authenticated fetch to download with proper headers
      // Use V2 endpoint for all downloads
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v2/packs/${packId}/export/${type}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_ucp_${selectedPack?.pack_name || packId}.txt`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      addLog('Pack download completed successfully');
    } catch (error) {
      addLog(`Pack download failed: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };


  const cancelAnalysis = async () => {
    try {
      // Find analyzing source
      const analyzingSource = packSources.find((s: any) =>
        ['analyzing', 'processing', 'analyzing_chunks'].includes(s.status?.toLowerCase())
      );

      if (analyzingSource) {
        const response = await makeAuthenticatedRequest(
          `${API_BASE_URL}/api/v2/sources/${analyzingSource.source_id}/cancel`,
          { method: 'POST' }
        );

        if (response.ok) {
          addLog('Analysis Cancelling');
          showNotification('info', 'Analysis Cancelling');
          setAnalysisLimits((prev) => {
            if (!prev[analyzingSource.source_id]) return prev;
            const updated = { ...prev };
            delete updated[analyzingSource.source_id];
            return updated;
          });
          // Reload page using current browser location 
          router.replace(window.location.pathname + window.location.search);
        }
      }
    } catch (error) {
      console.error('Error cancelling analysis:', error);
      showNotification('warning', 'Failed to cancel analysis');
    }
  };

  const resetProcess = () => {
    // Cancel any ongoing polling
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
      extractionAbortControllerRef.current = null;
    }
    isExtractionPollingRef.current = false;

    setFile(null);
    setJobId(null);
    setCurrentJobId(null);
    setExtractionData(null);
    setCostEstimate(null);
    setChunkData(null);
    setAvailableChunks([]);
    setSelectedChunks(new Set());
    setIsProcessing(false);
    setCurrentStep('upload');
    setProgress(0);
    setSelectedChunksEstimatedTime(0);
    setLogs([]);
    setAnalysisStartTime(null);
    setCurrentProcessedChunks(0);

    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // Clear localStorage session
    localStorage.removeItem('ucp_process_session');

    addLog('Process reset');
  };


  const handleUploadAreaClick = () => {
    setShouldHighlightOptions(true);
    setTimeout(() => setShouldHighlightOptions(false), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Payment Notification */}
      <PaymentNotification
        show={notification.show}
        type={notification.type}
        message={notification.message}
        onClose={hideNotification}
        onUpgrade={() => router.push('/pricing')}
        autoHide={false}
      />

      {/* Left Sidebar - Sources Panel (NotebookLM Style) */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Pack Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FolderOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
              {isEditingPackName && selectedPack ? (
                <input
                  type="text"
                  value={editedPackName}
                  onChange={(e) => setEditedPackName(e.target.value)}
                  onBlur={updatePackName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      updatePackName();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsEditingPackName(false);
                      setEditedPackName(selectedPack.pack_name);
                    }
                  }}
                  autoFocus
                  className="text-sm font-semibold bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 focus:border-gray-500 focus:outline-none flex-1 min-w-0"
                />
              ) : (
                <h2
                  className="text-sm font-semibold text-white cursor-pointer hover:text-gray-300 transition-colors truncate"
                  onClick={() => {
                    if (selectedPack) {
                      setEditedPackName(selectedPack.pack_name);
                      setIsEditingPackName(true);
                    }
                  }}
                  title="Click to edit"
                >
                  {selectedPack ? selectedPack.pack_name : 'No Pack Selected'}
                </h2>
              )}
            </div>
          </div>
          {selectedPack && selectedPack.description && (
            <p className="text-xs text-gray-500">{selectedPack.description}</p>
          )}

          {/* Pack Settings */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Pack Settings</span>
              {customPromptSavedAt && (
                <span className="text-[10px] text-green-400">
                  Saved {new Date(customPromptSavedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <textarea
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                placeholder={`Custom System Prompt (optional)\nExample: Focus only on business logic."`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 px-3 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                rows={4}
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={saveCustomPrompt}
                  disabled={isSavingCustomPrompt || !selectedPack}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingCustomPrompt ? 'Saving…' : 'Save'}
                </button>
              </div>
              {customPromptError && (
                <p className="text-[11px] text-red-400">{customPromptError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sources Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">SOURCES</h3>
            {selectedPack && (
              <span className="text-xs text-gray-500">{packSources.length || 0}</span>
            )}
          </div>
        </div>


        {/* Sources List */}
        <div className="flex-1 overflow-y-auto px-4">
          {!selectedPack ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">Select a pack to get started</p>
              <button
                onClick={() => setShowPackSelector(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Select Pack
              </button>
            </div>
          ) : packSources.length > 0 || file ? (
            <div className="space-y-2 mt-6">
              {/* Show existing pack sources */}
              {packSources.map((source: any) => (
                <div
                  key={source.source_id}
                  onClick={async () => {
                    if (source.status === 'ready_for_analysis') {
                      // Fetch credit check and open modal
                      try {
                        const creditResponse = await makeAuthenticatedRequest(
                          `${API_BASE_URL}/api/v2/sources/${source.source_id}/credit-check`
                        );
                        if (creditResponse.ok) {
                          const creditData = await creditResponse.json();
                          setSourcePendingAnalysis({
                            sourceId: creditData.sourceId || source.source_id,
                            totalChunks: creditData.totalChunks,
                            creditsRequired: creditData.creditsRequired,
                            userCredits: creditData.userCredits,
                            hasUnlimited: creditData.hasUnlimited,
                            canProceed: creditData.canProceed,
                            creditsNeeded: creditData.creditsNeeded || 0
                          });
                          setCurrentStep('upload');
                        }
                      } catch (error) {
                        console.error('Error fetching credit check:', error);
                      }
                    }
                  }}
                  className={`bg-gray-800 rounded-lg p-3 border border-gray-700 ${source.status === 'ready_for_analysis' ? 'cursor-pointer hover:bg-gray-750 hover:border-gray-600 transition-colors' : ''
                    }`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{source.source_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(source.status === 'extracting' || source.status === 'processing') && `Extracting and chunking... ${source.progress || 0}%`}
                        {source.status === 'ready_for_analysis' && `Ready (${source.total_chunks || 0} chunks) - Click to analyze`}
                        {source.status === 'analyzing' && (
                          source.processed_chunks && source.total_chunks
                            ? `Analyzing chunk ${source.processed_chunks}/${source.total_chunks}`
                            : `Analyzing... ${source.progress || 0}%`
                        )}
                        {source.status === 'processing' && (
                          source.processed_chunks && source.total_chunks
                            ? `Processing chunk ${source.processed_chunks}/${source.total_chunks}`
                            : `Processing... ${source.progress || 0}%`
                        )}
                        {source.status === 'building_tree' && `Building Memory Tree... ${source.progress || 95}%`}
                        {source.status === 'completed' && `Complete (${source.total_chunks || 0} chunks)`}
                        {source.status === 'failed' && 'Failed'}
                        {source.status === 'pending' && 'Pending'}
                      </p>
                    </div>
                    {(source.status === 'extracting' || source.status === 'processing' || source.status === 'analyzing') && (
                      <Loader className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                    )}
                    {source.status === 'building_tree' && (
                      <span className="text-lg animate-pulse flex-shrink-0">🌳</span>
                    )}
                    {source.status === 'ready_for_analysis' && (
                      <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                    {source.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                  {(source.status === 'extracting' || source.status === 'processing' || source.status === 'analyzing') && source.progress > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-700 rounded-full h-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${source.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Show currently uploading file */}
              {file && (
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {currentStep === 'extracting' && 'Extracting...'}
                        {currentStep === 'extracted' && 'Extracted'}
                        {currentStep === 'chunking' && 'Chunking...'}
                        {currentStep === 'chunked' && `${availableChunks.length} chunks`}
                        {currentStep === 'analyzing' && `Analyzing... ${progress}%`}
                        {currentStep === 'analyzed' && 'Complete'}
                      </p>
                    </div>
                    {currentStep === 'analyzing' && (
                      <Loader className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                    )}
                    {currentStep === 'analyzed' && (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                  {(currentStep === 'analyzing' || currentStep === 'chunking' || currentStep === 'extracting') && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-700 rounded-full h-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-xs text-gray-500">No sources added yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Middle Panel - Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Connection Status */}
          {isProcessing && (
            <div className="mb-4 flex items-center justify-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-green-500 animate-pulse' :
                  connectionStatus === 'warning' ? 'bg-orange-500 animate-pulse' :
                    'bg-red-500'
                }`}></div>
              <span className={`${connectionStatus === 'connected' ? 'text-green-400' :
                connectionStatus === 'connecting' ? 'text-green-400' :
                  connectionStatus === 'warning' ? 'text-orange-400' :
                    'text-red-400'
                }`}>
                {connectionStatus === 'connected' ? 'Connected' :
                  connectionStatus === 'connecting' ? 'Connecting' :
                    connectionStatus === 'warning' ? 'Connection issues' :
                      'Disconnected'}
              </span>
            </div>
          )}

          {/* Reset Button */}
          {currentStep !== 'upload' && (
            <div className="flex justify-end mb-4">
              <button
                onClick={resetProcess}
                className="text-sm text-gray-400 hover:text-white px-3 py-1 border border-gray-700 rounded hover:border-gray-600 hover:bg-gray-800 transition-colors"
              >
                Reset
              </button>
            </div>
          )}

          {/* Upload Options Modal */}
          {currentStep === 'upload' && (
            <div className="flex items-center justify-center h-full p-6">
              <div className="w-full max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">{uploadMethod === 'url' ? 'One Chat' : 'Add sources'}</h2>
                  <button
                    onClick={() => {
                      if (uploadMethod === 'url') {
                        setUploadMethod(null);
                        setConversationUrl('');
                        setUrlError(null);
                      } else if (uploadMethod === 'text') {
                        setUploadMethod(null);
                        setPastedText('');
                        setTextError(null);
                      } else {
                        setShowUploadOptions(false);
                      }
                    }}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Show analyzing indicator instead of upload area when analyzing */}
                {(() => {
                  const analyzingStatuses = ['analyzing', 'processing', 'analyzing_chunks'];
                  const hasAnalyzingSource = packSources.some((s: any) =>
                    analyzingStatuses.includes(s.status?.toLowerCase())
                  );
                  const isStarting = isAnalysisStarting !== null;
                  return hasAnalyzingSource || isStarting;
                })() ? (
                  /* Minimal Analyzing Indicator - Replaces Upload Area */
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                          <Loader className="h-5 w-5 text-gray-300 animate-spin" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-white">Analyzing</h3>
                          <p className="text-sm text-gray-400">
                            {(() => {
                              const activeSource = packSources.find((s: any) =>
                                ['analyzing', 'processing', 'analyzing_chunks'].includes(s.status?.toLowerCase())
                              );
                              const planned = activeSource
                                ? analysisLimits[activeSource.source_id] ?? activeSource.total_chunks
                                : null;
                              if (!planned) return 'We’re processing your content.';
                              const total = activeSource?.total_chunks ?? planned;
                              if (planned < total) {
                                return `Analyzing ${planned}/${total} chunks with your current credits.`;
                              }
                              if (planned >= 10) {
                                return 'Large job — we’ll email you when it’s finished.';
                              }
                              return 'We’re processing your content.';
                            })()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={cancelAnalysis}
                        className="text-sm text-gray-300 hover:text-white px-3 py-1 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Analysis Progress */}
                    {(() => {
                      const analyzingStatuses = ['analyzing', 'processing', 'analyzing_chunks'];
                      const analyzingSources = packSources.filter((s: any) =>
                        analyzingStatuses.includes(s.status?.toLowerCase())
                      );
                      if (isAnalysisStarting && analyzingSources.length === 0) {
                        const startingSource = packSources.find((s: any) => s.source_id === isAnalysisStarting);
                        const plannedChunks = analysisLimits[isAnalysisStarting] ?? startingSource?.total_chunks ?? 0;
                        const totalChunks = startingSource?.total_chunks ?? plannedChunks;
                        return (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-300">
                                {startingSource?.source_name || startingSource?.file_name || 'Preparing source'}
                              </span>
                              <span className="text-gray-400">
                                {totalChunks > 0 && plannedChunks < totalChunks
                                  ? `${plannedChunks}/${totalChunks} chunks`
                                  : `${plannedChunks} chunks`}
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-1.5">
                              <div className="bg-gray-500 h-1.5 rounded-full" style={{ width: '10%' }} />
                            </div>
                          </div>
                        );
                      }
                      return analyzingSources.map((source: any) => {
                        const totalChunks = source.total_chunks ?? 0;
                        const processedChunks = source.processed_chunks ?? 0;
                        const plannedChunks = analysisLimits[source.source_id];
                        // If we have a limit set, show that. Otherwise show total chunks.
                        const chunksToShow = plannedChunks ?? totalChunks;

                        // Show progress as "Analyzing chunk X/Y" if we have processed_chunks
                        let chunkLabel = '';
                        if (processedChunks > 0 && plannedChunks) {
                          // Show current progress out of planned chunks
                          chunkLabel = `Analyzing chunk ${processedChunks}/${plannedChunks}`;
                          if (plannedChunks < totalChunks) {
                            chunkLabel += ` (${totalChunks} total)`;
                          }
                        } else if (plannedChunks && plannedChunks < totalChunks) {
                          chunkLabel = `${plannedChunks}/${totalChunks} chunks`;
                        } else {
                          chunkLabel = `${chunksToShow} chunks`;
                        }

                        return (
                          <div key={source.source_id} className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-300 truncate pr-2">
                                {source.source_name || source.file_name || 'Analyzing...'}
                              </span>
                              <span className="text-gray-400 whitespace-nowrap">{source.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-gray-400 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${source.progress || 0}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500">{chunkLabel}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : uploadMethod === 'url' ? (
                  /* URL Input for One Chat */
                  <div className="bg-gray-900/80 border-2 border-gray-600 hover:border-gray-500 rounded-2xl p-10 text-center transition-all duration-300 hover:bg-gray-900/90">
                    <div className="w-20 h-20 rounded-xl bg-gray-700 flex items-center justify-center mx-auto mb-8">
                      <ExternalLink className="h-10 w-10 text-gray-300" />
                    </div>

                    <h3 className="text-xl font-medium text-white mb-4">Paste ChatGPT Conversation URL</h3>

                    <p className="text-gray-400 text-sm mb-10 max-w-md mx-auto leading-relaxed">
                      Ran out of space. Don't restart. Drop the link here, we'll pull the context and keep going.
                    </p>
                    <div className="space-y-6 max-w-md mx-auto">
                      {/* Error Alert */}
                      {urlError && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <X className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-red-400 font-medium text-sm mb-1">Invalid URL</h4>
                            <p className="text-red-300 text-xs">{urlError}</p>
                          </div>
                          <button
                            onClick={() => setUrlError(null)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <input type="url" value={conversationUrl} onChange={(e) => { setConversationUrl(e.target.value); if (urlError) setUrlError(null); }}
                        placeholder="https://chatgpt.com/share/..."
                        className={`w-full px-4 py-4 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${urlError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-gray-600 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                      />

                      <button
                        onClick={() => processConversationUrl(conversationUrl)}
                        disabled={!conversationUrl.trim()}
                        className="w-full bg-black-600 border-2 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none"
                      >
                        Start Extraction
                      </button>


                      <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-2">
                        <Lock className="h-3 w-3" />
                        We never store your data. Files are processed securely in your session.
                      </p>
                    </div>
                  </div>
                ) : uploadMethod === 'text' ? (
                  /* Paste Text Input */
                  <div className="bg-gray-900/80 border-2 border-gray-600 hover:border-gray-500 rounded-2xl p-10 text-center transition-all duration-300 hover:bg-gray-900/90">
                    <div className="w-20 h-20 rounded-xl bg-gray-700 flex items-center justify-center mx-auto mb-8">
                      <FileText className="h-10 w-10 text-gray-300" />
                    </div>

                    <h3 className="text-xl font-medium text-white mb-4">Paste Text Content</h3>

                    <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
                      Paste any text content directly here. We'll analyze it just like a file.
                    </p>
                    <div className="space-y-6 max-w-2xl mx-auto">
                      {/* Error Alert */}
                      {textError && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <X className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="text-red-400 font-medium text-sm mb-1">Invalid Input</h4>
                            <p className="text-red-300 text-xs">{textError}</p>
                          </div>
                          <button
                            onClick={() => setTextError(null)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <textarea
                        value={pastedText}
                        onChange={(e) => { setPastedText(e.target.value); if (textError) setTextError(null); }}
                        placeholder="Paste your text here..."
                        className={`w-full px-4 py-4 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all min-h-[200px] resize-y ${textError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-gray-600 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                      />

                      <button
                        onClick={() => processPastedText(pastedText)}
                        disabled={!pastedText.trim()}
                        className="w-full bg-black-600 border-2 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none"
                      >
                        Process Text
                      </button>

                      <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-2">
                        <Lock className="h-3 w-3" />
                        Content is processed securely in your session.
                      </p>
                    </div>
                  </div>
                ) : sourcePendingAnalysis ? (() => {
                  // Add safe defaults for all values
                  const totalChunks = sourcePendingAnalysis.totalChunks || 0;
                  const userCredits = sourcePendingAnalysis.userCredits || 0;
                  const hasUnlimited = sourcePendingAnalysis.hasUnlimited || false;
                  const creditsNeeded = sourcePendingAnalysis.creditsNeeded || 0;

                  const allowedChunks = hasUnlimited
                    ? totalChunks
                    : Math.min(userCredits, totalChunks);

                  return (
                    /* Credit Confirmation Card - Replaces Upload Area */
                    <div className="bg-gray-900/90 border-blue-500/50 rounded-2xl p-8 shadow-md mb-6">
                      <div className="flex items-center space-x-4 mb-6">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                          <Brain className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white">Ready to Analyze</h3>
                          <p className="text-gray-400">
                            {hasUnlimited
                              ? "You're all set—every chunk will be analyzed."
                              : allowedChunks < totalChunks
                                ? `We'll analyze ${allowedChunks}/${totalChunks} chunks with your current credits. Buy more anytime to process the rest.`
                                : "You're all set—every chunk will be analyzed."}
                          </p>
                        </div>
                      </div>

                      {/* Credit Stats */}
                      <div className="bg-gray-800/50 rounded-xl p-6 mb-6 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Total chunks:</span>
                          <span className="text-lg font-medium text-white">{totalChunks}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Your credits:</span>
                          <span className="text-lg font-medium text-white">
                            {hasUnlimited ? 'Unlimited' : userCredits}
                          </span>
                        </div>
                        {!hasUnlimited && creditsNeeded > 0 && (
                          <p className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                            Add {creditsNeeded} more credit{creditsNeeded === 1 ? '' : 's'} to unlock every chunk.
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {sourcePendingAnalysis.canProceed ? (
                        <div className="flex gap-3">
                          <button
                            onClick={handleCancelAnalysis}
                            disabled={isCancellingSource}
                            className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCancellingSource ? 'Cancelling...' : 'Cancel'}
                          </button>
                          <button
                            onClick={() => startSourceAnalysis(allowedChunks)}
                            className="flex-1 px-6 py-3 rounded-xl bg-gray-700 text-white text-sm font-medium hover:bg-gray-600 transition-colors"
                          >
                            Start Analysis ({allowedChunks} chunks)
                          </button>
                        </div>
                      ) : sourcePendingAnalysis.userCredits > 0 ? (
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <button
                              onClick={handleCancelAnalysis}
                              disabled={isCancellingSource}
                              className="flex-1 px-6 py-3 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isCancellingSource ? 'Cancelling...' : 'Cancel'}
                            </button>
                            <button
                              onClick={() => startSourceAnalysis(allowedChunks)}
                              className="flex-1 px-6 py-3 rounded-xl bg-gray-700 text-white text-sm font-medium hover:bg-gray-600 transition-colors"
                            >
                              Analyze {allowedChunks} Chunks
                            </button>
                          </div>
                          <button
                            onClick={handleBuyCredits}
                            className="w-full px-6 py-3 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 hover:border-gray-500 transition-colors"
                          >
                            Buy {sourcePendingAnalysis.creditsNeeded} More Credits
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-400">
                            You need {sourcePendingAnalysis.creditsNeeded} credits to analyze this file.
                          </p>
                          <div className="flex gap-3">
                            <button
                              onClick={handleCancelAnalysis}
                              disabled={isCancellingSource}
                              className="flex-1 px-6 py-3 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isCancellingSource ? 'Cancelling...' : 'Cancel'}
                            </button>
                            <button
                              onClick={handleBuyCredits}
                              className="flex-1 px-6 py-3 rounded-xl bg-gray-700 text-white text-sm font-medium hover:bg-gray-600 transition-colors"
                            >
                              Buy Credits
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  /* File Upload Area */
                  <>
                    <div
                      onClick={handleUploadAreaClick}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-12 mb-6 text-center transition-all ${isDragOver
                        ? 'border-blue-500 bg-blue-500/5'
                        : 'border-gray-700 bg-gray-900/50'
                        }`}
                    >
                      <div className="w-20 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Upload sources</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Choose an option to add sources to your pack for analysis. <br /> Large files will be processed and emailed when done.
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.txt,.csv,.zip,.html,.htm,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      {...({ webkitdirectory: 'true' } as any)}
                      multiple
                      onChange={handleFolderSelect}
                      className="hidden"
                    />

                    {/* Source Type Tabs */}
                    <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ${shouldHighlightOptions ? 'animate-shake ring-2 ring-blue-500/50 rounded-xl p-1' : ''}`}>
                      {/* Chat Exports */}
                      <button
                        onClick={() => {
                          if (!user) {
                            setShowAuthModal(true);
                            return;
                          }
                          setUploadMethod('chat_export');
                          // Update file input to accept conversations.json or zip
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = '.json,.zip';
                          }
                          fileInputRef.current?.click();
                        }}
                        className="group relative text-left h-full"
                      >
                        <div className="relative h-full p-6 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300">
                          <div className="mb-4">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:scale-105 group-hover:bg-white/[0.08] transition-all duration-300">
                              <MessageSquare className="h-6 w-6 text-gray-400 group-hover:text-gray-300 transition-colors duration-300" />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">All AI Chats</h3>
                          <p className="text-gray-400 text-sm leading-relaxed">
                            conversations.json
                          </p>
                          <p className="text-gray-500 text-xs mt-2">
                            <a
                              href="https://chatgpt.com/#settings/DataControls"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400/70 hover:text-blue-400 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              How to download →
                            </a>
                          </p>
                          <div className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12 group-hover:left-full transition-all duration-1000"></div>
                          </div>
                        </div>
                      </button>

                      {/* One Chat */}
                      <button
                        onClick={() => {
                          if (!user) {
                            setShowAuthModal(true);
                            return;
                          }
                          setUploadMethod('url');
                        }}
                        className="group relative text-left h-full"
                      >
                        <div className="relative h-full p-6 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300">
                          <div className="mb-4">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:scale-105 group-hover:bg-white/[0.08] transition-all duration-300">
                              <FileText className="h-6 w-6 text-gray-400 group-hover:text-gray-300 transition-colors duration-300" />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">One Chat</h3>
                          <p className="text-gray-400 text-sm leading-relaxed">Import single conversation URL</p>
                          <div className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12 group-hover:left-full transition-all duration-1000"></div>
                          </div>
                        </div>
                      </button>

                      {/* Document */}
                      <button
                        onClick={() => {
                          if (!user) {
                            setShowAuthModal(true);
                            return;
                          }
                          setUploadMethod('document');
                          // Update file input to accept documents including Google Docs exports
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = '.pdf,.txt,.md,.doc,.docx';
                          }
                          fileInputRef.current?.click();
                        }}
                        className="group relative text-left h-full"
                      >
                        <div className="relative h-full p-6 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300">
                          <div className="mb-4">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:scale-105 group-hover:bg-white/[0.08] transition-all duration-300">
                              <FileText className="h-6 w-6 text-gray-400 group-hover:text-gray-300 transition-colors duration-300" />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">Document</h3>
                          <p className="text-gray-400 text-sm leading-relaxed">PDF, TXT, HTML, CSV</p>
                          <div className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12 group-hover:left-full transition-all duration-1000"></div>
                          </div>
                        </div>
                      </button>

                      {/* Paste Text */}
                      <button
                        onClick={() => {
                          if (!user) {
                            setShowAuthModal(true);
                            return;
                          }
                          setUploadMethod('text');
                        }}
                        className="group relative text-left h-full"
                      >
                        <div className="relative h-full p-6 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300">
                          <div className="mb-4">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:scale-105 group-hover:bg-white/[0.08] transition-all duration-300">
                              <FileText className="h-6 w-6 text-gray-400 group-hover:text-gray-300 transition-colors duration-300" />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">Paste Text</h3>
                          <p className="text-gray-400 text-sm leading-relaxed">Direct text input</p>
                          <div className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12 group-hover:left-full transition-all duration-1000"></div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Processing Steps (extracting, chunking, analyzing, etc.) */}
          {currentStep !== 'upload' && (
            <div>
              {/* File or URL Selected */}
              {(file || conversationUrl) && currentStep === 'uploaded' && (
                <div className="max-w-6xl mx-auto">
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-9 shadow-xl">
                    {/* Success Header */}
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center shadow-lg">
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          {conversationUrl ? 'Conversation URL Loaded' : 'File Selected'}
                        </h3>
                        <p className="text-gray-400 text-sm">Ready for processing</p>
                      </div>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-400 rounded-xl p-6 mb-6">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          {conversationUrl ? (
                            <ExternalLink className="h-6 w-6 text-white" />
                          ) : (
                            <FileText className="h-6 w-6 text-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {conversationUrl ? (
                            <>
                              <h4 className="font-medium text-white mb-2">
                                {conversationUrl.includes('chatgpt.com') ? 'ChatGPT' : 'Claude'} Conversation
                              </h4>
                              <p className="text-sm text-gray-400 break-all bg-gray-800 px-3 py-2 rounded-lg font-mono">
                                {conversationUrl}
                              </p>
                            </>
                          ) : file ? (
                            <>
                              <h4 className="font-medium text-white mb-2">{file.name}</h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-400">
                                <span>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                <span>Type: {file.type || 'Unknown'}</span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Time Estimates */}
                      {timeEstimate && (
                        <div className="mt-6 pt-6 border-t border-gray-700">
                          <h5 className="text-sm font-medium text-gray-300 mb-3">Estimated Processing Time</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-800/50 px-4 py-3 rounded-lg">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400">Extraction</span>
                                <span className="text-sm font-medium text-white">{timeEstimate.time_estimates.extraction.formatted}</span>
                              </div>
                            </div>
                            {timeEstimate.time_estimates.analysis && (
                              <div className="bg-gray-800/50 px-4 py-3 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-400">Analysis</span>
                                  <span className="text-sm font-medium text-white">{timeEstimate.time_estimates.analysis.formatted}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Extracting Progress */}
              {currentStep === 'extracting' && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-xl">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                        <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">Extracting Content</h3>
                        <p className="text-gray-400">Extracting content and creating semantic chunks... (1-2 minutes)</p>
                      </div>
                    </div>

                    {/* Loading Skeleton */}
                    <div className="space-y-4">
                      <div className="bg-gray-700/20 border border-gray-600/50 rounded-xl p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          <span className="text-purple-300 font-medium">Processing conversation data</span>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-600 rounded skeleton"></div>
                          <div className="h-3 bg-gray-600 rounded w-3/4 skeleton"></div>
                          <div className="h-3 bg-gray-600 rounded w-1/2 skeleton"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Actions Panel */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pack Actions</h3>
        </div>

        <div className="flex-1 p-4 space-y-4">

          {/* Download Options */}
          {selectedPack && packSources.some((s: any) => s.status === 'completed' || s.status === 'building_tree') && (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FolderOpen className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-md text-white">{selectedPack.pack_name}</p>
                </div>
              </div>

              <button
                onClick={() => downloadPack('complete')}
                disabled={isDownloading}
                className={`w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden ${!isDownloading && packSources.some(s => s.status === 'completed' || s.status === 'building_tree')
                  ? 'after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-gradient-to-r after:from-transparent after:via-green-400 after:to-transparent after:animate-shimmer-slide'
                  : ''
                  }`}
              >
                {isDownloading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download Pack</span>
                  </>
                )}
              </button>

              {/* View Memory Tree Button */}
              {(() => {
                const isBuildingTree = packSources.some((s: any) => s.status === 'building_tree');
                const hasTree = packSources.some((s: any) => s.status === 'completed');

                return (
                  <button
                    onClick={() => !isBuildingTree && router.push(`/tree/${selectedPack.pack_id}`)}
                    disabled={isBuildingTree}
                    className={`w-full px-4 py-3 mt-2 ${isBuildingTree
                        ? 'bg-gray-600 cursor-wait'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                      } text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-75`}
                  >
                    {isBuildingTree ? (
                      <>
                        <span className="text-xl animate-pulse">🌳</span>
                        <span>Building Tree...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">🌳</span>
                        <span>View Memory Tree</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          )}


        </div>
      </div>

      {/* Pack Selector Modal */}
      {showPackSelector && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-[#0C0C0C] rounded-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col border border-white/10 shadow-2xl transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Select or Create Pack</h2>
                <p className="text-sm text-gray-400">Choose a workspace for your analysis</p>
              </div>
              <button
                onClick={() => setShowPackSelector(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Create New Pack Card */}
                <div
                  onClick={() => setShowCreatePack(true)}
                  className="bg-transparent border border-dashed border-white/10 rounded-lg p-6 cursor-pointer transition-all duration-200 hover:bg-white/[0.02] hover:border-white/20 flex flex-col items-center justify-center min-h-[160px] group"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center mb-4 group-hover:bg-white/10 transition-all duration-200">
                    <Plus className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-base font-medium text-gray-300 group-hover:text-white mb-1 transition-colors">Create New Pack</h3>
                  <p className="text-gray-500 text-sm text-center">
                    Start a new context pack
                  </p>
                </div>

                {/* Existing Packs */}
                {availablePacks.map(pack => (
                  <div
                    key={pack.pack_id}
                    onClick={() => selectPack(pack)}
                    className="bg-[#161616] border border-white/5 rounded-lg p-6 cursor-pointer transition-all duration-200 hover:border-white/10 hover:bg-[#1A1A1A] flex flex-col min-h-[160px] group"
                  >
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-base font-medium text-white group-hover:text-gray-200 transition-colors line-clamp-1">{pack.pack_name}</h3>
                        {pack.created_at && (
                          <span className="text-xs text-gray-600 font-mono">
                            {new Date(pack.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {pack.description && (
                        <p className="text-gray-500 text-sm mb-3 line-clamp-2">{pack.description}</p>
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-auto pt-4 border-t border-white/5">
                      <span className="flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {pack.total_sources} sources
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5" />
                        {(pack.total_tokens / 1000).toFixed(0)}k tokens
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Pack Modal */}
      {showCreatePack && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-[#0C0C0C] rounded-xl p-8 max-w-md w-full mx-4 border border-white/10 shadow-2xl transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Create New Pack</h2>
                <p className="text-sm text-gray-400">Organize your chats and documents</p>
              </div>
              <button
                onClick={() => setShowCreatePack(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pack Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  placeholder="e.g., Q4 Research Project"
                  className="w-full bg-[#161616] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description <span className="text-gray-500 text-xs font-normal ml-1">(Optional)</span>
                </label>
                <textarea
                  value={newPackDescription}
                  onChange={(e) => setNewPackDescription(e.target.value)}
                  placeholder="What's this pack about?"
                  rows={3}
                  className="w-full bg-[#161616] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200 resize-none"
                />
              </div>

              <button
                onClick={createPack}
                disabled={!newPackName.trim() || isCreatingPack}
                className="w-full bg-[#1F2937] hover:bg-[#374151] disabled:bg-[#111827] disabled:text-gray-600 text-white px-6 py-3.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 border border-white/5"
              >
                {isCreatingPack ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Pack</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setPendingExtraction(false); // Clear pending extraction if user cancels
            addLog('Authentication cancelled');
          }}
        />
      )}

      {/* Free Credits Prompt */}
      <FreeCreditsPrompt
        isOpen={freeCreditsPrompt.showPrompt}
        onClose={freeCreditsPrompt.closePrompt}
        feature="document processing"
      />

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>

    </div>
  );
}
