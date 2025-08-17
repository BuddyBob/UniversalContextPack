'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Brain, FileText, BarChart3, CheckCircle, Play, Download, Terminal, X, ExternalLink, CreditCard } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthModal from '@/components/AuthModal';
import PaymentNotification, { usePaymentNotifications } from '@/components/PaymentNotification';

interface PaymentStatus {
  plan: string
  chunks_used: number
  chunks_allowed: number
  subscription_status?: string
  plan_start_date?: string
  plan_end_date?: string
}

export default function ProcessPage() {
  const { user, session } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [extractionData, setExtractionData] = useState<any>(null);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [chunkData, setChunkData] = useState<any>(null);
  const [availableChunks, setAvailableChunks] = useState<any[]>([]);
  const [selectedChunks, setSelectedChunks] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'uploaded' | 'extracting' | 'extracted' | 'chunking' | 'chunked' | 'analyzing' | 'analyzed'>('upload');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showChunkModal, setShowChunkModal] = useState(false);
  const [sessionId] = useState(() => Date.now().toString()); // Unique session ID
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [lastProgressTimestamp, setLastProgressTimestamp] = useState<number>(0);
  const [paymentLimits, setPaymentLimits] = useState<{canProcess: boolean, chunks_used: number, chunks_allowed: number, plan?: string} | null>(null);
  const [lastPaymentCheck, setLastPaymentCheck] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
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
        console.log('Checking payment limits...'); // Debug log
        checkPaymentLimits().then((limits) => {
          console.log('Setting payment limits:', limits); // Debug log
          setPaymentLimits(limits);
        }); // Fix: Actually set the payment limits
        localStorage.setItem('last_payment_check', now.toString());
      } else {
        // If we're using cached data, still try to get limits for initial load
        if (!paymentLimits) {
          console.log('Initial payment limits check...'); // Debug log
          checkPaymentLimits().then((limits) => {
            console.log('Setting initial payment limits:', limits); // Debug log
            setPaymentLimits(limits);
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
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

  // Check payment limits when user authenticates - removed duplicate check

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const checkPaymentLimits = async () => {
    if (!session?.access_token) return { canProcess: false, chunks_used: 0, chunks_allowed: 2 };
    
    // Debounce: Don't check if we checked within the last 10 seconds, unless we don't have limits yet
    const now = Date.now()
    if (now - lastPaymentCheck < 10000 && paymentLimits) {
      console.log('Skipping payment status check - too recent')
      return paymentLimits || { canProcess: false, chunks_used: 0, chunks_allowed: 2 };
    }
    
    try {
      setLastPaymentCheck(now)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/payment/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const canProcess = data.chunks_used < data.chunks_allowed || data.plan !== 'free';
        const result = {
          canProcess,
          chunks_used: data.chunks_used,
          chunks_allowed: data.chunks_allowed,
          plan: data.plan
        };
        console.log('Payment limits loaded:', result); // Debug log
        return result;
      }
    } catch (error) {
      console.error('Error checking payment limits:', error);
    }
    
    return { canProcess: false, chunks_used: 0, chunks_allowed: 2 };
  };

  // Server-Sent Events helper function
  const startSSEWithAuth = async (url: string, headers: Record<string, string>) => {
    try {
      // Use fetch to establish the SSE connection
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...headers
        }
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
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
      // Silently fall back to status polling
    }
  };

  const startPollingAnalysisStatus = (jobId: string) => {
    // Set up the status polling with reduced frequency for better performance
    const statusInterval = setInterval(async () => {
      try {
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const statusResponse = await fetch(`http://localhost:8000/api/status/${jobId}`, { headers });
        const data = await statusResponse.json();
        
        if (data.status === 'completed') {
          clearInterval(statusInterval);
          setPollingInterval(null);
          setIsProcessing(false);
          setCurrentStep('analyzed');
        } else if (data.status === 'partial') {
          clearInterval(statusInterval);
          setPollingInterval(null);
          setIsProcessing(false);
          setCurrentStep('analyzed');
          addLog(`✅ Analysis completed with ${data.processed_chunks}/${data.total_chunks} chunks`);
          addLog('Free tier limit reached. Upgrade to Pro for complete analysis.');
          
          if (data.upgrade_required) {
            showLimitWarning(data.processed_chunks, data.chunks_to_process || 2);
          }
        } else if (data.status === 'limit_reached') {
          clearInterval(statusInterval);
          setPollingInterval(null);
          setIsProcessing(false);
          addLog('❌ Free tier limit reached. Please upgrade to Pro plan to continue.');
          
          showNotification(
            'limit_reached',
            'Free tier limit reached! Upgrade to Pro plan to analyze all chunks.',
            { 
              chunksUsed: data.chunks_used || 2, 
              chunksAllowed: data.chunks_allowed || 2 
            }
          );
        } else if (data.status === 'failed') {
          clearInterval(statusInterval);
          setPollingInterval(null);
          setIsProcessing(false);
          addLog(`❌ Analysis failed: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        // Silently handle polling errors
      }
    }, 10000); // Increased to 10 seconds for better performance
    
    setPollingInterval(statusInterval);
    
    // Set up Server-Sent Events for real-time progress
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const url = `http://localhost:8000/api/progress-stream/${jobId}`;
      
      // Start SSE with authentication
      startSSEWithAuth(url, headers);
      
    } catch (error) {
      // Silently fall back to status polling only
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check if user is authenticated before allowing file upload
      if (!user) {
        setShowAuthModal(true);
        // Reset the file input
        if (event.target) {
          event.target.value = '';
        }
        return;
      }
      
      setFile(selectedFile);
      setCurrentStep('uploaded');
      addLog(`File selected: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

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

      const response = await fetch('http://localhost:8000/api/extract', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setExtractionData(data);
      setJobId(data.job_id);
      setCurrentJobId(data.job_id);
      setCostEstimate(data.cost_estimate);
      setCurrentStep('extracted');
      addLog(`Extraction complete: ${data.conversation_count} conversations, ${data.message_count} messages`);
    } catch (error) {
      addLog(`Extraction failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChunk = async () => {
    if (!extractionData || !currentJobId) return;

    setIsProcessing(true);
    setCurrentStep('chunking');
    addLog('Creating semantic chunks...');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`http://localhost:8000/api/chunk/${currentJobId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          extracted_file: extractionData.extracted_file,
          chunk_size: 8000,
          overlap: 200,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setChunkData(data);
      setAvailableChunks(data.chunks);
      setCurrentStep('chunked');
      addLog(`Chunking complete! Created ${data.total_chunks} chunks ready for analysis`);
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

    // Check payment limits before starting analysis
    const currentLimits = await checkPaymentLimits();
    setPaymentLimits(currentLimits); // Update the state as well
    if (!currentLimits.canProcess) {
      addLog(`Error: Free tier limit reached (${currentLimits.chunks_used}/${currentLimits.chunks_allowed}). Please upgrade to Pro plan to continue.`);
      showNotification(
        'limit_reached',
        'Free tier limit reached! Upgrade to Pro plan to analyze chunks.',
        { 
          chunksUsed: currentLimits.chunks_used, 
          chunksAllowed: currentLimits.chunks_allowed 
        }
      );
      setIsProcessing(false); // Reset on error
      return;
    }

    const chunksToAnalyze = Array.from(selectedChunks);
    setCurrentStep('analyzing');
    setAnalysisStartTime(Date.now());
    setLastProgressTimestamp(Date.now() / 1000); // Reset progress timestamp
    addLog(`Starting analysis of ${chunksToAnalyze.length} chunks...`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`http://localhost:8000/api/analyze/${currentJobId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chunk_file: chunkData.chunk_file,
          chunk_indices: chunksToAnalyze,
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
    if (!currentJobId) return;
    
    try {
      addLog('Starting pack download...');
      
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`http://localhost:8000/api/download/${currentJobId}/pack`, {
        headers,
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
      setShowDownloadModal(false);
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
        chunksUsed={notification.chunksUsed}
        chunksAllowed={notification.chunksAllowed}
        onClose={hideNotification}
        onUpgrade={() => router.push('/pricing')}
        autoHide={false}
      />

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Universal Context Processor
          </h1>
          <p className="text-text-secondary">
            Extract, chunk, and analyze your conversation data with professional AI tools
          </p>
        </div>

        {/* Welcome Section for Non-Authenticated Users */}
        {!user && (
          <div className="mb-8">
            <div className="bg-bg-card border border-border-primary rounded-lg p-8 text-center">
              <h2 className="text-xl font-semibold text-text-primary mb-4">
                Transform your chat exports into AI-ready context packs
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-5 w-5 text-accent-primary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">Smart Extraction</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <BarChart3 className="h-5 w-5 text-accent-primary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">Smart Chunking</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Brain className="h-5 w-5 text-accent-primary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">AI Analysis</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Play className="h-5 w-5 text-accent-primary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">Ready-to-Use Packs</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-bg-secondary border border-border-primary text-text-primary px-6 py-3 rounded-lg font-medium hover:bg-bg-tertiary hover:border-border-accent transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        )}

        {/* Main Content for Authenticated Users */}
        {user && (
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="bg-bg-card border border-border-primary rounded-lg p-6">
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
                
                {/* Step icons and labels with connecting lines */}
                <div className="flex items-center justify-between relative">
                  {[
                    { key: 'upload', icon: Upload, label: 'Upload' },
                    { key: 'extract', icon: FileText, label: 'Extract' },
                    { key: 'chunk', icon: BarChart3, label: 'Chunk' },
                    { key: 'analyze', icon: Play, label: 'Analyze' }
                  ].map((step, index) => {
                    const Icon = step.icon;
                    const isActive = 
                      (step.key === 'upload' && ['upload', 'uploaded', 'extracting'].includes(currentStep)) ||
                      (step.key === 'extract' && ['extracting', 'extracted', 'chunking'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['chunking', 'chunked', 'analyzing'].includes(currentStep)) ||
                      (step.key === 'analyze' && ['analyzing', 'analyzed'].includes(currentStep));
                    
                    const isCompleted = 
                      (step.key === 'upload' && ['extracted', 'chunked', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'extract' && ['chunked', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['analyzed'].includes(currentStep));

                    // Show connecting line to next step if current step is completed
                    const showCompletedLine = 
                      (step.key === 'upload' && ['extracted', 'chunked', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'extract' && ['chunked', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['analyzed'].includes(currentStep));

                    const showActiveLine = 
                      (step.key === 'upload' && ['extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'extract' && ['chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)) ||
                      (step.key === 'chunk' && ['analyzing', 'analyzed'].includes(currentStep));

                    return (
                      <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
                        {/* Connecting line to next step */}
                        {index < 3 && (
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
              <div className="bg-bg-card border border-border-primary rounded-lg p-8 text-center">
                <div className="w-16 h-16 bg-accent-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-accent-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">Upload Document</h3>
                <p className="text-text-secondary mb-6">JSON, TXT, CSV, ZIP, and HTML formats supported</p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt,.csv,.zip,.html"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-bg-secondary border border-border-primary text-text-primary px-6 py-3 rounded-lg font-medium hover:bg-bg-tertiary hover:border-border-accent transition-colors"
                >
                  Choose File
                </button>
              </div>
            )}

            {/* File Selected */}
            {file && currentStep === 'uploaded' && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">File Selected</h3>
                </div>
                
                <div className="flex items-center space-x-4 mb-6 p-4 bg-bg-secondary rounded-lg">
                  <FileText className="h-8 w-8 text-accent-primary" />
                  <div>
                    <p className="font-medium text-text-primary">{file.name}</p>
                    <p className="text-sm text-text-secondary">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleExtract}
                  disabled={isProcessing}
                  className="bg-bg-secondary border border-border-primary text-text-primary px-6 py-3 rounded-lg font-medium hover:bg-bg-tertiary hover:border-border-accent transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>Extract Content</span>
                </button>
              </div>
            )}

            {/* Extraction Complete */}
            {extractionData && currentStep === 'extracted' && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Extraction Complete</h3>
                </div>

      

                <div className="p-4 bg-accent-primary/5 border border-accent-primary/20 rounded-lg mb-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-accent-primary" />
                    <div className="text-sm font-medium text-text-primary">Successfully extracted your context</div>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Your chat export is ready for chunking
                  </div>
                </div>

                {costEstimate && (
                  <div className="p-4 bg-bg-secondary rounded-lg mb-6">
                    <div className="text-sm font-medium text-text-primary mb-2">Estimated Cost</div>
                    <div className="text-lg font-bold text-text-primary">
                      ${costEstimate.estimated_total_cost.toFixed(4)}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {costEstimate.estimated_output_tokens.toLocaleString()} output tokens estimated
                    </div>
                  </div>
                )}

                <button
                  onClick={handleChunk}
                  disabled={isProcessing}
                  className="bg-bg-secondary border border-border-primary text-text-primary px-6 py-3 rounded-lg font-medium hover:bg-bg-tertiary hover:border-border-accent transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Create Chunks</span>
                </button>
              </div>
            )}

            {/* Chunk Actions */}
            {['chunked', 'analyzing', 'analyzed'].includes(currentStep) && chunkData && (
              <div className="bg-bg-card border border-border-primary rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Chunking Complete</h3>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowChunkModal(true)}
                    className="px-4 py-2 border border-border-secondary rounded-lg text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors flex items-center space-x-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>Select Chunks</span>
                  </button>

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
                      className="bg-bg-secondary border border-border-primary text-text-primary px-6 py-2 rounded-lg font-medium hover:bg-bg-tertiary hover:border-border-accent transition-colors disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Play className="h-4 w-4" />
                      <span>
                        {(paymentLimits && !paymentLimits.canProcess)
                          ? 'AI Analysis Limit Reached'
                          : selectedChunks.size > 0
                          ? `Analyze Selected (${selectedChunks.size})`
                          : `Analyze All (${availableChunks.length})`
                        }
                      </span>
                    </button>
                  )}
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
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Progress</span>
                    <span className="text-text-primary font-medium">{progress}%</span>
                  </div>
                  <div className="w-full bg-bg-secondary rounded-full h-2">
                    <div 
                      className="bg-accent-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  {analysisStartTime && (
                    <div className="text-sm text-text-secondary">
                      Elapsed: {Math.round((Date.now() - analysisStartTime) / 1000)}s
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
                    onClick={() => setShowDownloadModal(true)}
                    className="px-6 py-3 border border-border-secondary rounded-lg text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Pack</span>
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
        )}

        {/* Chunk Selection Modal */}
        {showChunkModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Select Chunks to Analyze</h3>
                <button
                  onClick={() => setShowChunkModal(false)}
                  className="modal-close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="chunk-selection-header">
                <div className="chunk-selection-info">
                  {selectedChunks.size} of {availableChunks.length} chunks selected
                </div>
                <div className="chunk-selection-actions">
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

              <div className="chunk-list">
                {availableChunks.map((chunk, index) => (
                  <div
                    key={index}
                    className={`chunk-item ${
                      selectedChunks.has(index) ? 'chunk-item-selected' : ''
                    }`}
                    onClick={() => handleChunkToggle(index)}
                  >
                    <div className="chunk-item-content">
                      <div className="chunk-item-info">
                        <div className="chunk-item-title">
                          Chunk {index + 1}
                        </div>
                        <div className="chunk-item-tokens">
                          {chunk.token_count || 0} tokens
                        </div>
                        <div className="chunk-item-preview">
                          {chunk.preview || 'No content available'}
                        </div>
                      </div>
                      <div className={`chunk-item-checkbox ${
                        selectedChunks.has(index) ? 'chunk-item-checkbox-selected' : ''
                      }`}>
                        {selectedChunks.has(index) && (
                          <CheckCircle className="h-3 w-3 text-text-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
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
                  className="px-4 py-2 bg-bg-secondary border border-border-primary text-text-primary rounded-lg hover:bg-bg-tertiary hover:border-border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    (paymentLimits && !paymentLimits.canProcess)
                    ? `Free tier limit reached (${paymentLimits.chunks_used}/${paymentLimits.chunks_allowed}). Upgrade to Pro to continue.`
                    : ''
                  }
                >
                  {(paymentLimits && !paymentLimits.canProcess)
                    ? `Limit Reached (${paymentLimits.chunks_used}/${paymentLimits.chunks_allowed})`
                    : `Analyze Selected (${selectedChunks.size})`
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download Modal */}
        {showDownloadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="content-card max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Download Pack</h3>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <p className="text-text-secondary mb-6">
                Your analysis pack is ready for download. This includes the original data, chunks, and AI analysis results.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="px-4 py-2 border border-border-secondary rounded-lg text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={downloadPack}
                  className="px-4 py-2 bg-bg-secondary border border-border-primary text-text-primary rounded-lg hover:bg-bg-tertiary hover:border-border-accent transition-colors flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Chunk Selection Modal */}
        {showChunkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-bg-card border border-border-primary rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
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

        {/* Download Modal */}
        {showDownloadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-bg-card border border-border-primary rounded-lg max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b border-border-primary">
                <h3 className="text-lg font-semibold text-text-primary">Download Pack</h3>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6">
                <p className="text-text-secondary mb-6">
                  Your analysis pack is ready for download. This includes the original data, chunks, and AI analysis results.
                </p>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="px-4 py-2 border border-border-primary rounded-lg text-text-primary hover:border-border-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={downloadPack}
                    className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Floating Payment Button */}
      <button
        onClick={() => router.push('/pricing')}
        className="fixed top-24 right-6 z-40 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer bg-bg-card border border-border-primary text-text-primary hover:border-border-accent"
      >
        <CreditCard className="w-4 h-4" />
        <span className="text-sm font-medium">
          {paymentLimits ? 
            `${paymentLimits.chunks_used}/${paymentLimits.chunks_allowed === 999999 ? '∞' : paymentLimits.chunks_allowed} chunks used` 
            : 'Loading...'}
        </span>
      </button>
    </div>
  );
}

