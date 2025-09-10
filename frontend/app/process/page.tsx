'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Brain, FileText, BarChart3, CheckCircle, Play, Download, Terminal, X, ExternalLink, CreditCard, Loader, Lock, Info } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthModal from '@/components/AuthModal';
import PaymentNotification, { usePaymentNotifications } from '@/components/PaymentNotification';
import FreeCreditsPrompt from '@/components/FreeCreditsPrompt';
import { useFreeCreditsPrompt } from '@/hooks/useFreeCreditsPrompt';
import { API_ENDPOINTS } from '@/lib/api';
import { analytics } from '@/lib/analytics';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'uploaded' | 'extracting' | 'extracted' | 'chunking' | 'chunked' | 'analyzing' | 'analyzed'>('upload');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showChunkModal, setShowChunkModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sessionId] = useState(() => Date.now().toString()); // Unique session ID
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [lastProgressTimestamp, setLastProgressTimestamp] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'warning'>('connected');
  const [paymentLimits, setPaymentLimits] = useState<{canProcess: boolean, credits_balance: number, plan?: string} | null>(null);
  const [paymentLimitsError, setPaymentLimitsError] = useState<boolean>(false);
  const [lastPaymentCheck, setLastPaymentCheck] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFileTypes, setShowFileTypes] = useState(false);
  const [conversationUrl, setConversationUrl] = useState<string>('');
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
        setConversationUrl(session.chatgptUrl || '');
        if (session.currentJobId) {
          setCurrentJobId(session.currentJobId);
          // If we were in the middle of analysis, start polling
          if (session.currentStep === 'analyzing') {
            setIsProcessing(true);
            startPollingAnalysisStatus(session.currentJobId);
            addLog('Resumed monitoring analysis progress...');
          }
        }
        addLog('Session restored from localStorage');
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
            addLog(`Credit balance updated: ${limits.credits_balance} credits available`);
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
        progress,
        logs: logs.slice(-50), // Only keep last 50 logs to reduce storage size
        currentJobId,
        analysisStartTime,
        sessionId,
        conversationUrl
      };
      localStorage.setItem('ucp_process_session', JSON.stringify(session));
    }, 1000); // Debounce by 1 second to reduce frequency

    return () => clearTimeout(timeoutId);
  }, [currentStep, currentJobId, progress]); // Only save on important changes

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
        sessionId,
        conversationUrl
      };
      localStorage.setItem('ucp_process_session', JSON.stringify(session));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentStep, extractionData, costEstimate, chunkData, availableChunks, selectedChunks, progress, logs, currentJobId, analysisStartTime, sessionId, conversationUrl]);

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
          addLog(`Credit balance updated: ${limits.credits_balance} credits available`);
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
              addLog(`Payment processed! Credit balance: ${limits.credits_balance} credits available`);
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
      addLog(`Extraction failed: ${error}`);
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
      addLog(`Conversation URL extraction failed: ${error}`);
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
    
    // Use the higher of time-based or chunk-based progress for smoother experience
    return Math.max(progress, Math.round(timeProgress));
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
          const canProcess = data.credits_balance > 0;
          const result = {
            canProcess,
            credits_balance: data.credits_balance || 0,
            plan: 'credits'
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
            const healthResponse = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/health`,
              {
                method: 'GET',
                signal: AbortSignal.timeout(15000) // 15 second timeout for health check
              }
            );
            
            if (healthResponse.ok) {
              const healthData = await healthResponse.json();
              console.log('Server warmed up, health status:', healthData.status);
              addLog(`🔄 Server reconnected (attempt ${consecutiveFailures + 1})`);
            }
          } catch (healthError) {
            console.warn('Health check failed during retry:', healthError);
            addLog(`⚠️ Server warming failed, retrying status check...`);
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
    
    // Check for ChatGPT URL
    if (url.includes('chatgpt.com/share/')) {
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
    }
    
    // Check for Claude URL
    if (url.includes('claude.ai/share/')) {
      try {
        const urlObj = new URL(url);
        const conversationId = urlObj.pathname.split('/').pop();
        if (!conversationId || conversationId.length < 10) {
          return { isValid: false, error: "Invalid Claude conversation ID in URL" };
        }
        return { isValid: true, platform: 'Claude' };
      } catch {
        return { isValid: false, error: "Invalid Claude URL format" };
      }
    }
    
    // Check for Grok URL
    if (url.includes('grok.com/share/')) {
      try {
        const urlObj = new URL(url);
        const conversationId = urlObj.pathname.split('/').pop();
        if (!conversationId || conversationId.length < 10) {
          return { isValid: false, error: "Invalid Grok conversation ID in URL" };
        }
        return { isValid: true, platform: 'Grok' };
      } catch {
        return { isValid: false, error: "Invalid Grok URL format" };
      }
    }
    
    // Check for Gemini URL
    if (url.includes('g.co/gemini/share/')) {
      try {
        const urlObj = new URL(url);
        const conversationId = urlObj.pathname.split('/').pop();
        if (!conversationId || conversationId.length < 10) {
          return { isValid: false, error: "Invalid Gemini conversation ID in URL" };
        }
        return { isValid: true, platform: 'Gemini' };
      } catch {
        return { isValid: false, error: "Invalid Gemini URL format" };
      }
    }
    
    return { isValid: false, error: "Must be a ChatGPT, Claude, Grok, or Gemini share URL" };
  };

  const processConversationUrl = async (url: string) => {
    const validation = validateConversationUrl(url);
    if (!validation.isValid) {
      addLog(`Error: ${validation.error}`);
      return;
    }

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
      
      // Calculate analysis time estimate for all chunks (40 seconds per chunk)
      const totalAnalysisSeconds = data.total_chunks * 40;
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
      
      // Calculate analysis time estimate for all chunks (40 seconds per chunk)
      const totalAnalysisSeconds = data.total_chunks * 40;
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
      addLog(`Error: Insufficient credits (${currentLimits.credits_balance} available). Please purchase more credits to continue.`);
      showNotification(
        'limit_reached',
        'Insufficient credits! Purchase more credits to analyze chunks.'
      );
      setIsProcessing(false); // Reset on error
      return;
    }

    const chunksToAnalyze = Array.from(selectedChunks);
    
    // Enforce credit limit
    const maxAllowedChunks = currentLimits.credits_balance;
    if (chunksToAnalyze.length > maxAllowedChunks) {
      addLog(`Warning: Selected ${chunksToAnalyze.length} chunks but only ${maxAllowedChunks} credits available. Limiting to ${maxAllowedChunks} chunks.`);
      chunksToAnalyze.splice(maxAllowedChunks); // Trim to available credits
    }
    
    if (chunksToAnalyze.length !== selectedChunks.size) {
      addLog(`Process ${chunksToAnalyze.length} chunks (limited by available credits)`);
    }
    
    setCurrentStep('analyzing');
    setAnalysisStartTime(Date.now());
    setLastProgressTimestamp(Date.now() / 1000); // Reset progress timestamp
    addLog(`Starting analysis of ${chunksToAnalyze.length} chunks...`);

    // Calculate time estimate for selected chunks (40 seconds per chunk)
    const selectedAnalysisSeconds = chunksToAnalyze.length * 40;
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
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setJobId(data.job_id);
      setCurrentJobId(data.job_id);
      addLog(`Analysis job started: ${data.job_id}`);
      
      // Start polling for status
      startPollingAnalysisStatus(data.job_id);
    } catch (error) {
      addLog(`Analysis failed to start: ${error}`);
      setIsProcessing(false); // Reset on error
    }
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
    
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    // Clear localStorage session
    localStorage.removeItem('ucp_process_session');
    
    addLog('Process reset');
  };

  const viewResults = () => {
    router.push('/packs');
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
                Universal Context Processor
              </h1>
              
              {/* Connection Status Indicator */}
              {isProcessing && (
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' :
                    connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                    connectionStatus === 'warning' ? 'bg-orange-500 animate-pulse' :
                    'bg-red-500'
                  }`}></div>
                  <span className={`${
                    connectionStatus === 'connected' ? 'text-green-400' :
                    connectionStatus === 'connecting' ? 'text-yellow-400' :
                    connectionStatus === 'warning' ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    {connectionStatus === 'connected' ? 'Connected to server' :
                     connectionStatus === 'connecting' ? 'Reconnecting to server...' :
                     connectionStatus === 'warning' ? 'Connection issues detected' :
                     'Server connection lost'}
                  </span>
                </div>
              )}
            </div>
          </div>
            {/* Progress Steps */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Progress</h2>
                <div className="flex items-center space-x-2">
                  {/* Server Health Check Button */}
                  {(connectionStatus !== 'connected') && (
                    <button
                      onClick={checkServerHealth}
                      disabled={connectionStatus === 'connecting'}
                      className="text-sm text-text-secondary hover:text-text-primary px-3 py-1 border border-border-secondary rounded hover:border-border-accent hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                    >
                      {connectionStatus === 'connecting' ? 'Checking...' : 'Check Server'}
                    </button>
                  )}
                  
                  {currentStep !== 'upload' && (
                    <button
                      onClick={resetProcess}
                      className="text-sm text-text-secondary hover:text-text-primary px-3 py-1 border border-border-secondary rounded hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              
              {/* Timeline Progress Indicator */}
              <div className="relative mb-8">
                
                {/* Simple Time Overview */}
                {(timeEstimate || analysisTimeEstimate || ['extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)) && (
                  <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                    <div className="text-sm font-medium text-gray-300 mb-3">Time Estimates</div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="text-center">
                        <div className="text-gray-400 mb-1">Chunk</div>
                        <div className={
                          ['chunked', 'analyzed'].includes(currentStep) 
                            ? 'text-green-400' 
                            : ['extracting', 'chunking'].includes(currentStep) 
                            ? 'text-blue-400' 
                            : 'text-gray-500'
                        }>
                          {['chunked', 'analyzed'].includes(currentStep) 
                            ? '✓ Complete' 
                            : ['extracting', 'chunking'].includes(currentStep) 
                            ? 'Processing...'
                            : timeEstimate 
                            ? timeEstimate.time_estimates.extraction.formatted 
                            : '~2-5m'
                          }
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 mb-1">Analyze</div>
                        <div className={
                          currentStep === 'analyzed' 
                            ? 'text-green-400' 
                            : currentStep === 'analyzing' 
                            ? 'text-blue-400' 
                            : 'text-gray-500'
                        }>
                          {currentStep === 'analyzed' 
                            ? '✓ Complete' 
                            : currentStep === 'analyzing' 
                            ? 'Processing...'
                            : analysisTimeEstimate 
                            ? analysisTimeEstimate.formatted 
                            : ['chunked'].includes(currentStep)
                            ? 'Ready'
                            : 'TBD'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Step icons and labels with connecting lines */}
                <div className="flex items-center justify-between relative">
                  {[
                    { key: 'upload', icon: Upload, label: 'Upload' },
                    { key: 'chunk', icon: BarChart3, label: 'Chunk' },
                    { key: 'analyze', icon: Play, label: 'Analyze' }
                  ].map((step, index) => {
                    const Icon = step.icon;
                    const isActive = 
                      (step.key === 'upload' && ['upload', 'uploaded'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['extracting', 'extracted', 'chunking', 'chunked'].includes(currentStep)) ||
                      (step.key === 'analyze' && ['analyzing', 'analyzed'].includes(currentStep));
                    
                    const isCompleted = 
                      (step.key === 'upload' && ['extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['analyzing', 'analyzed'].includes(currentStep));

                    // Show connecting line to next step if current step is completed
                    const showCompletedLine = 
                      (step.key === 'upload' && ['extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['analyzing', 'analyzed'].includes(currentStep));

                    const showActiveLine = 
                      (step.key === 'upload' && ['extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['analyzing', 'analyzed'].includes(currentStep));

                    return (
                      <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
                        {/* Connecting line to next step */}
                        {index < 2 && (
                          <div 
                            className="absolute top-5 left-1/2 w-full h-1 transition-all duration-500"
                            style={{
                              backgroundColor: showCompletedLine 
                                ? 'rgba(102, 57, 208, 1)' 
                                : showActiveLine 
                                ? 'rgba(102, 57, 208, 0.5)'
                                : 'var(--border-secondary)',
                              zIndex: 1
                            }}
                          />
                        )}
                        
                        <div 
                          className="w-10 h-10 rounded-lg border flex items-center justify-center transition-all duration-300 relative z-20"
                          style={{
                            backgroundColor: isCompleted 
                              ? 'rgba(102, 57, 208, 1)'
                              : isActive 
                              ? 'rgba(102, 57, 208, 0.2)'
                              : 'var(--bg-secondary)',
                            borderColor: isCompleted || isActive 
                              ? 'rgba(102, 57, 208, 1)'
                              : 'var(--border-primary)',
                            color: isCompleted 
                              ? 'white'
                              : isActive 
                              ? 'rgba(102, 57, 208, 1)'
                              : 'var(--text-muted)',
                            transform: isActive ? 'scale(1.1)' : 'scale(1)',
                            boxShadow: isCompleted ? '0 4px 12px rgba(102, 57, 208, 0.3)' : 'none'
                          }}
                        >
                          {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <span 
                          className="mt-3 text-sm font-medium transition-colors"
                          style={{
                            color: isActive || isCompleted ? 'var(--text-primary)' : 'var(--text-muted)'
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Upload Section */}
            {currentStep === 'upload' && (
              <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-white mb-2">Import files</h1>
                  <p className="text-gray-400">
                    Drag files or a folder into the box below, or choose an option.
                  </p>
                </div>

                {/* Main Upload Card */}
                <div className="bg-gray-900/80 backdrop-blur-sm border-2 border-dashed border-gray-600 rounded-2xl p-8 text-center transition-all duration-300 hover:border-gray-500 hover:bg-gray-900/90 mb-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.txt,.html,.csv,.zip"
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
                    className={`transition-all duration-300 ${isDragOver ? 'scale-105' : ''}`}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className={`w-12 h-12 ${isDragOver ? 'bg-blue-600' : 'bg-gray-700'} rounded-xl flex items-center justify-center mx-auto mb-4 transition-all`}>
                      <Upload className={`h-6 w-6 ${isDragOver ? 'text-white' : 'text-gray-300'}`} />
                    </div>
                    
                    <h3 className="text-lg font-medium text-white mb-8">
                      {isDragOver ? 'Drop here' : 'Upload here'}
                    </h3>
                    
                    {/* Action Buttons */}
                    <div className="space-y-4 mb-8">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-white hover:bg-gray-100 text-gray-900 py-3 px-6 rounded-xl font-medium transition-all"
                      >
                        Select files
                      </button>
                      
                      <button
                        onClick={() => folderInputRef.current?.click()}
                        className="w-full border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white hover:bg-gray-800/50 py-3 px-6 rounded-xl font-medium transition-all"
                      >
                        Upload export folder
                      </button>
                    </div>
                    
                    {/* File Types */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-full text-sm">conversations.json</span>
                      <span className="text-gray-500">·</span>
                      <span className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-full text-sm">TXT</span>
                      <span className="text-gray-500">·</span>
                      <span className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-full text-sm">HTML</span>
                      <span className="text-gray-500">·</span>
                      <span className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-full text-sm">CSV</span>
                    </div>
                    
                    {/* Helper Note */}
                    <p className="text-xs text-gray-500">
                      You can upload a ChatGPT export folder to import everything at once.
                    </p>
                  </div>
                </div>

                {/* Alternative: Conversation URL */}
                <div className="text-center mt-4">
                  <div className="inline-flex items-center space-x-2 text-gray-400 text-sm mb-4">
                    <div className="h-px bg-gray-600 w-16"></div>
                    <span>or</span>
                    <div className="h-px bg-gray-600 w-16"></div>
                  </div>
                  
                  <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 max-w-md mx-auto">
                    <h3 className="text-white font-medium mb-3">Paste GPT conversation URL</h3>
                    
                    <div className="space-y-3">
                      <input
                        type="url"
                        value={conversationUrl}
                        onChange={(e) => setConversationUrl(e.target.value)}
                        placeholder="https://chatgpt.com/share/..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:border-gray-500 focus:outline-none transition-all"
                      />
                      
                      <button
                        onClick={() => processConversationUrl(conversationUrl)}
                        disabled={!conversationUrl.trim()}
                        className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg text-sm font-medium transition-all"
                      >
                        Start extraction
                      </button>
                      
                      <p className="text-xs text-gray-500">
                        Works with ChatGPT shared links
                      </p>
                    </div>
                  </div>
                </div>
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
                      onClick={() => {
                        if (conversationUrl) {
                          setConversationUrl('');
                        } else {
                          setFile(null);
                        }
                        setCurrentStep('upload');
                        setTimeEstimate(null);
                        setCostEstimate(null);
                      }}
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
                          const availableCredits = paymentLimits ? paymentLimits.credits_balance : totalChunks;
                          const chunksToProcess = Math.min(availableCredits, totalChunks);
                          
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
                                const availableCredits = paymentLimits ? paymentLimits.credits_balance : totalChunks;
                                const chunksToProcess = Math.min(availableCredits, totalChunks);
                                
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
                <div className="flex items-center space-x-3 mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Creating Universal Context Pack</h3>
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

            {/* Process Logs */}
            {logs.length > 0 && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Terminal className="h-5 w-5 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Process Log</h3>
                </div>
                
                <div className="bg-bg-secondary rounded-lg p-4 max-h-48 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="text-sm text-text-secondary font-mono mb-1">
                      {log}
                    </div>
                  ))}
                </div>
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

              <div className="p-6 border-b border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-text-secondary">
                    {selectedChunks.size} of {availableChunks.length} chunks selected
                    {selectedChunks.size > 0 && (
                      <div className="text-blue-400 mt-1 text-xs">
                        Est. time: {(() => {
                          const seconds = selectedChunks.size * 40; // 40 seconds per chunk
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
        className="fixed top-32 right-6 z-40 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer bg-bg-card border border-border-primary text-text-primary hover:border-border-accent"
      >
        <CreditCard className="w-4 h-4" />
        <span className="text-sm font-medium">
          {paymentLimits ? 
            `${paymentLimits.credits_balance} credits available` 
            : paymentLimitsError 
              ? 'Error loading credits - Click to retry'
              : 'Loading...'}
        </span>
      </button>
    </div>
  );
}

