'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, BarChart3, CheckCircle, Play, Download, Terminal, X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthModal from '@/components/AuthModal';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  // Save session to localStorage whenever state changes
  useEffect(() => {
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
  }, [currentStep, extractionData, costEstimate, chunkData, availableChunks, selectedChunks, progress, logs, currentJobId, analysisStartTime, sessionId]);

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

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const hasApiKey = async () => {
    if (!session?.access_token) return false;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.profile?.has_openai_key || false;
      }
    } catch (error) {
      console.error('Error checking API key:', error);
    }
    
    return false;
  };

  const startPollingAnalysisStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const headers: Record<string, string> = {};
        
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`http://localhost:8000/api/status/${jobId}`, {
          headers,
        });
        const data = await response.json();
        
        if (data.status === 'completed') {
          clearInterval(interval);
          setPollingInterval(null);
          setIsProcessing(false);
          setCurrentStep('analyzed');
          addLog('Analysis completed successfully!');
          addLog('Pack available in your collection');
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPollingInterval(null);
          setIsProcessing(false);
          addLog(`Analysis failed: ${data.error || 'Unknown error'}`);
        } else {
          addLog(`Analysis status: ${data.status}`);
          if (data.progress) {
            setProgress(data.progress);
          }
        }
      } catch (error) {
        addLog(`Error checking status: ${error}`);
      }
    }, 2000);
    
    setPollingInterval(interval);
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
      addLog(`Chunking complete: ${data.chunks.length} chunks created`);
    } catch (error) {
      addLog(`Chunking failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!chunkData || selectedChunks.size === 0 || !currentJobId) return;

    // Check if user has API key saved in profile
    const userHasApiKey = await hasApiKey();
    if (!userHasApiKey) {
      addLog('Error: OpenAI API key not found. Please add your API key in the profile menu.');
      return;
    }

    const chunksToAnalyze = Array.from(selectedChunks);
    setIsProcessing(true);
    setCurrentStep('analyzing');
    setAnalysisStartTime(Date.now());
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
      setIsProcessing(false);
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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 style={{fontSize: '32px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em'}}>
            Universal Context Processor
          </h1>
          <p style={{fontSize: '16px', color: 'var(--text-secondary)', fontWeight: '400'}}>
            Extract, chunk, and analyze your conversation data with professional AI tools
          </p>
        </div>

        {/* What You'll Get Section */}
        {!user && (
          <div className="content-card">
            <h3 className="text-lg font-semibold mb-3">What you'll get with UCP:</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-accent-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="h-3 w-3 text-text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Smart Extraction</p>
                  <p className="text-text-secondary">AI extracts key conversations and context from your chat exports</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-accent-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 className="h-3 w-3 text-text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Smart Chunking</p>
                  <p className="text-text-secondary">Intelligent text splitting optimized for AI context windows</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-accent-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Play className="h-3 w-3 text-text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Ready-to-Use Packs</p>
                  <p className="text-text-secondary">Get downloadable context packs for ChatGPT, Claude, or any AI</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-accent-primary rounded border border-border-primary">
              <p className="text-sm text-text-secondary">
                <span className="font-medium">Sign in required:</span> To protect your data and provide personalized processing, you'll need to sign in with Google when uploading files.
              </p>
            </div>
          </div>
        )}

        {/* Main Content - Only show when user is logged in */}
        {user && (
          <div>
            {/* Progress Timeline */}
            <div className="content-card">
              <div className="flex items-center justify-between mb-8">
                <h2 style={{fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em'}}>
                  Progress
                </h2>
                {currentStep !== 'upload' && (
                  <button
                    onClick={resetProcess}
                    className="btn-secondary-improved"
                    style={{width: 'auto', padding: '8px 16px', fontSize: '14px'}}
                  >
                    Reset
                  </button>
                )}
              </div>
              
              {/* Timeline Container */}
              <div className="relative">
                {/* Background Timeline Line */}
                <div className="absolute top-8 left-0 right-0 h-0.5 bg-border-primary"></div>
                
                {/* Progress Line */}
                <div 
                  className="absolute top-8 left-0 h-0.5 bg-purple-300 transition-all duration-1000 ease-out"
                  style={{
                    width: (() => {
                      const steps = ['upload', 'uploaded', 'extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'];
                      const currentIndex = steps.findIndex(step => 
                        step === currentStep || 
                        (currentStep === 'extracting' && step === 'uploaded') ||
                        (currentStep === 'chunking' && step === 'extracted') ||
                        (currentStep === 'analyzing' && step === 'chunked')
                      );
                      const progressSteps = ['upload', 'extracted', 'chunked', 'analyzed'];
                      const progressIndex = progressSteps.findIndex(step => 
                        step === currentStep ||
                        (['uploaded', 'extracting'].includes(currentStep) && step === 'upload') ||
                        (['chunking'].includes(currentStep) && step === 'extracted') ||
                        (['analyzing'].includes(currentStep) && step === 'chunked')
                      );
                      return `${Math.max(0, (progressIndex / (progressSteps.length - 1)) * 100)}%`;
                    })()
                  }}
                ></div>
                
                {/* Timeline Steps */}
                <div className="flex justify-between relative">
                  {/* Upload Step */}
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      ['uploaded', 'extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)
                        ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' 
                        : currentStep === 'upload'
                        ? 'bg-purple-100 border-purple-400 text-purple-700 shadow-md ring-2 ring-purple-200'
                        : 'bg-bg-secondary border-border-primary text-text-muted'
                    }`}>
                      <Upload className="h-6 w-6" />
                    </div>
                    <span className={`mt-3 text-sm font-normal transition-colors ${
                      ['upload', 'uploaded', 'extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)
                        ? 'text-text-primary' 
                        : 'text-text-muted'
                    }`}>
                      Upload
                    </span>
                  </div>

                  {/* Extract Step */}
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      ['extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)
                        ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' 
                        : currentStep === 'extracting'
                        ? 'bg-purple-100 border-purple-400 text-purple-700 shadow-md ring-2 ring-purple-200'
                        : 'bg-bg-secondary border-border-primary text-text-muted'
                    }`}>
                      <FileText className="h-6 w-6" />
                    </div>
                    <span className={`mt-3 text-sm font-normal transition-colors ${
                      ['extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)
                        ? 'text-text-primary' 
                        : 'text-text-muted'
                    }`}>
                      Extract
                    </span>
                  </div>

                  {/* Chunk Step */}
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      ['chunked', 'analyzing', 'analyzed'].includes(currentStep)
                        ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' 
                        : currentStep === 'chunking'
                        ? 'bg-purple-100 border-purple-400 text-purple-700 shadow-md ring-2 ring-purple-200'
                        : 'bg-bg-secondary border-border-primary text-text-muted'
                    }`}>
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <span className={`mt-3 text-sm font-normal transition-colors ${
                      ['chunking', 'chunked', 'analyzing', 'analyzed'].includes(currentStep)
                        ? 'text-text-primary' 
                        : 'text-text-muted'
                    }`}>
                      Chunk
                    </span>
                  </div>

                  {/* Analyze Step */}
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      currentStep === 'analyzed'
                        ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' 
                        : currentStep === 'analyzing'
                        ? 'bg-purple-100 border-purple-400 text-purple-700 shadow-md ring-2 ring-purple-200'
                        : 'bg-bg-secondary border-border-primary text-text-muted'
                    }`}>
                      <Play className="h-6 w-6" />
                    </div>
                    <span className={`mt-3 text-sm font-normal transition-colors ${
                      ['analyzing', 'analyzed'].includes(currentStep)
                        ? 'text-text-primary' 
                        : 'text-text-muted'
                    }`}>
                      Analyze
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Section */}
            {currentStep === 'upload' && (
              <div className="upload-card">
                <div className="upload-icon">
                  <Upload className="h-8 w-8" />
                </div>
                <h2 className="upload-title">Upload Document</h2>
                <p className="upload-description">JSON, TXT, CSV, ZIP, and HTML formats supported</p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt,.csv,.zip,.html"
                  onChange={handleFileSelect}
                  className="upload-input"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="upload-button"
                >
                  Choose File
                </button>
              </div>
            )}

            {/* File Selected */}
            {file && currentStep === 'uploaded' && (
              <div className="content-card">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="step-icon step-complete">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <h2 style={{fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em'}}>
                    File Selected
                  </h2>
                </div>
                
                <div className="flex items-center space-x-4 mb-6">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-primary font-medium">{file.name}</p>
                    <p className="text-secondary text-sm">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleExtract}
                  disabled={isProcessing}
                  className="btn-primary-improved"
                >
                  <FileText className="h-4 w-4" />
                  Extract Content
                </button>
              </div>
            )}

            {/* Extraction Complete */}
            {extractionData && currentStep === 'extracted' && (
              <div className="content-card">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="step-icon step-complete">
                    <FileText className="h-4 w-4" />
                  </div>
                  <h2 style={{fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em'}}>
                    Extraction Complete
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="stat-card">
                    <div className="stat-number">{extractionData.conversation_count}</div>
                    <div className="stat-label">Conversations</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{extractionData.message_count}</div>
                    <div className="stat-label">Messages</div>
                  </div>
                </div>

                {costEstimate && (
                  <div className="cost-estimate">
                    <div className="cost-title">Estimated Costs</div>
                    <div className="cost-details">
                      <div className="cost-item">
                        <span>Input:</span>
                        <span>${costEstimate.estimated_input_cost.toFixed(4)}</span>
                      </div>
                      <div className="cost-item">
                        <span>Output:</span>
                        <span>${costEstimate.estimated_output_cost.toFixed(4)}</span>
                      </div>
                      <div className="cost-item cost-total">
                        <span>Total:</span>
                        <span>${costEstimate.estimated_total_cost.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="cost-note">
                      Estimate includes {costEstimate.estimated_output_tokens.toLocaleString()} output tokens at $0.400/1M tokens
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <button
                    onClick={handleChunk}
                    disabled={isProcessing}
                    className="btn-primary-improved"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Create Chunks
                  </button>
                </div>
              </div>
            )}

            {/* Chunk Actions */}
            {['chunked', 'analyzing', 'analyzed'].includes(currentStep) && chunkData && (
              <div className="content-card">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="step-icon step-complete">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <h2 className="text-xl">Chunking Complete</h2>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowChunkModal(true)}
                    className="btn-secondary-improved"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Select Chunks
                  </button>

                  {currentStep === 'chunked' && (
                    <button
                      onClick={() => {
                        if (selectedChunks.size === 0) {
                          // If no chunks selected, select all chunks automatically
                          const allChunkIds = new Set(availableChunks.map((_, index) => index));
                          setSelectedChunks(allChunkIds);
                          // Then analyze
                          setTimeout(() => handleAnalyze(), 100);
                        } else {
                          handleAnalyze();
                        }
                      }}
                      disabled={isProcessing || !hasApiKey()}
                      className={`btn-primary-improved ${
                        !hasApiKey() ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={!hasApiKey() ? 'Please add your OpenAI API key in the profile menu' : ''}
                    >
                      <Play className="h-4 w-4" />
                      {!hasApiKey() 
                        ? 'API Key Required' 
                        : selectedChunks.size > 0
                        ? `Analyze Selected (${selectedChunks.size})`
                        : `Analyze All Chunks (${availableChunks.length})`
                      }
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Analysis Progress */}
            {currentStep === 'analyzing' && (
              <div className="content-card">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="step-icon">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <h2 className="text-xl">Analysis in Progress</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="text-gray-900">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  {analysisStartTime && (
                    <div className="text-sm text-gray-500">
                      Elapsed: {Math.round((Date.now() - analysisStartTime) / 1000)}s
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analysis Complete */}
            {currentStep === 'analyzed' && (
              <div className="content-card">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="step-icon step-complete">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <h2 className="text-xl">Analysis Complete</h2>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={viewResults}
                    className="btn-primary-improved"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Results
                  </button>
                  <button
                    onClick={() => setShowDownloadModal(true)}
                    className="btn-secondary-improved"
                  >
                    <Download className="h-4 w-4" />
                    Download Pack
                  </button>
                </div>
              </div>
            )}

            {/* Process Logs */}
            {logs.length > 0 && (
              <div className="content-card">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="step-icon">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg">Process Log</h2>
                </div>
                
                <div className="log-container">
                  {logs.map((log, index) => (
                    <div key={index} className="log-entry">
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
                    className="btn-secondary-improved"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleSelectAll}
                    className="btn-primary-improved"
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
                  className="btn-secondary-improved"
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
                  disabled={selectedChunks.size === 0}
                  className="btn-primary-improved disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analyze Selected ({selectedChunks.size})
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
                  className="btn-secondary-improved"
                >
                  Cancel
                </button>
                <button
                  onClick={downloadPack}
                  className="btn-primary-improved"
                >
                  <Download className="h-4 w-4" />
                  Download
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
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

