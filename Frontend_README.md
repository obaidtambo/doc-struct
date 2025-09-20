# Docu-Struct Workbench

## Project Overview

Docu-Struct Workbench is a powerful, AI-driven web application designed to help users analyze, visualize, and restructure unstructured documents. By uploading a PDF, users trigger a backend processing pipeline that performs OCR, hierarchy analysis, and data structuring. The results are then sent back to the application, where users can view the content in a relational table and an interactive hierarchical graph. The application leverages the Google Gemini API to offer intelligent content merging and restructuring capabilities, transforming raw text into a clean, organized, and understandable format.

This tool is ideal for document analysts, researchers, and anyone who needs to make sense of complex document hierarchies and relationships.

In the Frontend 
npm install

npm run dev/ or npm run

Frontend/
├── .env -api keys
├── vite.config.ts
├── tsconfig.json
├── package.josn                        
├── index.html
├── index.tsx
├── App.tsx                             <-- The main app component (CORRECTED LOCATION)
├── metadata.json
├── README.md
├── serve.json                          <-- You create this here
├── constants.ts
├── types.ts
├── utils.ts
├── Obaid_Tamboli_CV_1757852307_flattened_initial.json
├── agents/
│   ├── mergeAgent.ts
│   └── suggestionAgent.ts
├── components/
│   ├── ActionBar.tsx
│   ├── DownloadMenu.tsx
│   ├── ErrorMessage.tsx
│   ├── GraphView.tsx
│   ├── Header.tsx
│   ├── Icons.tsx
│   ├── InlineMergeEditor.tsx
│   ├── Loader.tsx
│   ├── MergeModal.tsx
│   ├── PdfViewer.tsx
│   ├── ResizablePanels.tsx
│   └── TableView.tsx
├── services/
│   ├── apiService.ts
│   ├── logger.ts
│   └── (backendService.ts should be deleted if it exists)
└── state/
    └── reducer.ts

---
# Docu-Struct Workbench

## Project Overview

Docu-Struct Workbench is a powerful, AI-driven web application designed to help users analyze, visualize, and restructure unstructured documents. By uploading a PDF, users trigger a backend processing pipeline that performs OCR, hierarchy analysis, and data structuring. The results are then sent back to the application, where users can view the content in a relational table and an interactive hierarchical graph. The application leverages the Google Gemini API to offer intelligent content merging and restructuring capabilities, transforming raw text into a clean, organized, and understandable format.

This tool is ideal for document analysts, researchers, and anyone who needs to make sense of complex document hierarchies and relationships.

docu-struct-workbench/
├── .env                              <-- Your API key file
├── .gitignore                        <-- NEW: Ensures .env is not committed
├── index.html
├── index.tsx
├── App.tsx                           <-- The main app component
├── metadata.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── ...

---

## Key Features

- **PDF-First Workflow**: Simply upload a PDF document to begin. The backend handles the complex processing, and the frontend provides real-time status updates.
- **Dual View Interface**: Seamlessly switch between a **Table View** and a **Graph View** to inspect the document structure from different perspectives.
- **Interactive Table**: A detailed tabular representation of all document paragraphs, showing their level, role, content, and parent-child relationships.
- **Dynamic Graph Visualization**: A D3.js-powered interactive graph that visually represents the document's hierarchical structure.
- **Synchronized PDF Viewer**: The original PDF is displayed alongside the analysis, allowing for easy cross-referencing.
  - **Hover-to-Highlight**: Hovering over a row in the table or a node in the graph instantly highlights its corresponding location in the PDF, providing direct visual context.
- **AI-Powered Merging**:
  - **Simple Concatenation**: A quick merge option that combines the text of selected paragraphs in order.
  - **Intelligent AI Merge**: Utilizes the Gemini API to merge paragraphs into a single, coherent text, suggesting a new role and extracting key information.
  - **Custom Instructions**: Guide the AI by providing specific instructions (e.g., "merge into a bulleted list") for more precise results.
- **Data Export**:
  - Download the current state of your analysis as a **JSON** or **CSV** file.
  - Export the visual graph as a high-quality **SVG** or **PNG** image.
- **State Persistence**:
  - **Save Changes**: Persist your entire session, including all edits, to the backend service by clicking the "Save Changes" button. This allows you to store your work and reload it in a future session.
- **Resizable Layout**: Adjust the size of the main analysis panel and the PDF viewer panel to suit your workflow.

---

## Technical Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend Communication**: Fetch API for RESTful communication with a Python/FastAPI backend.
- **Styling**: Tailwind CSS
- **Visualization**: D3.js
- **AI Integration**: Google Gemini API via `@google/genai` SDK
- **PDF Rendering**: PDF.js

---

## Backend Integration

The frontend application is designed to work with a specific FastAPI backend. It communicates over three main REST API endpoints:

- **`POST /upload-pdf/`**:
  - **Purpose**: Uploads a new PDF file for processing.
  - **Payload**: `multipart/form-data` with a `file` field.
  - **Response**: `{ "documentId": "string", "message": "string" }`

- **`GET /document-status/{document_id}`**:
  - **Purpose**: Polls the server for the status of a processing job.
  - **Response**: `DocumentStatusResponse` object containing the job status, error messages, and the final structured data upon completion.

- **`POST /save-document-state/`**:
  - **Purpose**: Persists the current session (edits, merges, etc.) to the database.
  - **Payload**: A `DocumentState` JSON object representing the entire application state.
  - **Response**: `{ "message": "string", "documentId": "string" }`

The `services/apiService.ts` file handles all communication, including the crucial conversion between the frontend's `camelCase` and the backend's `snake_case` conventions.

---

## How to Run Locally

### Prerequisites

- A running instance of the corresponding [FastAPI backend application](https://link-to-your-backend-repo.com).
- [Node.js](https://nodejs.org/) (which includes `npm`).
- A Gemini API Key for the AI Merge functionality. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Step 1: Set Up Your API Key

The application needs your Gemini API key to power the "AI Merge" feature.

1.  In the project's root directory, create a new file named `.env`.
2.  Add the following line to the file, replacing the placeholder with your actual key:

```env
# .env
GEMINI_API_KEY="pA5te-y0ur-aCtUaL-g3mInI-aPi-k3y-h3Re"
```
**Security Note:** The `.gitignore` file is already configured to ignore `.env` files, so your key will not be accidentally committed to version control.

### Step 2: Install Dependencies

This project uses `npm` to manage dependencies. From your project's root directory, run the following command in your terminal:

```bash
npm install
```

### Step 3: Run the Development Server

We use Vite as a development server. It compiles the code, serves the application, and proxies API requests to your running backend. To start it, run:

```bash
npm run dev
```

Vite will start the server and print the local URL where the application is running (e.g., `http://localhost:5173`).

### Step 4: Open the App

Open your web browser and navigate to the URL provided by Vite. The Docu-Struct Workbench application should now be running correctly and communicating with your backend.
