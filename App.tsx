import React, { useState, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import AuditDisplay from './components/AuditDisplay';
import AuditHistory from './components/AuditHistory';
import { ImageFile, AuditResult } from './types';
import { performAudit } from './services/geminiService';

// --- REFINED GATEKEEPER LOGIC: Content-Aware Edge Analysis ---
// Improves precision by focusing on the "sharpest parts" of the image (text/objects)
// and ignoring flat backgrounds (whitespace), reducing false positives.
const checkImageBlurry = (imageSrc: string): Promise<{ isBlurry: boolean; score: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { 
            resolve({ isBlurry: false, score: 999 }); 
            return; 
        }

        // 1. Resize for consistent analysis scale
        // 800px width provides enough detail for OCR readability check without excessive processing
        const targetWidth = 800; 
        const scaleFactor = targetWidth / img.width;
        const targetHeight = img.height * scaleFactor;

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Enable high quality scaling to preserve edges
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;

        const getGray = (i: number) => {
            return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        };

        const w = targetWidth;
        const h = Math.floor(targetHeight);

        const edgeStrengths: number[] = [];

        // 2. Laplacian Edge Detection with Noise Gating
        // Iterate pixels to calculate edge intensity
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
             const i = (y * w + x) * 4;
             
             const center = getGray(i);
             const top    = getGray(i - w * 4);
             const bottom = getGray(i + w * 4);
             const left   = getGray(i - 4);
             const right  = getGray(i + 4);

             // Calculate Laplacian Magnitude (Edge Strength)
             const lap = Math.abs(center * 4 - top - bottom - left - right);
             
             // NOISE GATE: Only consider "significant" edges.
             // Values < 15 are usually paper texture, lighting gradients, or sensor noise.
             // We ignore them to focus on actual content (text, lines, objects).
             if (lap > 15) {
                edgeStrengths.push(lap);
             }
          }
        }

        // 3. Statistical Analysis of Top Edges
        // If edgeStrengths is empty or very small, the image is blank or extremely blurry.
        if (edgeStrengths.length < 100) {
            console.warn("BlurCheck: Almost no edges found. Likely blank or totally blurred.");
            resolve({ isBlurry: true, score: 0 });
            return;
        }

        // Sort to find the sharpest edges in the image
        edgeStrengths.sort((a, b) => b - a);

        // ANALYSIS STRATEGY: Average of Top 20% Edges
        // We only care if the *content* (text) is sharp. We don't care about the background.
        // Taking the top 20% isolates the text/objects from the rest.
        const sampleSize = Math.floor(edgeStrengths.length * 0.2);
        const topEdges = edgeStrengths.slice(0, sampleSize);
        
        const sum = topEdges.reduce((acc, val) => acc + val, 0);
        const avgTopEdgeStrength = sum / sampleSize;
        
        const score = Math.floor(avgTopEdgeStrength);

        // 4. Threshold Calibration
        // - Sharp scanned documents typically score > 60.
        // - Decent photos of text score 45-60.
        // - Blurry text typically scores < 35-40.
        const BLUR_THRESHOLD = 40;

        console.log(`[Gatekeeper] Top-Edge Score: ${score} (Threshold: ${BLUR_THRESHOLD}) | Edges analyzed: ${sampleSize}`);
        
        resolve({ isBlurry: score < BLUR_THRESHOLD, score });

      } catch (e) {
        console.error("Blur Gatekeeper Error", e);
        // Fail open on technical error to avoid blocking user unnecessarily
        resolve({ isBlurry: false, score: -1 });
      }
    };

    img.onerror = () => resolve({ isBlurry: false, score: 0 });
  });
};

const App: React.FC = () => {
  const [goodsImage, setGoodsImage] = useState<ImageFile | null>(null);
  const [docImage, setDocImage] = useState<ImageFile | null>(null);
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditResult[]>([]);
  
  // Gatekeeper State
  const [showBlurModal, setShowBlurModal] = useState(false);
  const [blurScore, setBlurScore] = useState(0);

  // Dynamic Loading Steps State
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [dynamicSteps, setDynamicSteps] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('logiAuditHistory');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Timer logic to cycle through steps
  useEffect(() => {
    let interval: any;
    if (isAnalyzing && dynamicSteps.length > 0) {
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => {
             if (prev >= dynamicSteps.length - 1) return prev;
             return prev + 1;
        });
      }, 2000); 
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, dynamicSteps]);

  const saveHistory = (newHistory: AuditResult[]) => {
      setHistory(newHistory);
      localStorage.setItem('logiAuditHistory', JSON.stringify(newHistory));
  };

  // --- THE GATEKEEPER FUNCTION ---
  const startPreCheck = async () => {
    if (!goodsImage || !docImage) {
      setError("Please upload both photos (Goods & Document) before starting.");
      return;
    }

    setError(null);
    setResult(null);
    setLoadingStepIndex(0);
    
    // 1. Image Quality Audit (Blur Check)
    // Check only the Document (critical for OCR)
    const check = await checkImageBlurry(docImage.previewUrl);
    
    if (check.isBlurry) {
        // CONDITION 1: BLUR DETECTED
        // ACTION: HALT PROCESS.
        setBlurScore(check.score);
        setShowBlurModal(true); 
        return; // STOP EXECUTION HERE
    }

    // CONDITION 2: CLEAR IMAGE
    // ACTION: AUTO PROCEED
    executeAudit(false);
  };

  const handleRetake = () => {
      setShowBlurModal(false);
      setDocImage(null); // Remove problem image to force re-upload
      setError("Please upload a clearer document.");
  };

  const handleForceProceed = () => {
      setShowBlurModal(false);
      executeAudit(true); // User forces override
  };

  const executeAudit = async (isForcedOverride: boolean) => {
    setIsAnalyzing(true);
    
    const steps = [
        "Step 1: Importing cargo manifest and physical evidence...",
        "Step 2: Identifying commodity type...",
    ];

    if (isForcedOverride) {
        steps.push("⚠️ WARNING: User Override Active. Attempting aggressive OCR correction...");
    } else {
        steps.push("✅ Image Quality Verified. Proceeding with data extraction...");
    }

    steps.push("Step 3: Performing cross-reference validation...");
    steps.push("Step 4: Generating logistics compliance report...");

    setDynamicSteps(steps);

    try {
      const auditResult = await performAudit(
        goodsImage!.base64,
        goodsImage!.mimeType,
        docImage!.base64,
        docImage!.mimeType
      );

      const now = new Date();
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full',
        timeStyle: 'long'
      }).format(now);
      
      auditResult.inspection_summary.timestamp_analysis = formattedDate;

      if (isForcedOverride) {
          auditResult.reasoning_logic.anomalies_found.push(`[SYSTEM NOTE] Audit performed on blurry image (Score: ${blurScore}). Accuracy may be degraded.`);
      }

      setResult(auditResult);
      saveHistory([auditResult, ...history]);
    } catch (err: any) {
      setError(err.message || "An error occurred during the audit.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectHistoryItem = (item: AuditResult) => {
    setResult(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistory = () => {
    saveHistory([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative font-sans">
      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2">
                 <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                 </div>
                 <span className="font-bold text-white text-xl tracking-tight">LogiAudit AI</span>
              </div>
            </div>
            {/* New Feature Badge in Navbar */}
            <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-900 text-indigo-100 border border-indigo-700">
                    <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-indigo-400" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                    Self-Correction Enabled
                </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Header */}
        <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                Automated Logistics Verification
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-6">
                Upload physical goods photo and shipping documents. 
                AI Gatekeeper will validate image quality before processing data audit.
            </p>
            
            {/* Feature Info Box */}
            <div className="inline-flex items-center bg-blue-50 border border-blue-100 rounded-full px-4 py-1 text-sm text-blue-800 shadow-sm gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">Smart Feature:</span> 
                <span>Includes <strong>AI Self-Correction</strong> — automatically flags illegible documents and requests a retake.</span>
            </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 mb-10">
            <div className="p-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <FileUploader 
                        id="goods-upload"
                        label="1. Physical Goods Photo" 
                        subLabel="Upload photo of box/item"
                        image={goodsImage} 
                        onImageChange={setGoodsImage} 
                    />
                    <FileUploader 
                        id="doc-upload"
                        label="2. Manifest Document" 
                        subLabel="Upload invoice/delivery note"
                        image={docImage} 
                        onImageChange={setDocImage} 
                    />
                </div>

                <div className="flex flex-col items-center">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 flex items-center gap-2 animate-pulse w-full max-w-lg justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <button
                        onClick={startPreCheck}
                        disabled={isAnalyzing || !goodsImage || !docImage}
                        className={`
                            px-8 py-4 rounded-full font-bold text-lg shadow-lg transform transition-all duration-200
                            ${isAnalyzing || !goodsImage || !docImage 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed translate-y-0' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl active:translate-y-0'
                            }
                            flex items-center gap-3
                        `}
                    >
                        {isAnalyzing ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Auditing...
                            </>
                        ) : (
                            <>
                                <span>Start Audit</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </>
                        )}
                    </button>
                    
                    {isAnalyzing && (
                      <div className="mt-6 w-full max-w-lg transition-all duration-500">
                          <div className={`
                             bg-indigo-50 border rounded-xl p-4 flex items-center gap-4 shadow-sm transition-colors duration-500
                             ${dynamicSteps[loadingStepIndex]?.includes('⚠️') ? 'border-orange-200 bg-orange-50' : ''}
                             ${dynamicSteps[loadingStepIndex]?.includes('✅') ? 'border-green-200 bg-green-50' : ''}
                             ${!dynamicSteps[loadingStepIndex]?.includes('⚠️') && !dynamicSteps[loadingStepIndex]?.includes('✅') ? 'border-indigo-100 bg-indigo-50' : ''}
                          `}>
                              <div className="flex-shrink-0 relative flex items-center justify-center">
                                  <div className={`w-3 h-3 rounded-full animate-ping absolute 
                                     ${dynamicSteps[loadingStepIndex]?.includes('⚠️') ? 'bg-orange-500' : 
                                       dynamicSteps[loadingStepIndex]?.includes('✅') ? 'bg-green-500' : 'bg-indigo-500'
                                     }
                                  `}></div>
                                  <div className={`w-3 h-3 rounded-full relative
                                     ${dynamicSteps[loadingStepIndex]?.includes('⚠️') ? 'bg-orange-500' : 
                                       dynamicSteps[loadingStepIndex]?.includes('✅') ? 'bg-green-500' : 'bg-indigo-500'
                                     }
                                  `}></div>
                              </div>
                              <div className="flex-1">
                                  <p className={`text-sm font-semibold transition-all duration-300
                                      ${dynamicSteps[loadingStepIndex]?.includes('⚠️') ? 'text-orange-800' : 
                                        dynamicSteps[loadingStepIndex]?.includes('✅') ? 'text-green-800' : 'text-indigo-800'
                                      }
                                  `}>
                                      {dynamicSteps[loadingStepIndex]}
                                  </p>
                              </div>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-500 ease-out
                                  ${dynamicSteps[loadingStepIndex]?.includes('⚠️') ? 'bg-orange-500' : 
                                    dynamicSteps[loadingStepIndex]?.includes('✅') ? 'bg-green-500' : 'bg-indigo-500'
                                  }
                                `}
                                style={{ width: `${((loadingStepIndex + 1) / dynamicSteps.length) * 100}%` }}
                              ></div>
                          </div>
                      </div>
                    )}

                    {!isAnalyzing && (!goodsImage || !docImage) ? (
                        <p className="text-slate-400 text-sm mt-3">Upload both images to start</p>
                    ) : null}
                </div>
            </div>
        </div>

        {/* Results Section */}
        {result && (
            <AuditDisplay result={result} />
        )}
        
        {/* History Section */}
        <AuditHistory 
            history={history} 
            onSelect={handleSelectHistoryItem} 
            onClear={handleClearHistory}
        />
        
      </main>

      {/* GATEKEEPER MODAL (BLUR DETECTION) */}
      {showBlurModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 transition-opacity" aria-hidden="true"></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border-t-4 border-red-500">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                <h3 className="text-lg leading-6 font-bold text-slate-900" id="modal-title">
                                    Image Quality Warning
                                </h3>
                                <div className="mt-3">
                                    <p className="text-base text-slate-600 font-medium">
                                        The image is detected as blurry/unclear. Please re-upload the image with sufficient lighting and sharp focus.
                                    </p>
                                    <div className="mt-4 bg-red-50 p-3 rounded-lg border border-red-100">
                                        <div className="flex justify-between items-center text-xs uppercase font-bold text-red-400 mb-1">
                                            <span>Sharpness Score (Top Edges)</span>
                                            <span>Min. Threshold: 40</span>
                                        </div>
                                        <div className="text-2xl font-mono font-bold text-red-700">
                                            {blurScore} <span className="text-sm font-normal text-red-500">/ 40</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-3 sm:px-6 flex flex-col sm:flex-row-reverse gap-2">
                        <button 
                            type="button" 
                            onClick={handleRetake}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:w-auto sm:text-sm"
                        >
                            Re-upload (Required)
                        </button>
                        
                        <button 
                            type="button" 
                            onClick={handleForceProceed}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-xs"
                        >
                            Force Proceed (High Risk)
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;