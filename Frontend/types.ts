
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageDimension {
  pageNumber: number;
  width: number;
  height: number;
}

export interface AnalyzedParagraph {
  id: string;
  parentId: string | null;
  content: string;
  role: string | null;
  level: number;
  enrichment?: Record<string, any>;
  boundingBox: BoundingBox | null;
  pageNumber: number | null;
  isMerged?: boolean; // Flag to identify merged paragraphs
  sourceIds?: string[]; // IDs of the original paragraphs
}

export enum ViewType {
  TABLE = 'TABLE',
  GRAPH = 'GRAPH',
}

export type MergeType = 'AI_DEFAULT' | 'AI_CUSTOM';

export type UserAction =
  | { type: 'SIMPLE_MERGE'; payload: { ids: string[]; newParagraph: AnalyzedParagraph } }
  | { type: 'AI_MERGE'; payload: { ids: string[]; newParagraph: AnalyzedParagraph; prompt: string, customInstructions?: string } }
  | { type: 'EDIT_CONTENT'; payload: { id: string; oldContent: string; newContent: string } };


// --- Types for Backend API Interaction ---

// Matches the status strings from the FastAPI backend
export type DocumentStatus = 
  | 'OCR_IN_PROGRESS'
  | 'OCR_COMPLETED'
  | 'CORRECTION_IN_PROGRESS'
  | 'CORRECTION_COMPLETED'
  | 'FLATTENING_IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

// Represents the frontend state that gets saved and loaded.
// It's a subset of the main AppState.
export interface DocumentState {
    documentId: string;
    pageDimensions: PageDimension[];
    paragraphs: AnalyzedParagraph[];
    history: UserAction[];
    // Can add other UI state elements to persist here
}

export interface DocumentStatusResponse {
    documentId: string;
    filename: string;
    status: DocumentStatus;
    progress: string;
    finalData?: DocumentState;
    errorMessage?: string;
}
