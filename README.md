# Docu-Struct Visualizer

This application is an advanced tool designed to transform unstructured documents (PDFs) into structured, relational data. Using a multi-step AI pipeline, it extracts text, analyzes its hierarchical structure, enriches it with metadata, and presents the results in interactive table and graph formats. It also includes a "Human-in-the-Loop" (HITL) feature for manual refinement of the AI's output.

## Core Features

*   **Multi-Format Upload**: Supports both PDF files for full analysis and pre-processed OCR JSON files for re-running the AI pipeline.
*   **AI-Powered Analysis Pipeline**: A sophisticated, multi-agent process that performs:
    1.  **OCR & Layout Analysis**: Extracts text and its location from PDFs using Azure Document Intelligence.
    2.  **Structural Analysis**: A Gemini agent structures the raw text into a coherent hierarchy (titles, headings, paragraphs).
    3.  **Coherence Refinement**: A second Gemini agent refines the structure, merging fragmented text for better readability.
    4.  **Content Enrichment**: A third Gemini agent extracts key-value metadata from each paragraph (e.g., names, dates, skills).
*   **Dual-View Interface**:
    *   **Table View**: A clear, relational table of the structured data.
    *   **Graph View**: A dynamic, force-directed graph (using D3.js) visualizing the parent-child relationships between document nodes.
*   **Interactive PDF Viewer**: Displays the original PDF with real-time highlighting of paragraphs when hovered over in the table view.
*   **Human-in-the-Loop (HITL) Editing**: An "Interactive Mode" where AI suggests potential paragraph merges, and users can manually select and merge rows with AI-assisted content generation.
*   **State Persistence**: A "Lock" feature that saves the entire analysis session (including the PDF and results) to the browser's local storage, allowing users to resume their work later.
*   **Data Export**: Allows downloading the final analysis results as JSON or CSV, the graph as SVG or PNG, and the raw OCR output.

## Technology Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS
*   **AI**: Google Gemini API (`@google/genai`) for all structuring and enrichment tasks.
*   **OCR**: Microsoft Azure Document Intelligence for text extraction and layout analysis.
*   **Data Visualization**: D3.js for the dynamic graph view.
*   **PDF Rendering**: PDF.js

---

## Project Structure

The project is organized into components for UI, services for business logic, and a central `App.tsx` for state management.

```
.
├── index.html              # Main HTML entry point, includes CDN imports
├── index.tsx               # React application bootstrap
├── App.tsx                 # Main application component, handles all state and logic orchestration
├── types.ts                # Centralized TypeScript type and interface definitions
│
├── components/
│   ├── Header.tsx          # Application header with title and lock button
│   ├── TableView.tsx       # Renders the structured data in a table
│   ├── GraphView.tsx       # Renders the data relationship graph using D3
│   ├── PdfViewer.tsx       # Renders the source PDF and handles highlighting
│   ├── MergeModal.tsx      # Modal for the Human-in-the-Loop merge workflow
│   ├── DownloadMenu.tsx    # Dropdown menu for exporting data
│   ├── Loader.tsx          # Reusable loading spinner component
│   ├── ErrorMessage.tsx    # Component for displaying errors
│   └── Icons.tsx           # SVG icon components
│
└── services/
    ├── documentAnalysisPipeline.ts # Main orchestrator for the analysis workflow
    ├── azureOcrService.ts          # Handles communication with Azure for OCR
    ├── geminiAnalyzerService.ts    # Initial AI agent for structuring document hierarchy
    ├── coherenceAgent.ts           # AI agent for refining and merging paragraphs
    ├── enrichmentAgent.ts          # AI agent for extracting key-value metadata
    └── hitlAgents.ts               # AI agents for the interactive merge feature
```

---

## AI Analysis Pipeline Explained

The core of this application is a sequential, multi-agent pipeline defined in `services/documentAnalysisPipeline.ts`.

1.  **Extraction (`azureOcrService.ts`)**:
    *   The user uploads a PDF.
    *   The file is sent to the Azure Document Intelligence API.
    *   Azure performs OCR and layout analysis, returning a JSON object containing all text blocks, their roles (e.g., `title`, `paragraph`), bounding boxes, and page numbers.

2.  **Structuring (`geminiAnalyzerService.ts`)**:
    *   The raw OCR JSON is sent to a Gemini agent.
    *   This agent's primary goal is to clean the data (removing headers/footers), merge obviously fragmented text, and establish a parent-child hierarchy.
    *   It outputs a structured JSON array where each item has an `id`, `parentId`, `level`, `role`, and `content`.

3.  **Refinement (`coherenceAgent.ts`)**:
    *   The structured data from the previous step is passed to a second Gemini agent.
    *   This "coherence agent" acts as an editor, looking for sibling paragraphs that are semantically linked but were missed in the first pass. It merges them to improve readability.
    *   It returns the same data structure, but potentially with fewer, more coherent rows.

4.  **Enrichment (`enrichmentAgent.ts`)**:
    *   The refined data is passed to a third Gemini agent.
    *   This "enrichment agent" analyzes the content of each paragraph *in the context of the whole document* to extract specific, structured key-value details. For a resume, this might be `skillCategory` and `skills`; for a certificate, `recipientName` and `completionDate`.
    *   It returns a list of enrichments that are then merged back into the final data structure.

## Configuration & Deployment

This application is configured using environment variables. To run or deploy it, you must provide the necessary API keys and endpoints. The application code is already written to read these variables, so **you do not need to modify any source code files**.

### Required Environment Variables

A template file named `.env.example` is included in the project. It lists all the required variables.

*   `API_KEY`: Your Google Gemini API Key.
*   `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`: The endpoint URL for your Azure Document Intelligence service.
*   `AZURE_DOCUMENT_INTELLIGENCE_KEY`: The access key for your Azure Document Intelligence service.

### Deploying to the Cloud

To deploy this application to a cloud provider like Vercel, Netlify, or Google Cloud Run, you must set the environment variables in your cloud provider's project settings dashboard. **Do not upload a `.env` file.**

1.  Go to your project's dashboard on your cloud provider's website.
2.  Find the "Environment Variables" or "Secrets" section in the project/site settings.
3.  Add the three variables (`API_KEY`, `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, and `AZURE_DOCUMENT_INTELLIGENCE_KEY`) with your actual keys and endpoint URL as their values.
4.  Redeploy your application. The new settings will take effect, and the application will work correctly.

## Local Development & Testing

1.  **Prerequisites**: A modern web browser. No local installation is required as all dependencies are loaded via CDN in `index.html`.
2.  **Running**: Simply open the `index.html` file in a browser, or serve the directory using a simple local server (`npx http-server .`).
3.  **Testing**: This project emphasizes service-level testing. Detailed instructions on how to write unit tests by mocking dependencies are provided in the header comments of each file within the `services/` directory. This allows for isolated and robust testing of each part of the AI pipeline.
