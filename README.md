<div align="center">
<img width="1200" alt="LogiAudit AI Banner" src="https://raw.githubusercontent.com/tarqhilmars29/assets-portfolio/main/LogiAudit%20AI%20Thumbnail.png" />

# 📦 LogiAudit AI
**Autonomous Logistics Guardkeeper: Bridging the Physical-Digital Gap with Gemini 3 Multimodal Orchestration**

[![Gemini 3 Pro](https://img.shields.io/badge/AI-Gemini%203-blue)](https://aistudio.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[📺 Watch Demo Video](https://youtu.be/nTrh5urmvwQ) | [🚀 View in AI Studio](https://ai.studio/apps/drive/1P_zOMnk95lcx07kCavl5M2OORL_Rg71P)
</div>

---

## 🌟 Overview
**LogiAudit AI** leverages Gemini 3’s **Native Multimodal Reasoning** to automate the traditionally error-prone manual logistics audit. It performs **Cross-Modal Analysis**, simultaneously reasoning over physical cargo photographs and shipping manifests to ensure supply chain integrity.

## 🧠 Key Features & Gemini Integration
- **🧩 Spatial Reasoning**: Executes intelligent item counting (e.g., 6x6 grid patterns in fruit crates) instead of simple object detection.
- **🤖 Autonomous Action**: Automatically generates professional "Complaint Email Drafts" when a mismatch is detected, including precise Invoice IDs and discrepancy counts.
- **🛡️ AI Gatekeeper (Self-Correction)**: Intelligently flags blurry or low-quality images to prevent data hallucinations, requesting a retake when necessary.
- **📄 Advanced OCR**: Seamlessly extracts and cross-references data from complex shipping documents.

## 🏗️ Architecture
```mermaid
graph TD
    A[Physical Photo] --> C{Gemini 3 Orchestrator}
    B[Manifest/Invoice] --> C
    
    subgraph "Reasoning Logic"
    C --> C1[Spatial Reasoning: Item Count]
    C --> C2[Document OCR & Analysis]
    C1 & C2 --> C3[Anomaly Detection]
    end

    C3 --> D[Structured JSON Output]
    D --> E[Dashboard UI]
    D --> F{Status Check}
    F -- Mismatch --> G[Autonomous Email Drafting]
    E --> H[LocalStorage: Offline-First History]
```

## 🛠️ Tech Stack
- **Framework**: React.js
- **AI Engine**: Gemini 3 API (Multimodal, Spatial Reasoning, Structured Output)
- **State/Data**: Offline-First via LocalStorage
- **Deployment / Prototype**: Google AI Studio App

## 🚀 Getting Started
**Prerequisites**: Node.js (v18+)
1. **Clone the repo:**
```
   git clone [https://github.com/tarqhilmarsiregar/logiaudit-ai.git](https://github.com/tarqhilmarsiregar/logiaudit-ai.git)
   cd logiaudit-ai
```

2. **Install dependencies:**
```
   npm install
```

3. **Environment Setup:** Create a `.env.local` file and add your Gemini API Key:
```
   GEMINI_API_KEY=your_api_key_here
```

4. **Run Development Server:**
```
   npm run dev
```