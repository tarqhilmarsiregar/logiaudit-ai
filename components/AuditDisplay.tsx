import React, { useState } from 'react';
import { AuditResult } from '../types';
import { generateComplaintEmail } from '../services/geminiService';

interface AuditDisplayProps {
  result: AuditResult;
}

const AuditDisplay: React.FC<AuditDisplayProps> = ({ result }) => {
  const { 
    inspection_summary, 
    physical_analysis, 
    document_analysis, 
    reasoning_logic, 
    recommendation 
  } = result;

  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null);
  
  // State for copy feedback interaction
  const [hasCopied, setHasCopied] = useState(false);

  const handleDraftEmail = async () => {
    setIsGeneratingEmail(true);
    try {
      const draft = await generateComplaintEmail(result);
      setEmailDraft(draft);
      setShowEmailModal(true);
      setHasCopied(false); // Reset copy state when opening new modal
    } catch (error) {
      console.error("Failed to generate email", error);
      alert("Failed to generate email draft. Please try again.");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const copyToClipboard = () => {
    if (emailDraft) {
      const fullText = `Subject: ${emailDraft.subject}\n\n${emailDraft.body}`;
      navigator.clipboard.writeText(fullText);
      
      // Trigger visual feedback
      setHasCopied(true);
      
      // Reset back to original state after 2 seconds
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'MATCH': return 'bg-green-100 text-green-800 border-green-200';
      case 'MISMATCH': return 'bg-red-100 text-red-800 border-red-200';
      case 'WARNING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-50 border-red-100';
      case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-100';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      
      {/* Top Summary Card */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Inspection Summary</h2>
            <p className="text-sm text-slate-500 font-mono mt-1">{inspection_summary.timestamp_analysis}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-5 py-2 rounded-full border flex items-center gap-2 ${getStatusStyle(inspection_summary.status)}`}>
              <span className="font-bold text-lg tracking-wide">{inspection_summary.status}</span>
            </div>
          </div>
        </div>
        
        {/* Recommendation Bar & Autonomous Actions */}
        <div className={`p-4 border-b border-slate-100 flex flex-col gap-4 ${
             recommendation.action === 'Reject' ? 'bg-red-50/50' : 
             recommendation.action === 'Manual Inspection' ? 'bg-yellow-50/50' : 'bg-green-50/50'
        }`}>
           <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
             <div className="flex-shrink-0">
               <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Recommended Action</span>
               <span className={`text-lg font-bold px-3 py-1 rounded border ${
                   recommendation.action === 'Reject' ? 'bg-red-100 text-red-800 border-red-200' : 
                   recommendation.action === 'Manual Inspection' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'
               }`}>
                  {recommendation.action}
               </span>
             </div>
             <div className="flex-grow">
                <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Instruction Note</span>
                <p className="text-slate-800 font-medium">{recommendation.note}</p>
             </div>
             <div className="flex-shrink-0">
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded border ${getPriorityColor(recommendation.priority)}`}>
                  {recommendation.priority} Priority
                </span>
             </div>
           </div>

           {/* AUTONOMOUS ACTION: Only visible on MISMATCH */}
           {inspection_summary.status === 'MISMATCH' && (
             <div className="mt-2 pt-4 border-t border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  <span className="font-bold text-sm uppercase tracking-wide">Autonomous Action Available</span>
                </div>
                <button 
                  onClick={handleDraftEmail}
                  disabled={isGeneratingEmail}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-sm font-semibold text-sm flex items-center gap-2 transition-all hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isGeneratingEmail ? (
                    <>
                       <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Drafting Email...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Draft Complaint Email
                    </>
                  )}
                </button>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Physical Analysis Card */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
               </svg>
            </div>
            <h3 className="font-bold text-lg text-slate-800">Physical Analysis</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Commodity</label>
              <div className="text-slate-900 font-medium text-lg">{physical_analysis.commodity_name}</div>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Estimated Quantity</label>
              <div className="text-indigo-600 font-bold text-xl">{physical_analysis.estimated_quantity}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Visual Quality Assessment</label>
               <p className="text-slate-700 text-sm leading-relaxed">{physical_analysis.visual_quality_assessment}</p>
            </div>
          </div>
        </div>

        {/* Document Analysis Card */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
           <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
            </div>
            <h3 className="font-bold text-lg text-slate-800">Document Analysis</h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between">
                <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Doc Type</label>
                    <div className="text-slate-900 font-medium">{document_analysis.document_type}</div>
                </div>
                <div className="text-right">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">ID Number</label>
                    <div className="text-slate-900 font-mono bg-slate-100 px-2 py-1 rounded text-sm">{document_analysis.id_number}</div>
                </div>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Declared Quantity</label>
              <div className="text-emerald-600 font-bold text-xl">{document_analysis.declared_quantity}</div>
            </div>

             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Detected Text Snippet</label>
               <p className="text-slate-600 text-xs font-mono break-all leading-tight">{document_analysis.detected_text_raw}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning & Anomalies */}
      <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
         <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Reasoning Logic & Anomalies
         </h3>
         
         <div className="mb-4">
            <p className="text-slate-800 text-sm leading-relaxed border-l-4 border-purple-300 pl-4 py-1">
                {reasoning_logic.comparison_result}
            </p>
         </div>

         {reasoning_logic.anomalies_found.length > 0 ? (
             <div className="mt-4">
                 <label className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2 block">Anomalies Detected</label>
                 <ul className="space-y-2">
                     {reasoning_logic.anomalies_found.map((anomaly, idx) => (
                         <li key={idx} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                            <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {anomaly}
                         </li>
                     ))}
                 </ul>
             </div>
         ) : (
             <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded text-sm font-medium">
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                 </svg>
                 No anomalies detected.
             </div>
         )}
      </div>

      {/* EMAIL DRAFT MODAL */}
      {showEmailModal && emailDraft && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={() => setShowEmailModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="text-lg leading-6 font-bold text-slate-900 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    Draft Complaint Email
                 </h3>
                 <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-500">
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
              </div>
              
              <div className="px-6 py-6 space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
                    <input 
                      readOnly 
                      value={emailDraft.subject} 
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm font-medium text-slate-800"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Body</label>
                    <textarea 
                      readOnly 
                      rows={12}
                      value={emailDraft.body} 
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 font-mono whitespace-pre-wrap"
                    ></textarea>
                 </div>
              </div>

              <div className="bg-slate-50 px-4 py-3 sm:px-6 flex flex-row-reverse gap-2">
                 <button 
                    type="button" 
                    onClick={copyToClipboard}
                    className={`
                      w-full inline-flex justify-center items-center gap-2 rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200
                      ${hasCopied ? 'bg-green-600 hover:bg-green-700 scale-105' : 'bg-indigo-600 hover:bg-indigo-700'}
                    `}
                 >
                    {hasCopied ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy to Clipboard
                      </>
                    )}
                 </button>
                 <button 
                    type="button" 
                    onClick={() => setShowEmailModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                 >
                    Close
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditDisplay;