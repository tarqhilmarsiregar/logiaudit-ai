import React from 'react';
import { AuditResult } from '../types';

interface AuditHistoryProps {
  history: AuditResult[];
  onSelect: (result: AuditResult) => void;
  onClear: () => void;
}

const AuditHistory: React.FC<AuditHistoryProps> = ({ history, onClear }) => {
  if (history.length === 0) return null;

  const handleExportCSV = () => {
    const headers = [
      "Timestamp",
      "Status",
      "Commodity",
      "Estimated Quantity",
      "Visual Quality",
      "Document Type",
      "Document ID",
      "Declared Quantity",
      "Recommended Action",
      "Priority",
      "Note"
    ];

    const rows = history.map(item => [
      `"${item.inspection_summary.timestamp_analysis.replace(/"/g, '""')}"`,
      `"${item.inspection_summary.status}"`,
      `"${item.physical_analysis.commodity_name.replace(/"/g, '""')}"`,
      `"${item.physical_analysis.estimated_quantity.replace(/"/g, '""')}"`,
      `"${item.physical_analysis.visual_quality_assessment.replace(/"/g, '""')}"`,
      `"${item.document_analysis.document_type.replace(/"/g, '""')}"`,
      `"${item.document_analysis.id_number.replace(/"/g, '""')}"`,
      `"${item.document_analysis.declared_quantity.replace(/"/g, '""')}"`,
      `"${item.recommendation.action}"`,
      `"${item.recommendation.priority}"`,
      `"${item.recommendation.note.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_history_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mt-8 animate-fade-in-up">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h2 className="text-lg font-bold text-slate-800">Audit History</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded hover:bg-indigo-50 transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button 
            onClick={onClear}
            className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Clear History
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Commodity</th>
              <th className="px-6 py-3">Doc ID</th>
              <th className="px-6 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{item.inspection_summary.timestamp_analysis}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                    item.inspection_summary.status === 'MATCH' ? 'bg-green-100 text-green-800 border-green-200' :
                    item.inspection_summary.status === 'MISMATCH' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }`}>
                    {item.inspection_summary.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-800 font-medium">{item.physical_analysis.commodity_name}</td>
                <td className="px-6 py-4 text-slate-600 font-mono text-xs">{item.document_analysis.id_number}</td>
                <td className="px-6 py-4">
                   <span className={`text-xs font-semibold ${
                     item.recommendation.action === 'Reject' ? 'text-red-600' :
                     item.recommendation.action === 'Manual Inspection' ? 'text-yellow-600' : 'text-green-600'
                   }`}>
                     {item.recommendation.action}
                   </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditHistory;