import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AuditResult } from "../types";

const processFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result?.toString().replace(/^data:(.*,)?/, "");
      if (encoded) {
        if ((encoded.length % 4) > 0) {
          encoded += "=".repeat(4 - (encoded.length % 4));
        }
        resolve(encoded);
      } else {
        reject(new Error("Failed to encode file"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateComplaintEmail = async (auditResult: AuditResult): Promise<{ subject: string; body: string }> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const emailSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING },
      body: { type: Type.STRING }
    },
    required: ["subject", "body"]
  };

  const prompt = `
    Role: You are a Senior Logistics Procurement Manager.
    Task: Draft a formal, strict, and precise complaint email to a vendor regarding a shipment discrepancy found during audit.

    Context Data:
    - Invoice/Doc ID: ${auditResult.document_analysis.id_number}
    - Commodity: ${auditResult.physical_analysis.commodity_name}
    - Date: ${auditResult.inspection_summary.timestamp_analysis}
    - Status: ${auditResult.inspection_summary.status}
    - Declared Quantity (Document): ${auditResult.document_analysis.declared_quantity}
    - Actual Quantity (Physical): ${auditResult.physical_analysis.estimated_quantity}
    - Anomalies Detected: ${auditResult.reasoning_logic.anomalies_found.join(", ")}
    - Quality Issues: ${auditResult.physical_analysis.visual_quality_assessment}

    Requirements:
    1. SUBJECT: Must include "Urgent Discrepancy Report" and the Invoice Number.
    2. TONE: Professional, firm, and evidence-based.
    3. CONTENT: 
       - Explicitly state the mismatch (Expected vs Received).
       - Mention the specific anomalies.
       - Request an immediate Credit Note or Replacement.
       - Request a root cause analysis from the vendor.
    
    Output strictly in JSON format containing 'subject' and 'body'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Fast model is sufficient for text generation
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: emailSchema,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as { subject: string; body: string };
    } else {
      throw new Error("Failed to generate email draft");
    }
  } catch (error) {
    console.error("Email generation failed:", error);
    throw error;
  }
};

export const performAudit = async (
  goodsImageBase64: string,
  goodsMimeType: string,
  docImageBase64: string,
  docMimeType: string
): Promise<AuditResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Schema definition based on the user's specific JSON requirement
  const auditSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      inspection_summary: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ["MATCH", "MISMATCH", "WARNING"] },
          // confidence_score removed as requested
          timestamp_analysis: { type: Type.STRING, description: "Current timestamp or extracted date" }
        },
        required: ["status", "timestamp_analysis"]
      },
      physical_analysis: {
        type: Type.OBJECT,
        properties: {
          commodity_name: { type: Type.STRING },
          estimated_quantity: { type: Type.STRING, description: "Strict visual count. MUST include the logic (e.g., '12 Boxes (3x4 grid visible)')." },
          visual_quality_assessment: { type: Type.STRING, description: "Condition, freshness, color, damage check" }
        },
        required: ["commodity_name", "estimated_quantity", "visual_quality_assessment"]
      },
      document_analysis: {
        type: Type.OBJECT,
        properties: {
          document_type: { type: Type.STRING },
          declared_quantity: { type: Type.STRING },
          id_number: { type: Type.STRING, description: "Invoice number or delivery note ID" },
          detected_text_raw: { type: Type.STRING, description: "Key text snippets found" }
        },
        required: ["document_type", "declared_quantity", "id_number", "detected_text_raw"]
      },
      reasoning_logic: {
        type: Type.OBJECT,
        properties: {
          comparison_result: { type: Type.STRING, description: "Logical explanation of match/mismatch focusing on quantity and ID" },
          anomalies_found: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["comparison_result", "anomalies_found"]
      },
      recommendation: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["Proceed", "Reject", "Manual Inspection"] },
          priority: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
          note: { type: Type.STRING, description: "Instruction for warehouse staff" }
        },
        required: ["action", "priority", "note"]
      }
    },
    required: ["inspection_summary", "physical_analysis", "document_analysis", "reasoning_logic", "recommendation"],
  };

  const prompt = `
    Role: You are a high-level AI Logistics Auditor expert in supply chain verification.

    Main Task: 
    1. Analyze "Physical Goods Photo" (Image 1). 
    2. Analyze "Document Photo" (Image 2). 
    3. Compare Physical vs Document strictly.

    *** CRITICAL: SPATIAL COUNTING PROTOCOL (EXTREME STRICTNESS) ***
    You must COUNT strictly based on visual evidence. Do not guess hidden items.

    1. MATRIX CALCULATION (For Pallets/Stacks):
       - Look for the pattern of the stack.
       - Count the width (columns) and height (rows) of the *visible face*.
       - EXAMPLE: If you see a pallet, do not just say "50". Say "12 Visible (4 wide x 3 high)".
       - DO NOT assume the depth (layers behind) unless you can clearly see the side view.
       - If the document says "100" but you only see a front face of 20, report "20 Visible Items".

    2. ISOLATED ITEMS:
       - If items are loose, count them one by one. 
       - If items are partially cropped, count them as 1 if the majority is visible.

    3. COMPARISON LOGIC (EVIDENCE BASED):
       - MATCH: Visual Count matches Document Count exactly.
       - WARNING: Visual Count is LESS than Document Count because of occlusion (hidden items). 
         -> You MUST state: "Only X items clearly visible. Document declares Y."
       - MISMATCH: Visual Count is DIFFERENT and there is no occlusion (e.g., 5 items spread on a table, doc says 10).

    4. SELF-CORRECTION (BLUR & OCCLUSION):
       - If the image is blurry (as detected by your internal check), maintain the detailed blur warning.
       - If the view is obstructed (e.g., shrink wrap reflects light, or items are deep inside a dark truck), declare "Count Inconclusive due to obstruction".

    Output Requirements:
    - In 'estimated_quantity', YOU MUST SHOW THE MATH. Format: "Total (Row x Col)" or "Total (Individual Count)".
    - Provide response ONLY IN JSON FORMAT matching the provided schema.
  `;

  // Helper to detect quota errors
  const isQuotaError = (error: any) => {
    const msg = error.message || JSON.stringify(error);
    return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
  };

  const generate = async (model: string) => {
    return await ai.models.generateContent({
      model: model, 
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: goodsMimeType,
              data: goodsImageBase64,
            },
          },
          {
            inlineData: {
              mimeType: docMimeType,
              data: docImageBase64,
            },
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: auditSchema,
        temperature: 0.0, // Zero temperature for maximum determinism in counting
        // High thinking budget for spatial reasoning
        thinkingConfig: { thinkingBudget: 4096 }, 
      },
    });
  };

  try {
    let response;
    try {
      // Primary Attempt: Gemini 3 Pro (Best Quality for Counting/OCR)
      response = await generate("gemini-3-pro-preview");
    } catch (error: any) {
      if (isQuotaError(error)) {
        console.warn("Primary model quota exceeded. Falling back to Gemini 2.5 Flash...");
        // Fallback Attempt: Gemini 2.5 Flash
        response = await generate("gemini-2.5-flash");
      } else {
        throw error;
      }
    }

    if (response.text) {
      const result = JSON.parse(response.text) as AuditResult;
      return result;
    } else {
      throw new Error("No response text generated");
    }
  } catch (error: any) {
    console.error("Audit failed:", error);
    
    // Final User-Friendly Error Message
    if (isQuotaError(error)) {
        throw new Error("⚠️ AI Quota Limit Reached (Error 429). Please wait a moment or check your Google AI billing details.");
    }

    throw error;
  }
};

export { processFileToBase64 };