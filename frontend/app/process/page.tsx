'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Brain, FileText, BarChart3, CheckCircle, Play, Download, Terminal, X, ExternalLink, CreditCard, Loader, Lock, Info, HelpCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthModal from '@/components/AuthModal';
import PaymentNotification, { usePaymentNotifications } from '@/components/PaymentNotification';
import FreeCreditsPrompt from '@/components/FreeCreditsPrompt';
import { useFreeCreditsPrompt } from '@/hooks/useFreeCreditsPrompt';
import { API_ENDPOINTS } from '@/lib/api';
import { analytics } from '@/lib/analytics';
import { getNewUserCredits } from '@/lib/credit-config';

interface PaymentStatus {
  plan: string
  credits_balance: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
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
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [lastProgressTimestamp, setLastProgressTimestamp] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'warning'>('connected');
  const [paymentLimits, setPaymentLimits] = useState<{canProcess: boolean, credits_balance: number, plan?: string, isUnlimited?: boolean} | null>(null);
  const [emailModeStartTime, setEmailModeStartTime] = useState<number | null>(null);
  const [paymentLimitsError, setPaymentLimitsError] = useState<boolean>(false);
  const [lastPaymentCheck, setLastPaymentCheck] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFileTypes, setShowFileTypes] = useState(false);
  const [conversationUrl, setConversationUrl] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentProcessedChunks, setCurrentProcessedChunks] = useState<number>(0);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'files' | 'url'>('files');
  const [showCreditsTooltip, setShowCreditsTooltip] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isLogPanelCollapsed, setIsLogPanelCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const paymentLimitsRequestRef = useRef<Promise<any> | null>(null);
  const isExtractionPollingRef = useRef<boolean>(false);
  const extractionAbortControllerRef = useRef<AbortController | null>(null);

  // Payment notifications
  const { 
    notification, 
    hideNotification, 
    showLimitWarning, 
    showNotification 
  } = usePaymentNotifications();

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

  // Function to check recent payment attempts for debugging
  const checkPaymentAttempts = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/payment-attempts`,
        {
          method: 'GET'
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.failed_attempts > 0) {
          const lastFailure = data.recent_attempts.find((attempt: any) => attempt.status === 'failed');
          if (lastFailure) {
            addLog(`Recent payment issue detected: ${lastFailure.error_message}`);
            
            // Show helpful suggestion based on error
            if (lastFailure.error_message.toLowerCase().includes('card')) {
              addLog('💡 Tip: Try using a different card or payment method');
            } else if (lastFailure.error_message.toLowerCase().includes('funds')) {
              addLog('💡 Tip: Please check your account balance');
            } else if (lastFailure.error_message.toLowerCase().includes('expired')) {
              addLog('💡 Tip: Please update your payment method');
            }
          }
        }
        
        return data;
      }
    } catch (error) {
      console.error('Error checking payment attempts:', error);
    }
    return null;
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

  const handleExtract = async () => {
    if (!file && !conversationUrl) return;

    // Check if user is authenticated - if not, show auth modal
    if (!user) {
      setPendingExtraction(true); // Mark that we want to extract after auth
      setShowAuthModal(true);
      addLog('Please sign in to continue with extraction...');
      return;
    }

    // User is authenticated, proceed with extraction
    if (conversationUrl && !file) {
      await performChatGPTExtraction();
    } else if (file) {
      await performExtraction();
    }
  };

  const performChatGPTExtraction = async () => {
    if (!conversationUrl || !user) return;

    // Check payment limits first
    try {
      const limitsCheck = await checkPaymentLimits();
      if (!limitsCheck.canProcess) {
        addLog('Cannot process: Insufficient credits or subscription required.');
        showLimitWarning(limitsCheck.credits_balance, 1);
        return;
      }
    } catch (error) {
      addLog('Error checking payment limits. Please try again.');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('extracting');
    setProgress(0);
    
    // Clear any previous polling
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }
    extractionAbortControllerRef.current = new AbortController();

    try {
      // Detect platform from URL
      const platform = conversationUrl.includes('chatgpt.com/share/') ? 'ChatGPT' : 
                      conversationUrl.includes('claude.ai/share/') ? 'Claude' :
                      conversationUrl.includes('grok.com/share/') ? 'Grok' :
                      conversationUrl.includes('g.co/gemini/share/') ? 'Gemini' : 'Unknown';
      
      addLog(`Starting ${platform} URL extraction...`);
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${backendUrl}/api/extract-conversation-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: conversationUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setCurrentJobId(data.job_id);
      addLog(`${platform} extraction started with job ID: ${data.job_id}`);
      
      // Track extraction start
      analytics.extractionStart();
      
      // Start polling for progress
      startPollingExtractionStatus(data.job_id);
    } catch (error) {
      console.error('Conversation URL extraction failed:', error);
      
      let errorMessage = 'Conversation URL extraction failed';
      let showResetSuggestion = false;
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = 'Connection failed: Unable to reach the extraction server. Please check your internet connection and try again.';
        showResetSuggestion = true;
        addLog(`Network error during extraction: ${error.message}`);
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
          'Extraction failed. Please check the URL.'
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
            addLog(`⚠️ Server timeout detected (attempt ${consecutiveFailures}). Retrying in ${retryDelay/1000}s...`);
          } else {
            console.error('Status check failed:', statusResponse.status, statusResponse.statusText);
            addLog(`⚠️ Status check failed (attempt ${consecutiveFailures}). Retrying in ${retryDelay/1000}s...`);
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
    // Prevent multiple concurrent polling instances
    if (isExtractionPollingRef.current) {
      console.log('Extraction polling already in progress, skipping');
      return;
    }
    
    // Cancel any existing polling
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }
    
    // Create new abort controller for this polling session
    extractionAbortControllerRef.current = new AbortController();
    isExtractionPollingRef.current = true;
    
    console.log('Starting extraction polling for job:', jobId);
    
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
        
        // Check if extraction is complete by looking for job results
        const resultsResponse = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/results/${jobId}`, {
          method: 'GET',
          signal: extractionAbortControllerRef.current?.signal
        });
        
        if (!resultsResponse.ok) {
          consecutiveFailures++;
          setConnectionStatus('warning');
          
          const retryDelay = Math.min(3000 * Math.pow(2, consecutiveFailures - 1), 30000); // Start with 3s, max 30s
          
          if (resultsResponse.status === 408) {
            addLog(`⚠️ Server timeout during extraction check (attempt ${consecutiveFailures}). Retrying in ${retryDelay/1000}s...`);
          } else {
            addLog(`⚠️ Extraction check failed (attempt ${consecutiveFailures}). Retrying in ${retryDelay/1000}s...`);
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
        
        // Check if job failed
        if (resultsData.status === 'failed') {
          isExtractionPollingRef.current = false;
          setIsProcessing(false);
          setCurrentStep('upload'); // Reset to upload state
          addLog(`❌ Extraction failed: ${resultsData.error || 'Unknown error occurred'}`);
          return;
        }
        
        if (resultsData.extracted) {
          // Extraction is complete, stop polling
          isExtractionPollingRef.current = false;
          console.log('Extraction completed, stopping polling');
          
          // Extraction is complete, get the data
          setExtractionData(resultsData);
          setCostEstimate(resultsData.cost_estimate || { 
            estimated_total_cost: 0, 
            estimated_output_tokens: 0,
            estimated_chunks: 0 
          });
          
          // Track extraction completion
          analytics.extractionComplete(resultsData.chunk_count || 0);
          
          addLog(`Extraction complete: ${resultsData.conversation_count || 0} conversations, ${resultsData.message_count || 0} messages`);
          
          // Now get chunking time estimate based on extracted text from job summary
          try {
            const summaryResponse = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/job-summary/${jobId}`, {
              method: 'GET'
            });
            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json();
              const textLength = summaryData.content_size || 0;
              
              addLog(`Text extracted: ${textLength.toLocaleString()} characters ready for chunking`);
            }
          } catch (error) {
            console.error('Error getting text info:', error);
          }
          
          // Automatically start chunking after extraction
          addLog('Automatically starting chunking process...');
          setCurrentStep('chunking');
          setTimeout(() => {
            handleChunkWithData(resultsData, jobId);
          }, 1000); // Small delay to show the transition
        } else {
          // Still processing, schedule next poll with normal interval
          setTimeout(() => {
            if (!extractionAbortControllerRef.current?.signal.aborted) {
              poll();
            }
          }, 5000); // 5 second interval for normal polling
        }
        
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
        addLog(`⚠️ Error checking extraction status (attempt ${consecutiveFailures}). Retrying in ${retryDelay/1000}s...`);
        
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

  const startEmailModeCompletionPolling = (jobId: string) => {
    console.log('Starting email mode completion polling for job:', jobId);
    
    let consecutiveFailures = 0;
    const maxFailures = 3;
    const startTime = Date.now();
    const maxPollingDuration = 4 * 60 * 60 * 1000; // 4 hours max (for very large jobs)
    
    const poll = async () => {
      // Check if we've been polling too long
      if (Date.now() - startTime > maxPollingDuration) {
        addLog('⚠️ Email mode polling timed out. Your pack may still be processing - check your email or refresh the page.');
        return;
      }
      
      try {
        // Check if job is complete by looking for results
        const resultsResponse = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/results/${jobId}`, {
          method: 'GET'
        });
        
        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          
          // Check if analysis is complete
          if (resultsData.status === 'completed' || resultsData.status === 'analyzed') {
            console.log('Email mode job completed, showing completion state');
            addLog('🎉 Analysis complete! Your Context Pack is ready!');
            
            // Update to completion state
            setCurrentStep('email_completed');
            
            // Show completion notification
            showNotification(
              'info',
              `Your Context Pack is ready! Processed ${resultsData.processed_chunks || 0} chunks.`
            );
            
            return; // Stop polling
          }
        }
        
        // Reset failure count on successful check
        consecutiveFailures = 0;
        
        // Schedule next poll (check every 30 seconds for email mode)
        setTimeout(poll, 30000);
        
      } catch (error) {
        consecutiveFailures++;
        console.error('Error checking email mode completion:', error);
        
        if (consecutiveFailures >= maxFailures) {
          addLog('⚠️ Unable to check completion status. Your pack may still be processing - check your email or refresh the page.');
          return; // Stop polling after too many failures
        }
        
        // Retry with exponential backoff
        const retryDelay = Math.min(30000 * Math.pow(2, consecutiveFailures - 1), 120000); // 30s to 2min max
        setTimeout(poll, retryDelay);
      }
    };
    
    // Start polling after initial delay (give job time to start)
    setTimeout(poll, 60000); // Wait 1 minute before first check
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
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
    setFile(selectedFile);
    setConversationUrl(''); // Clear URL when file is selected
    setCurrentStep('uploaded');
    addLog(`File selected: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Track file upload
    analytics.fileUpload(selectedFile.size);
    
    // Get extraction time estimate
    // Simple calculation since we don't have a backend endpoint for this
    const estimatedExtractionTime = Math.max(30, Math.min(selectedFile.size / (1024 * 1024) * 30, 300)); // 30s per MB, min 30s, max 5min
    const formatted = estimatedExtractionTime < 60 
      ? `${Math.round(estimatedExtractionTime)}s` 
      : `${Math.round(estimatedExtractionTime / 60)}m`;
    
    setTimeEstimate({
      time_estimates: {
        extraction: {
          formatted: formatted,
          estimated_seconds: estimatedExtractionTime
        }
      }
      // Don't estimate chunks until after extraction
    });
    addLog(`Estimated extraction time: ${formatted}`);
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
    const validation = validateConversationUrl(url);
    if (!validation.isValid) {
      setUrlError(validation.error || 'Invalid URL format');
      return;
    }

    // Clear any previous errors
    setUrlError(null);
    
    setFile(null); // Clear file when URL is selected
    setConversationUrl(url);
    setCurrentStep('uploaded');
    addLog(`${validation.platform} URL ready: ${url}`);
    
    // Track URL input
    analytics.fileUpload(0); // Size 0 for URL
    
    // Estimate extraction time (much faster with optimizations)
    const estimatedExtractionTime = validation.platform === 'ChatGPT' ? 30 : 15; // ChatGPT takes a bit longer, others are fast
    const formatted = `${Math.round(estimatedExtractionTime / 60)}m`;
    
    setTimeEstimate({
      time_estimates: {
        extraction: {
          formatted: formatted,
          estimated_seconds: estimatedExtractionTime
        }
      }
    });
    addLog(`Estimated extraction time: ${formatted}`);
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

  const handleChunk = async () => {
    console.log('handleChunk called with:', { extractionData: !!extractionData, currentJobId, currentStep });
    
    if (!extractionData || !currentJobId) {
      console.error('Missing required data for chunking:', { extractionData: !!extractionData, currentJobId });
      addLog('Error: Missing extraction data or job ID');
      return;
    }

    // Prevent multiple simultaneous chunking requests
    if (isProcessing || currentStep === 'chunking') {
      console.log('Chunking already in progress, ignoring duplicate request');
      return;
    }

    console.log('Starting chunking process with jobId:', currentJobId);
    setIsProcessing(true);
    setCurrentStep('chunking');
    addLog('Creating semantic chunks...');

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const chunkUrl = `${backendUrl}/api/chunk/${currentJobId}`;
      console.log('Making chunking request to:', chunkUrl);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const requestBody = {
        chunk_size: 600000, // ~150k tokens (4 chars per token) - safe margin below GPT's 200k limit
        overlap: 6000,      // Proportional overlap
      };
      
      console.log('Request body:', requestBody);

      const response = await fetch(chunkUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('Chunking response status:', response.status);
      console.log('Chunking response URL:', response.url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chunking error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Chunking response data:', data);
      setChunkData(data);
      setAvailableChunks(data.chunks);
      setCurrentStep('chunked');
      addLog(`Chunking complete! Created ${data.total_chunks} chunks ready for analysis`);
      
      // Calculate analysis time estimate for all chunks (1 minute per chunk)
      const totalAnalysisSeconds = data.total_chunks * 60;
      const formatted = formatAnalysisTime(totalAnalysisSeconds);
      
      setAnalysisTimeEstimate({
        formatted: formatted,
        estimated_seconds: totalAnalysisSeconds
      });
      addLog(`Estimated analysis time for all chunks: ${formatted}`);
    } catch (error) {
      addLog(`Chunking failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChunkWithData = async (extractionResults: any, jobId: string) => {
    console.log('handleChunkWithData called with:', { extractionResults: !!extractionResults, jobId, currentStep });
    
    if (!extractionResults || !jobId) {
      console.error('Missing required data for chunking:', { extractionResults: !!extractionResults, jobId });
      addLog('Error: Missing extraction data or job ID');
      return;
    }

    // Prevent multiple simultaneous chunking requests
    if (isProcessing || currentStep === 'chunking') {
      console.log('Chunking already in progress, ignoring duplicate request');
      return;
    }

    console.log('Starting chunking process with jobId:', jobId);
    setIsProcessing(true);
    setCurrentStep('chunking');
    addLog('Creating semantic chunks...');

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const chunkUrl = `${backendUrl}/api/chunk/${jobId}`;
      console.log('Making chunking request to:', chunkUrl);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const requestBody = {
        chunk_size: 600000, // ~150k tokens (4 chars per token) - safe margin below GPT's 200k limit
        overlap: 6000,      // Proportional overlap
      };
      
      console.log('Request body:', requestBody);

      const response = await fetch(chunkUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('Chunking response status:', response.status);
      console.log('Chunking response URL:', response.url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chunking error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Chunking response data:', data);
      setChunkData(data);
      setAvailableChunks(data.chunks);
      setCurrentStep('chunked');
      addLog(`Chunking complete! Created ${data.total_chunks} chunks ready for analysis`);
      
      // Calculate analysis time estimate for all chunks (1 minute per chunk)
      const totalAnalysisSeconds = data.total_chunks * 60;
      const formatted = formatAnalysisTime(totalAnalysisSeconds);
      
      setAnalysisTimeEstimate({
        formatted: formatted,
        estimated_seconds: totalAnalysisSeconds
      });
      addLog(`Estimated analysis time for all chunks: ${formatted}`);
    } catch (error) {
      addLog(`Chunking failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    console.log('handleAnalyze called with:', { 
      chunkData: !!chunkData, 
      selectedChunks: selectedChunks.size, 
      currentJobId,
      currentStep 
    });
    
    if (!chunkData || selectedChunks.size === 0 || !currentJobId) {
      console.log('handleAnalyze early return due to missing data');
      setIsProcessing(false); // Reset if invalid state
      return;
    }

    console.log('handleAnalyze proceeding with analysis...');
    
    // Track analysis start
    analytics.analysisStart(selectedChunks.size);

    // Check payment limits before starting analysis
    const currentLimits = await checkPaymentLimits();
    setPaymentLimits(currentLimits); // Update the state as well
    if (!currentLimits.canProcess) {
      const creditMsg = currentLimits.isUnlimited || currentLimits.plan === 'unlimited' 
        ? 'Unlimited access available' 
        : `${currentLimits.credits_balance} available`;
      addLog(`Error: Insufficient credits (${creditMsg}). Please purchase more credits to continue.`);
      showNotification(
        'limit_reached',
        'Insufficient credits! Purchase more credits to analyze chunks.'
      );
      setIsProcessing(false); // Reset on error
      return;
    }

    const chunksToAnalyze = Array.from(selectedChunks);
    
    // Enforce credit limit (unless unlimited plan)
    const isUnlimited = currentLimits.isUnlimited || currentLimits.plan === 'unlimited';
    const maxAllowedChunks = isUnlimited ? chunksToAnalyze.length : currentLimits.credits_balance;
    
    if (!isUnlimited && chunksToAnalyze.length > maxAllowedChunks) {
      addLog(`Warning: Selected ${chunksToAnalyze.length} chunks but only ${maxAllowedChunks} credits available. Limiting to ${maxAllowedChunks} chunks.`);
      chunksToAnalyze.splice(maxAllowedChunks); // Trim to available credits
    } else if (isUnlimited) {
      addLog(`Unlimited plan detected - processing all ${chunksToAnalyze.length} selected chunks`);
    }
    
    if (chunksToAnalyze.length !== selectedChunks.size) {
      addLog(`Process ${chunksToAnalyze.length} chunks (limited by available credits)`);
    }
    
    setCurrentStep('analyzing');
    setAnalysisStartTime(Date.now());
    setLastProgressTimestamp(Date.now() / 1000); // Reset progress timestamp
    setCurrentProcessedChunks(0); // Reset processed chunks counter
    addLog(`Starting analysis of ${chunksToAnalyze.length} chunks...`);

    // Calculate time estimate for selected chunks (1 minute per chunk)
    const selectedAnalysisSeconds = chunksToAnalyze.length * 60;
    const formatted = formatAnalysisTime(selectedAnalysisSeconds);
    
    setSelectedChunksEstimatedTime(selectedAnalysisSeconds);
    addLog(`Estimated analysis time: ${formatted} for ${chunksToAnalyze.length} selected chunks`);

    try {
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/analyze/${currentJobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_chunks: chunksToAnalyze,
          max_chunks: maxChunks || undefined,
          upload_method: uploadMethod, // Pass the upload method to determine analysis type
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setJobId(data.job_id);
      setCurrentJobId(data.job_id);
      
      // Check if this is a large job using email notification
      if (data.email_notification && data.status === 'email_mode') {
        const startTime = Date.now();
        setEmailModeStartTime(startTime);
        
        addLog(`🎯 Large job detected (${data.chunks_to_process} chunks) - Email notification mode activated`);
        addLog(`📧 You will receive an email when analysis is complete (estimated: ${Math.round(data.estimated_time_minutes)} minutes)`);
        addLog(`💻 Feel free to close this window - we'll email you when it's done!`);
        
        // Set the step to a special email mode
        setCurrentStep('email_mode' as any);
        setIsProcessing(false);
        
        // Show notification about email mode
        showNotification(
          'info', 
          `Large job (${data.chunks_to_process} chunks) will run in background. Check your email for completion notification.`
        );
        
        // Start slow polling for completion detection (check every 30 seconds)
        startEmailModeCompletionPolling(data.job_id);
        return;
      } else {
        addLog(`Analysis job started: ${data.job_id}`);
        // Start polling for status for smaller jobs
        startPollingAnalysisStatus(data.job_id);
      }
    } catch (error) {
      console.error('Analysis failed to start:', error);
      
      // Enhanced error handling for different types of failures
      let errorMessage = 'Analysis failed to start';
      let showResetSuggestion = false;
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // This is likely a CORS or network connectivity issue
        errorMessage = 'Connection failed: Unable to reach the analysis server. This may be a temporary issue with our backend service.';
        showResetSuggestion = true;
        addLog(`Network error - likely CORS or server connectivity issue: ${error.message}`);
        
        // Check if this is specifically a CORS issue
        if (window.location.origin.includes('vercel.app')) {
          addLog('CORS Error detected: Frontend and backend domains may not be properly configured');
        }
      } else if (error instanceof Error && error.message.includes('HTTP error')) {
        errorMessage = `Server error: ${error.message}`;
        showResetSuggestion = true;
      } else {
        errorMessage = `Analysis failed: ${error}`;
      }
      
      addLog(errorMessage);
      
      // Show user-friendly notification with reset suggestion for server issues
      if (showResetSuggestion) {
        showNotification(
          'warning',
          'Connection issue. Try using Reset to restart.'
        );
      } else {
        showNotification(
          'warning',
          'Analysis failed. Please try again.'
        );
      }
      
      setIsProcessing(false); // Reset on error
      setCurrentStep('chunked'); // Return to chunked state so user can retry
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

  const downloadPack = async () => {
    if (!currentJobId || isDownloading) return;
    
    setIsDownloading(true);
    
    // Track download
    analytics.downloadPack();
    
    try {
      addLog('Starting pack download...');
      
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/download/${currentJobId}/pack`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ucp_pack_${currentJobId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addLog('Pack download completed successfully');
    } catch (error) {
      addLog(`Pack download failed: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadChunks = async () => {
    if (!currentJobId || isDownloading) return;
    
    setIsDownloading(true);
    
    // Track download
    analytics.downloadPack();
    
    try {
      addLog('Starting chunks download...');
      
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/download/${currentJobId}/chunks`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ucp_chunks_${currentJobId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addLog('Chunks download completed successfully');
    } catch (error) {
      addLog(`Chunks download failed: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const checkServerHealth = async () => {
    try {
      addLog('🔍 Checking server health...');
      setConnectionStatus('connecting');
      
      const healthResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/health`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(15000) // 15 second timeout
        }
      );
      
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      setConnectionStatus('connected');
      
      addLog(`✅ Server health check passed: ${healthData.status}`);
      addLog(`📊 Response time: ${healthData.response_time_ms}ms`);
      
      if (healthData.system) {
        addLog(`💾 Memory usage: ${healthData.system.memory_used_percent}%`);
        addLog(`🖥️ CPU usage: ${healthData.system.cpu_percent}%`);
      }
      
      if (healthData.job_queue) {
        addLog(`📝 Jobs: ${healthData.job_queue.pending_jobs} pending, ${healthData.job_queue.processing_jobs} processing`);
      }
      
      if (healthData.database?.healthy === false) {
        addLog('⚠️ Database connection issues detected');
        setConnectionStatus('warning');
      }
      
    } catch (error) {
      setConnectionStatus('disconnected');
      addLog(`❌ Server health check failed: ${error}`);
      addLog('💡 Try refreshing the page or contact support if issues persist');
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

  const viewResults = () => {
    if (currentJobId) {
      router.push(`/packs?id=${currentJobId}`);
    } else {
      router.push('/packs');
    }
  };

  return (
    <div className="min-h-screen bg-primary relative overflow-hidden">
      {/* Neutral Ambient Lighting Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Soft top-left light */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-radial from-gray-400/5 via-gray-500/3 to-transparent blur-3xl"></div>
        {/* Subtle bottom-right ambient glow */}
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-radial from-gray-300/4 via-gray-400/2 to-transparent blur-2xl"></div>
        {/* Central soft lighting */}
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 w-[500px] h-64 bg-gradient-elliptical from-gray-200/3 via-gray-300/2 to-transparent blur-3xl"></div>
      </div>
      
      {/* Payment Notification */}
      <PaymentNotification
        show={notification.show}
        type={notification.type}
        message={notification.message}
        onClose={hideNotification}
        onUpgrade={() => router.push('/pricing')}
        autoHide={false}
      />

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto p-6">
        {/* Main Content - Always Show Interface */}
        <div className="space-y-6">
          <div className="w-full flex justify-center items-center py-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-4">
                One Profile. Your AI.
              </h1>
              
              {/* Connection Status Indicator */}
              {isProcessing && (
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' :
                    connectionStatus === 'connecting' ? 'bg-green-500 animate-pulse' :
                    connectionStatus === 'warning' ? 'bg-orange-500 animate-pulse' :
                    'bg-red-500'
                  }`}></div>
                  <span className={`${
                    connectionStatus === 'connected' ? 'text-green-400' :
                    connectionStatus === 'connecting' ? 'text-green-400' :
                    connectionStatus === 'warning' ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    {connectionStatus === 'connected' ? 'Connected to server' :
                     connectionStatus === 'connecting' ? 'Connected to server' :
                     connectionStatus === 'warning' ? 'Connection issues detected' :
                     'Server connection lost'}
                  </span>
                </div>
              )}
            </div>
          </div>

            {/* Reset Button Section */}
            {currentStep !== 'upload' && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={resetProcess}
                  className="text-sm text-text-secondary hover:text-text-primary px-3 py-1 border border-border-secondary rounded hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Upload Section */}
            {currentStep === 'upload' && (
              <div id="upload-section" className="max-w-4xl mx-auto space-y-8">
                {/* Header with Value Proposition */}
                <div className="text-center space-y-4">
                  <p className="text-xl text-gray-300 font-medium">
                    All your AI chats, one memory file.
                  </p>
                  <p className="text-gray-400 text-sm max-w-2xl mx-auto">
                    Upload exports → we organize, clean, and package them → you get a single smart file you can use anywhere.
                  </p>
                </div>

                {/* Upload Method Tabs */}
                <div className="flex bg-gray-800/50 border border-gray-700 rounded-xl p-1 max-w-md mx-auto">
                  <button
                    onClick={() => setUploadMethod('files')}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                      uploadMethod === 'files'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    All Chats
                  </button>
                  <button
                    disabled
                    className="flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 cursor-not-allowed opacity-50 text-gray-500 relative group"
                    title="ChatGPT URL extraction is temporarily unavailable"
                  >
                    <span className="flex items-center justify-center gap-1">
                      One Chat
                      <span className="text-xs opacity-75">(Soon)</span>
                    </span>
                  </button>
                </div>

                {/* File Upload Tab */}
                {uploadMethod === 'files' && (
                  <div className={`
                    backdrop-blur-sm border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300
                    ${isDragOver 
                      ? 'bg-blue-900/20 border-blue-400 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30' 
                      : 'bg-gray-900/80 border-gray-600 hover:border-gray-500 hover:bg-gray-900/90'
                    }
                    group
                  `}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.txt,.csv,.zip"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {/* Hidden folder input */}
                    <input
                      ref={folderInputRef}
                      type="file"
                      {...({ webkitdirectory: 'true' } as any)}
                      multiple
                      onChange={handleFolderSelect}
                      className="hidden"
                    />
                    
                    {/* Dropzone */}
                    <div 
                      className={`transition-all duration-300 ${isDragOver ? 'scale-[1.02]' : 'group-hover:scale-[1.01]'}`}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className={`
                        w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-8 transition-all duration-300
                        ${isDragOver 
                          ? 'bg-blue-600 shadow-lg shadow-blue-500/30 scale-110' 
                          : 'bg-gray-700 group-hover:bg-gray-600'
                        }
                      `}>
                        <Upload className={`h-10 w-10 transition-all duration-300 ${
                          isDragOver ? 'text-white animate-pulse' : 'text-gray-300 group-hover:text-gray-200'
                        }`} />
                      </div>
                      
                      <h3 className={`text-3xl font-medium mb-4 transition-colors duration-300 ${
                        isDragOver ? 'text-blue-300' : 'text-white group-hover:text-gray-100'
                      }`}>
                        {isDragOver ? 'Drop your file here' : 'Upload Chats Export'}
                      </h3>

                      <p className="text-gray-400 text-sm mb-10 max-w-md mx-auto leading-relaxed">
                        <button 
                          onClick={() => {
                            router.push('/');
                            setTimeout(() => {
                              const el =
                                document.getElementById('section-2') ||
                                document.querySelector('[data-section="section-2"]') ||
                                document.querySelectorAll('section')[1];

                              if (el instanceof HTMLElement) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                try {
                                  window.history.replaceState({}, '', '/#section-2');
                                } catch (e) {
                                  // ignore
                                }
                              }
                            }, 250);
                          }}
                          className="text-blue-400 hover:text-blue-300 underline transition-colors"
                        >
                          How to export your chats?
                        </button> 
                      </p>
                      
                      {/* Action Buttons */}
                      <div className="space-y-4 mb-10">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-white text-black py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02]"
                        >
                          Select Conversations File
                        </button>
                      </div>
                      
                      {/* File Types */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span className="px-3 py-1.5 bg-blue-700/40 border border-gray-700 text-gray-300 rounded-full text-xs font-medium">Recommended: conversations.json</span>
                          <span className="px-3 py-1.5 bg-red-700/40 border border-gray-700 text-gray-300 rounded-full text-xs font-medium">Warning: dont use chat.html</span>
                          <span className="text-gray-600 text-xs">·</span>
                        </div>
                        
                        
                        {/* Security Note */}
                        <p className="text-xs text-gray-500 max-w-sm mx-auto mt-4 flex items-center justify-center gap-1">
                          <Lock className="h-3 w-3" />
                          Data never stored, files are processed securely in your session.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* URL Input Tab - Temporarily Disabled */}
                {uploadMethod === 'url' && false && (
                  <div className="bg-gray-900/80 border-2 border-gray-600 hover:border-gray-500 rounded-2xl p-10 text-center transition-all duration-300 hover:bg-gray-900/90">
                    <div className="w-20 h-20 rounded-xl bg-gray-700 flex items-center justify-center mx-auto mb-8">
                      <ExternalLink className="h-10 w-10 text-gray-300" />
                    </div>

                    <h3 className="text-xl font-medium text-white mb-4">Paste ChatGPT Conversation URL</h3>
                    
                    <p className="text-gray-400 text-sm mb-10 max-w-md mx-auto leading-relaxed">
                      Have a shared ChatGPT conversation link? Paste it here and we'll extract the conversation data for you. Other platforms coming soon!
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

                      <input
                        type="url"
                        value={conversationUrl}
                        onChange={(e) => {
                          setConversationUrl(e.target.value);
                          // Clear error when user starts typing
                          if (urlError) setUrlError(null);
                        }}
                        placeholder="https://chatgpt.com/share/..."
                        className={`w-full px-4 py-4 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                          urlError 
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                            : 'border-gray-600 focus:border-purple-500 focus:ring-purple-500/20'
                        }`}
                      />
                      
                      <button
                        onClick={() => processConversationUrl(conversationUrl)}
                        disabled={!conversationUrl.trim()}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none"
                      >
                        Start Extraction
                      </button>
                      
                      <p className="text-xs text-gray-500">
                        Only ChatGPT shared conversation links are supported currently
                      </p>
                      
                      <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-2">
                        <Lock className="h-3 w-3" />
                        We never store your data. Files are processed securely in your session.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                  
                  {/* File/URL Info Card */}
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
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={handleExtract}
                      disabled={isProcessing}
                      className="flex-1 bg-white hover:bg-gray-100 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 disabled:text-gray-400 px-6 py-4 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                    >
                      {isProcessing ? (
                        <Loader className="h-5 w-5 animate-spin" />
                      ) : conversationUrl ? (
                        <ExternalLink className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                      <span>
                        {isProcessing 
                          ? 'Processing...' 
                          : conversationUrl 
                            ? `Start Extraction`
                            : 'Process File'
                        }
                      </span>
                    </button>
                    
                    <button
                      onClick={handleReset}
                      className="px-6 py-4 border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 rounded-xl font-medium transition-all flex items-center justify-center space-x-2"
                    >
                      <X className="h-5 w-5" />
                      <span>Clear & Start Over</span>
                    </button>
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
                      <p className="text-gray-400">Processing your conversations and extracting meaningful content...</p>
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

            {/* Chunking Progress */}
            {currentStep === 'chunking' && (
              <div className="max-w-4xl mx-auto">
                <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-xl">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
                      <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">Creating Chunks</h3>
                      <p className="text-gray-400">Breaking your content into semantic chunks for analysis...</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/20 border border-gray-600/50 rounded-xl p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                      <span className="text-blue-300 font-medium">Optimizing content into 150k token chunks</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chunk Actions */}
            {['chunked', 'analyzing', 'analyzed'].includes(currentStep) && chunkData && (
              <div className="max-w-6xl mx-auto">
                <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-xl">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">Create Universal Context Pack</h3>
                      <p className="text-gray-400">
                        {(() => {
                          const totalChunks = chunkData.total_chunks;
                          const isUnlimited = paymentLimits?.isUnlimited || paymentLimits?.plan === 'unlimited';
                          const availableCredits = isUnlimited ? totalChunks : (paymentLimits ? paymentLimits.credits_balance : totalChunks);
                          const chunksToProcess = Math.min(availableCredits, totalChunks);
                          
                          // If unlimited plan, show unlimited message
                          if (isUnlimited) {
                            return `${totalChunks} chunks ready for unlimited AI processing`;
                          }
                          // If user has more chunks than credits, show partial processing message
                          if (totalChunks > availableCredits) {
                            return `${totalChunks} chunks. You can process ${chunksToProcess} chunks with your current credits.`;
                          }
                          // Otherwise, show normal message
                          return `${totalChunks} chunks ready for AI processing`;
                        })()}
                      </p>
                    </div>
                  </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {currentStep === 'chunked' && (
                      <button
                        onClick={() => {
                          if (isProcessing) return; // Prevent double-clicks
                          
                          if (selectedChunks.size === 0) {
                            // Limit selection to available credits
                            const maxChunks = paymentLimits ? Math.min(paymentLimits.credits_balance, availableChunks.length) : availableChunks.length;
                            const limitedChunkIds = new Set(Array.from({ length: maxChunks }, (_, index) => index));
                            setSelectedChunks(limitedChunkIds);
                            setIsProcessing(true); // Set immediately
                            setTimeout(() => handleAnalyze(), 100);
                          } else {
                            setIsProcessing(true); // Set immediately
                            handleAnalyze();
                          }
                        }}
                        disabled={isProcessing || Boolean(paymentLimits && !paymentLimits.canProcess)}
                        className="flex-1 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:bg-gray-600 disabled:text-gray-400 flex items-center justify-center space-x-2 font-medium shadow-lg text-sm sm:text-base"
                      >
                        <Brain className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="truncate">
                          {(paymentLimits && !paymentLimits.canProcess)
                            ? 'Credits Required for UCP Creation'
                            : (() => {
                                const totalChunks = availableChunks.length;
                                const isUnlimited = paymentLimits?.isUnlimited || paymentLimits?.plan === 'unlimited';
                                const availableCredits = isUnlimited ? totalChunks : (paymentLimits ? paymentLimits.credits_balance : totalChunks);
                                const chunksToProcess = Math.min(availableCredits, totalChunks);
                                
                                // If unlimited plan, show unlimited message
                                if (isUnlimited) {
                                  return `Create UCP (${totalChunks} chunks - Unlimited)`;
                                }
                                // If user has more chunks than credits, show "Processing X out of Y"
                                if (totalChunks > availableCredits) {
                                  return `Create UCP (Processing ${chunksToProcess} out of ${totalChunks} chunks)`;
                                }
                                // Otherwise, show normal "Create UCP (X chunks)"
                                return `Create UCP (${chunksToProcess} chunks)`;
                              })()
                          }
                        </span>
                      </button>
                    )}

                    <button
                      onClick={downloadChunks}
                      disabled={isDownloading}
                      className="py-3 px-4 border border-gray-600 rounded-lg text-gray-400 hover:text-gray-300 hover:border-gray-500 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                      title="Download Raw Chunks"
                    >
                      {isDownloading ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      <span>{isDownloading ? 'Downloading...' : 'Download Raw Chunks'}</span>
                    </button>
                  </div>

                  {/* Subtle Upgrade Button - only show when user has fewer credits than chunks */}
                  {currentStep === 'chunked' && paymentLimits && availableChunks.length > paymentLimits.credits_balance && (
                    <button
                      onClick={() => {
                        const creditsNeeded = availableChunks.length - paymentLimits.credits_balance;
                        router.push(`/pricing?credits=${creditsNeeded}&upgrade=true`);
                      }}
                      className="w-full py-3 px-4 border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 rounded-lg transition-all flex items-center justify-center space-x-2 text-sm font-medium hover:border-blue-400/50"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Upgrade to Process All {availableChunks.length} Chunks</span>
                    </button>
                  )}
                </div>
              </div>
              </div>
            )}

            {/* UCP Creation Progress */}
            {currentStep === 'analyzing' && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Creating Universal Context Pack</h3>
                  <button
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="px-4 py-2 text-sm font-medium border-2 border-red-500 text-red-400 bg-red-500/5 rounded-lg hover:bg-red-500/15 hover:text-red-300 hover:border-red-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>{isCancelling ? 'Cancelling...' : 'Cancel Job'}</span>
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Progress</span>
                    <span className="text-text-primary font-medium">{getTimeBasedProgress()}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3 border border-gray-600">
                    <div 
                      className="bg-gradient-to-r from-gray-400 to-gray-400 h-3 rounded-full transition-all duration-300 shadow-lg"
                      style={{ width: `${getTimeBasedProgress()}%` }}
                    ></div>
                  </div>
                  {analysisStartTime && (
                    <div className="text-sm text-text-secondary">
                      Elapsed: {formatElapsedTime(analysisStartTime)}
                      {selectedChunksEstimatedTime > 0 && (
                        <span className="ml-2">
                          / Est: {Math.floor(selectedChunksEstimatedTime / 60)}m {selectedChunksEstimatedTime % 60}s
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Warning about cancellation */}
                  <div className="text-xs text-gray-400 bg-gray-800/50 border border-gray-700 rounded p-2 mt-2">
                    <div className="flex items-center space-x-1">
                      <Info className="h-3 w-3" />
                      <span>Note: If you cancel after 10+ chunks are processed, you'll be charged for the completed work.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Email Notification Mode for Large Jobs */}
            {currentStep === 'email_mode' && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Brain className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Processing in Background</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Your analysis is running on our servers</p>
                      </div>
                    </div>
                    
                    {/* Cancel button for email mode */}
                    <button
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="px-4 py-2 text-sm font-medium border-2 border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center space-x-2"
                    >
                      <X className="h-4 w-4" />
                      <span>{isCancelling ? 'Cancelling...' : 'Cancel Job'}</span>
                    </button>
                  </div>
                </div>

                {/* Main Content */}
                <div className="p-6 space-y-6">
                  {/* Key Information - Professional Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Start Time */}
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Started</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {emailModeStartTime ? new Date(emailModeStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {emailModeStartTime ? new Date(emailModeStartTime).toLocaleDateString() : 'Today'}
                      </p>
                    </div>

                    {/* Estimated Completion */}
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estimated Completion</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {emailModeStartTime && selectedChunks.size ? 
                          new Date(emailModeStartTime + (selectedChunks.size * 1.2 * 60 * 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                          'In 8-12 minutes'
                        }
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Based on {selectedChunks.size || 6} chunks
                      </p>
                    </div>

                    {/* Email Destination */}
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Results sent to</span>
                      </div>
                      <p className="text-sm font-mono text-gray-900 dark:text-white truncate bg-white dark:bg-gray-900 px-2 py-1 rounded border">
                        {user?.email || 'your-email@domain.com'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Check your inbox when complete
                      </p>
                    </div>
                  </div>

                  {/* Status Message - Professional */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Analysis Started Successfully</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                          You can safely close this window or navigate to other pages. We'll email you when your Context Pack is ready for download.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Job Reference - Subtle */}
                  {jobId && (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Job Reference:</span>
                        <span className="font-mono text-gray-900 dark:text-white text-xs">{jobId}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions - Professional Button Layout */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => router.push('/')}
                      className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-center"
                    >
                      Return to Home
                    </button>
                    <button
                      onClick={async () => {
                        if (jobId) {
                          addLog('🔍 Checking job completion status...');
                          try {
                            const resultsResponse = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/results/${jobId}`, {
                              method: 'GET'
                            });
                            
                            if (resultsResponse.ok) {
                              const resultsData = await resultsResponse.json();
                              
                              if (resultsData.status === 'completed' || resultsData.status === 'analyzed') {
                                addLog('🎉 Job completed! Your Context Pack is ready!');
                                setCurrentStep('email_completed');
                                showNotification('info', 'Your Context Pack is ready for download!');
                              } else {
                                addLog(`📋 Job status: ${resultsData.status || 'processing'}. Still in progress...`);
                                showNotification('info', 'Job is still processing. You will receive an email when complete.');
                              }
                            } else {
                              addLog('❓ Unable to check status. Job may still be processing...');
                              showNotification('warning', 'Unable to check status. Please try again later.');
                            }
                          } catch (error) {
                            console.error('Error checking completion:', error);
                            addLog('❌ Error checking completion status. Please try again later.');
                            showNotification('warning', 'Error checking status. Please try again later.');
                          }
                        }
                      }}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Check Status
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Email Job Completed */}
            {currentStep === 'email_completed' && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Analysis Complete!</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Your Context Pack is ready for download</p>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="p-6 space-y-6">
                  {/* Completion Message */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">Context Pack Ready</h4>
                        <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                          Your Universal Context Pack has been successfully created and is available in the Packs tab. You should have also received an email notification.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Completion Time */}
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completed</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleDateString()}
                      </p>
                    </div>

                    {/* Email Sent */}
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email sent to</span>
                      </div>
                      <p className="text-sm font-mono text-gray-900 dark:text-white truncate bg-white dark:bg-gray-900 px-2 py-1 rounded border">
                        {user?.email || 'your-email@domain.com'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Check your inbox for download link
                      </p>
                    </div>
                  </div>

                  {/* Job Reference */}
                  {jobId && (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Job Reference:</span>
                        <span className="font-mono text-gray-900 dark:text-white text-xs">{jobId}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => router.push('/packs')}
                      className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                    >
                      View in Packs Tab
                    </button>
                    <button
                      onClick={() => router.push('/')}
                      className="px-6 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Create Another
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UCP Creation Complete */}
            {currentStep === 'analyzed' && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Universal Context Pack Created</h3>
                  <br/>
                  <p className="text-sm text-text-secondary">Download your complete_ucp.txt and paste into any AI chat.</p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={viewResults}
                    className="bg-bg-secondary border border-border-primary text-text-primary px-6 py-3 rounded-lg font-medium hover:bg-bg-tertiary hover:border-border-accent transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>View Results</span>
                  </button>
                  <button
                    onClick={downloadPack}
                    disabled={isDownloading}
                    className="px-6 py-3 border border-border-secondary rounded-lg text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>{isDownloading ? 'Downloading...' : 'Download UCP'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Process Logs - Collapsible */}
            {logs.length > 0 && (
              <div className="bg-bg-card border border-border-primary rounded-lg">
                <button
                  onClick={() => setIsLogPanelCollapsed(!isLogPanelCollapsed)}
                  className="w-full flex items-center justify-between p-4 hover:bg-bg-secondary transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                      <Terminal className="h-4 w-4 text-gray-600" />
                    </div>
                    <h3 className="text-sm font-medium text-text-primary">Process Log</h3>
                    <span className="text-xs text-text-muted">({logs.length} entries)</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${isLogPanelCollapsed ? 'rotate-0' : 'rotate-180'}`} />
                </button>
                
                {!isLogPanelCollapsed && (
                  <div className="border-t border-border-primary p-4">
                    <div className="bg-bg-secondary rounded-lg p-3 max-h-48 overflow-y-auto">
                      {logs.map((log, index) => (
                        <div key={index} className="text-xs text-text-secondary font-mono mb-1">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Chunk Selection Modal */}
        {showChunkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-600 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-600">
                <h3 className="text-lg font-semibold text-text-primary">Select Chunks to Pack</h3>
                <button
                  onClick={() => setShowChunkModal(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Max Chunks Control */}
              <div className="p-6 border-b border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <label htmlFor="maxChunks" className="text-sm font-medium text-text-primary">
                    Maximum chunks to analyze
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="maxChunks"
                      type="number"
                      min="1"
                      max={availableChunks.length}
                      value={maxChunks || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null;
                        setMaxChunks(value);
                      }}
                      placeholder="All"
                      className="w-20 px-2 py-1 text-sm bg-bg-secondary border border-border-secondary rounded text-text-primary placeholder:text-text-muted focus:border-border-accent focus:outline-none"
                    />
                    <button
                      onClick={() => setMaxChunks(null)}
                      className="px-2 py-1 text-xs border border-border-secondary rounded text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {maxChunks && maxChunks < availableChunks.length && (
                  <div className="text-xs text-text-muted">
                    Only the first {maxChunks} chunks will be analyzed (estimated time: {(() => {
                      const seconds = Math.ceil(maxChunks * 47);
                      const minutes = Math.floor(seconds / 60);
                      const remainingSeconds = seconds % 60;
                      return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
                    })()})
                  </div>
                )}
              </div>

              <div className="p-6 border-b border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-text-secondary">
                    {selectedChunks.size} of {availableChunks.length} chunks selected
                    {selectedChunks.size > 0 && (
                      <div className="text-blue-400 mt-1 text-xs">
                        Est. time: {(() => {
                          const seconds = selectedChunks.size * 60; // 1 minute per chunk
                          if (seconds < 60) return `${seconds}s`;
                          const minutes = Math.floor(seconds / 60);
                          const remainingSeconds = seconds % 60;
                          return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedChunks(new Set())}
                      className="px-3 py-1 text-sm border border-border-secondary rounded text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1 text-sm bg-gray-700 border border-gray-600 text-text-primary rounded hover:bg-gray-600 hover:border-border-accent transition-colors"
                    >
                      {selectedChunks.size === availableChunks.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {availableChunks.map((chunk, index) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedChunks.has(index) 
                        ? 'border-gray-500 bg-gray-600/20' 
                        : 'border-gray-400 hover:border-gray-300 bg-gray-700'
                    }`}
                    onClick={() => handleChunkToggle(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-text-primary mb-1">
                          Chunk {index + 1}
                        </div>
                        <div className="text-sm text-text-secondary mb-2">
                          {chunk.token_count || 0} tokens
                        </div>
                        <div className="text-sm text-text-secondary line-clamp-2">
                          {chunk.preview || 'No content available'}
                        </div>
                      </div>
                      <div className={`ml-4 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedChunks.has(index) ? 'border-gray-500 bg-gray-600' : 'border-gray-500'
                      }`}>
                        {selectedChunks.has(index) && (
                          <CheckCircle className="h-3 w-3 text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 p-6 border-t border-gray-600">
                <button
                  onClick={() => setShowChunkModal(false)}
                  className="px-4 py-2 border border-border-secondary rounded-lg text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowChunkModal(false);
                    if (selectedChunks.size > 0) {
                      handleAnalyze();
                    }
                  }}
                  disabled={selectedChunks.size === 0 || Boolean(paymentLimits && !paymentLimits.canProcess)}
                  className="px-4 py-2 bg-gray-700 border border-gray-600 text-text-primary rounded-lg hover:bg-gray-600 hover:border-border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    (paymentLimits && !paymentLimits.canProcess)
                    ? `Insufficient credits (${paymentLimits.credits_balance} available). Purchase more credits to continue.`
                    : ''
                  }
                >
                  {(paymentLimits && !paymentLimits.canProcess)
                    ? `Insufficient Credits (${paymentLimits.credits_balance})`
                    : `Pack Selected (${selectedChunks.size})`
                  }
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Chunk Selection Modal */}
        {showChunkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className=" bg-black/90 border border-border-primary rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-border-primary">
                <h3 className="text-lg font-semibold text-text-primary">Select Chunks to Pack</h3>
                <button
                  onClick={() => setShowChunkModal(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 border-b border-border-primary">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-text-secondary">
                    {selectedChunks.size} of {availableChunks.length} chunks selected
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedChunks(new Set())}
                      className="px-3 py-1 text-sm border border-border-secondary rounded text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1 text-sm bg-bg-secondary border border-border-primary text-text-primary rounded hover:bg-bg-tertiary hover:border-border-accent transition-colors"
                    >
                      {selectedChunks.size === availableChunks.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {availableChunks.map((chunk, index) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedChunks.has(index) 
                        ? 'border-gray-500 bg-gray-600/5' 
                        : 'border-border-primary hover:border-border-accent'
                    }`}
                    onClick={() => handleChunkToggle(index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-text-primary mb-1">
                          Chunk {index + 1}
                        </div>
                        <div className="text-sm text-text-secondary mb-2">
                          {chunk.token_count || 0} tokens
                        </div>
                        <div className="text-sm text-text-muted line-clamp-2">
                          {chunk.preview || 'No content available'}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ml-3 ${
                        selectedChunks.has(index) 
                          ? 'border-gray-500 bg-gray-600 text-white' 
                          : 'border-border-primary'
                      }`}>
                        {selectedChunks.has(index) && (
                          <CheckCircle className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 p-6 border-t border-border-primary">
                <button
                  onClick={() => setShowChunkModal(false)}
                  className="px-4 py-2 border border-border-secondary rounded-lg text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowChunkModal(false);
                    if (selectedChunks.size > 0) {
                      handleAnalyze();
                    }
                  }}
                  disabled={selectedChunks.size === 0 || Boolean(paymentLimits && !paymentLimits.canProcess)}
                  className="px-4 py-2 bg-bg-secondary border border-border-primary text-text-primary rounded-lg hover:bg-bg-tertiary hover:border-border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {(paymentLimits && !paymentLimits.canProcess)
                    ? 'Limit Reached'
                    : `Pack Selected (${selectedChunks.size})`
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
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

      {/* Floating Payment Button */}
      <div className="fixed top-32 right-6 z-40">
        <div className="relative">
          <button
            onClick={() => {
              if (paymentLimitsError) {
                // Retry loading credits if there was an error
                setPaymentLimitsError(false);
                setPaymentLimits(null); // Reset to loading state
                checkPaymentLimits()
                  .then((limits) => {
                    setPaymentLimits(limits);
                    setPaymentLimitsError(false);
                  })
                  .catch((error) => {
                    console.error('Retry error loading payment limits:', error);
                    setPaymentLimitsError(true);
                    setPaymentLimits({ canProcess: false, credits_balance: 0 });
                  });
              } else {
                router.push('/pricing');
              }
            }}
            onMouseEnter={() => setShowCreditsTooltip(true)}
            onMouseLeave={() => setShowCreditsTooltip(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer bg-gray-900/90 backdrop-blur-sm border border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800/90 hover:text-white"
          >
            <CreditCard className="w-4 h-4" />
            <span className="text-sm font-medium">
              {paymentLimits ? 
                `${paymentLimits.credits_balance} credits available` 
                : paymentLimitsError 
                  ? 'Error loading credits - Click to retry'
                  : !user 
                    ? `${getNewUserCredits()} credits`
                    : 'Loading...'}
            </span>
            <HelpCircle className="w-3 h-3 opacity-60" />
          </button>

          {/* Credits Tooltip */}
          {showCreditsTooltip && (
            <div className="absolute top-full right-0 mt-2 min-w-96 max-w-sm bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-2xl p-6 z-50">
              <div className="text-sm text-slate-900 font-semibold mb-4">What are credits?</div>
              <div className="text-sm text-slate-600 space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
                  <p>Each credit processes one conversation chunk</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
                  <p>Typical conversations use 5-50 credits</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></div>
                  <p><strong>Get {getNewUserCredits()} free credits</strong> when you sign up</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
                  <p>Buy more credits or get unlimited processing</p>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100/50">
                <button 
                  onClick={() => router.push('/pricing')}
                  className="inline-flex items-center text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all duration-200 font-medium shadow-sm"
                >
                  View pricing →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

