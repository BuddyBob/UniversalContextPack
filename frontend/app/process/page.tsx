'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Brain, FileText, BarChart3, CheckCircle, Play, Download, Terminal, X, ExternalLink, CreditCard, Loader } from 'lucide-react';
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
  const [paymentLimits, setPaymentLimits] = useState<{canProcess: boolean, credits_balance: number, plan?: string} | null>(null);
  const [paymentLimitsError, setPaymentLimitsError] = useState<boolean>(false);
  const [lastPaymentCheck, setLastPaymentCheck] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const paymentLimitsRequestRef = useRef<Promise<any> | null>(null);
  const router = useRouter();

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
        sessionId
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
        sessionId
      };
      localStorage.setItem('ucp_process_session', JSON.stringify(session));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentStep, extractionData, costEstimate, chunkData, availableChunks, selectedChunks, progress, logs, currentJobId, analysisStartTime, sessionId]);

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

  // Extracted function to perform the actual extraction logic
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
    if (!file) return;

    // Check if user is authenticated - if not, show auth modal
    if (!user) {
      setPendingExtraction(true); // Mark that we want to extract after auth
      setShowAuthModal(true);
      addLog('Please sign in to continue with extraction...');
      return;
    }

    // User is authenticated, proceed with extraction
    await performExtraction();
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
    const maxFailures = 3;
    const startTime = Date.now();
    const maxPollingDuration = 30 * 60 * 1000; // 30 minutes max
    
    // Set up the status polling with exponential backoff
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
        const statusResponse = await makeAuthenticatedRequest(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/status/${jobId}`,
          {
            method: 'GET'
          }
        );
        
        if (!statusResponse.ok) {
          consecutiveFailures++;
          if (statusResponse.status === 403) {
            console.error('Authentication failed for status check - token may be expired');
            addLog('Warning: Authentication error checking status. You may need to refresh the page.');
          } else {
            console.error('Status check failed:', statusResponse.status, statusResponse.statusText);
          }
          
          // Stop polling after too many failures
          if (consecutiveFailures >= maxFailures) {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            return;
          }
          return; // Skip processing if request failed
        }
        
        // Reset failure count on success
        consecutiveFailures = 0;
        
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
    // Poll for extraction completion
    const statusInterval = setInterval(async () => {
      try {
        // Check if extraction is complete by looking for job results
        const resultsResponse = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/results/${jobId}`, {
          method: 'GET'
        });
        
        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          
          if (resultsData.extracted) {
            clearInterval(statusInterval);
            setPollingInterval(null);
            
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
          }
        }
      } catch (error) {
        // Handle authentication errors more gracefully
        if (error instanceof Error && error.message.includes('Authentication')) {
          addLog('Warning: Authentication error during extraction status check. You may need to refresh the page.');
          clearInterval(statusInterval);
          setPollingInterval(null);
        }
        // Silently handle other polling errors, continue polling
      }
    }, 3000); // Poll every 3 seconds for extraction
    
    setPollingInterval(statusInterval);
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

  const processSelectedFile = async (selectedFile: File) => {
    setFile(selectedFile);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFile = droppedFiles.find(file => 
      ['.json', '.txt', '.csv', '.zip', '.html', '.htm'].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )
    );
    
    if (validFile) {
      processSelectedFile(validFile);
    } else {
      addLog('Please drop a valid file: .json, .txt, .csv, .zip, or .html');
    }
  };

  const handleChunk = async () => {
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
    if (!chunkData || selectedChunks.size === 0 || !currentJobId) {
      setIsProcessing(false); // Reset if invalid state
      return;
    }

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

  const resetProcess = () => {
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
    if (currentJobId) {
      router.push(`/results/${currentJobId}`);
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Payment Notification */}
      <PaymentNotification
        show={notification.show}
        type={notification.type}
        message={notification.message}
        onClose={hideNotification}
        onUpgrade={() => router.push('/pricing')}
        autoHide={false}
      />

      
      <div className="max-w-6xl mx-auto p-6">
        {/* Main Content - Always Show Interface */}
        <div className="space-y-6">
          <div className="w-full flex justify-center items-center py-8">
            <h1 className="text-3xl font-bold text-white text-center">
              Universal Context Processor
            </h1>
          </div>
            {/* Progress Steps */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Progress</h2>
                {currentStep !== 'upload' && (
                  <button
                    onClick={resetProcess}
                    className="text-sm text-text-secondary hover:text-text-primary px-3 py-1 border border-border-secondary rounded hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
              
              {/* Timeline Progress Indicator */}
              <div className="relative mb-8">
                
                {/* Simple Time Overview */}
                {(timeEstimate || analysisTimeEstimate || ['extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)) && (
                  <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                    <div className="text-sm font-medium text-gray-300 mb-3">Time Estimates - 10-20 min depending on conversation sizes</div>

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
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8 text-accent-primary" />
                  </div>
                  <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3 text-sm">
                    <p className="text-gray-300">
                      <span className="font-medium">Upload:</span> <span className="font-mono text-accent-primary">conversations.json</span> for faster processing
                    </p>
                  </div>
                </div>

                {/* Upload Area */}
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragOver 
                      ? 'border-accent-primary bg-accent-primary/5' 
                      : 'border-gray-500 hover:border-accent-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.txt,.html"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="bg-accent-primary hover:bg-accent-primary-hover text-white px-8 py-4 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                  >
                    <Upload className="h-5 w-5" />
                    <span>Choose File</span>
                  </button>
                  
                  <p className="text-text-muted text-sm mt-4">
                    Or drag and drop here
                  </p>
                </div>
              </div>
            )}

            {/* File Selected */}
            {file && currentStep === 'uploaded' && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">File Ready</h3>
                </div>
                
                <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-700 rounded-lg">
                  <FileText className="h-8 w-8 text-accent-primary" />
                  <div>
                    <p className="font-medium text-text-primary">{file.name}</p>
                    <p className="text-sm text-text-secondary">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {/* Simple Time Estimates Display */}
                    <div className="mt-3 space-y-1">
                      {timeEstimate && (
                        <div className="flex items-center text-xs text-gray-400">
                          <span className="w-16">Chunk:</span>
                          <span>{timeEstimate.time_estimates.extraction.formatted}</span>
                        </div>
                      )}
                      <div className="flex items-center text-xs text-gray-400">
                        <span className="w-16">Analyze:</span>
                        <span>Estimated after extraction</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExtract}
                  disabled={isProcessing}
                  className="bg-gray-700 border border-gray-600 text-text-primary px-6 py-3 rounded-lg font-medium hover:bg-gray-600 hover:border-border-accent transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>Chunk Content</span>
                </button>
              </div>
            )}

            {/* Chunking Progress */}
            {currentStep === 'chunking' && (
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Creating Chunks</h3>
                    <p className="text-text-secondary text-sm">Breaking your content into semantic chunks for analysis...</p>
                  </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="text-sm text-blue-300">⚡ Processing your content with optimized 150k token chunks</div>
                </div>
              </div>
            )}

            {/* Chunk Actions */}
            {['chunked', 'analyzing', 'analyzed'].includes(currentStep) && chunkData && (
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Chunks Ready</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Your conversation has been broken into {chunkData.total_chunks} optimized chunks. Choose your next step:
                    </p>
                    
                    {/* Simple Options */}
                    <div className="mt-6 space-y-3">
                      
                      <div className="p-4 bg-gray-750 rounded-lg border border-gray-600">
                        <div className="flex items-center space-x-3">
                          <Brain className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="font-medium text-white">AI Analysis</div>
                            <div className="text-sm text-gray-400">Get patterns, themes & insights</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  {currentStep === 'chunked' && (
                    <button
                      onClick={() => {
                        if (isProcessing) return; // Prevent double-clicks
                        
                        if (selectedChunks.size === 0) {
                          const allChunkIds = new Set(availableChunks.map((_, index) => index));
                          setSelectedChunks(allChunkIds);
                          setIsProcessing(true); // Set immediately
                          setTimeout(() => handleAnalyze(), 100);
                        } else {
                          setIsProcessing(true); // Set immediately
                          handleAnalyze();
                        }
                      }}
                      disabled={isProcessing || Boolean(paymentLimits && !paymentLimits.canProcess)}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 font-medium shadow-lg"
                    >
                      <Brain className="h-5 w-5" />
                      <span>
                        {(paymentLimits && !paymentLimits.canProcess)
                          ? 'Analysis Limit Reached'
                          : `Start AI Analysis (${availableChunks.length})`
                        }
                      </span>
                    </button>
                  )}

                  <button
                    onClick={downloadChunks}
                    disabled={isDownloading}
                    className="py-3 px-4 border border-gray-600 rounded-lg text-gray-400 hover:text-gray-300 hover:border-gray-500 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isDownloading ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>{isDownloading ? 'Downloading...' : 'Download Chunks'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Analysis Progress */}
            {currentStep === 'analyzing' && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Terminal className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Analysis in Progress</h3>
                </div>
                
                <div className="space-y-3">
                  {/* Simple Time Overview */}
                  <div className="grid grid-cols-3 gap-4 text-xs text-gray-400 mb-4">
                    <div className="text-center">
                      <div className="font-medium">Chunk</div>
                      <div className="text-green-400">✓ Complete</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">Chunk</div>
                      <div className="text-green-400">✓ Complete</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">Analyze</div>
                      <div className="text-blue-400">In Progress</div>
                    </div>
                  </div>
                  
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

            {/* Analysis Complete */}
            {currentStep === 'analyzed' && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Analysis Complete</h3>
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
                    <span>{isDownloading ? 'Downloading...' : 'Download Pack'}</span>
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
                <h3 className="text-lg font-semibold text-text-primary">Select Chunks to Analyze</h3>
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
                        ? 'border-blue-400 bg-blue-500/20' 
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
                        selectedChunks.has(index) ? 'border-accent-primary bg-accent-primary' : 'border-gray-500'
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
                    : `Analyze Selected (${selectedChunks.size})`
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
                <h3 className="text-lg font-semibold text-text-primary">Select Chunks to Analyze</h3>
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
                        ? 'border-accent-primary bg-accent-primary/5' 
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
                          ? 'border-accent-primary bg-accent-primary text-white' 
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
                    : `Analyze Selected (${selectedChunks.size})`
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

