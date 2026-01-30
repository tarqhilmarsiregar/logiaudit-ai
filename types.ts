export interface InspectionSummary {
  status: 'MATCH' | 'MISMATCH' | 'WARNING';
  timestamp_analysis: string;
}

export interface PhysicalAnalysis {
  commodity_name: string;
  estimated_quantity: string;
  visual_quality_assessment: string;
}

export interface DocumentAnalysis {
  document_type: string;
  declared_quantity: string;
  id_number: string;
  detected_text_raw: string;
}

export interface ReasoningLogic {
  comparison_result: string;
  anomalies_found: string[];
}

export interface Recommendation {
  action: 'Proceed' | 'Reject' | 'Manual Inspection';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  note: string;
}

export interface AuditResult {
  inspection_summary: InspectionSummary;
  physical_analysis: PhysicalAnalysis;
  document_analysis: DocumentAnalysis;
  reasoning_logic: ReasoningLogic;
  recommendation: Recommendation;
}

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}