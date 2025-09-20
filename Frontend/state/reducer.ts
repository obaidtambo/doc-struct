
import { AnalyzedParagraph, PageDimension, UserAction, ViewType, MergeType } from '../types';
import { generateUniqueId } from '../utils';

export interface AppState {
  document: { id: string; filename: string; } | null;
  initialParagraphs: AnalyzedParagraph[];
  paragraphs: AnalyzedParagraph[];
  pageDimensions: PageDimension[];
  selectedIds: Set<string>;
  history: UserAction[];
  isLoading: boolean;
  isSaving: boolean; // Flag for save operation
  loadingMessage: string;
  error: string | null;
  currentView: ViewType;
  mergeSuggestions: string[][];
  hoveredId: string | null;
  
  // State for the merge modal
  isMergeModalOpen: boolean;
  mergeType: MergeType | null;
  paragraphsToMerge: AnalyzedParagraph[];
  aiMergeSuggestion: { content: string, enrichment: Record<string, any> } | null;
}

export type AppAction =
  | { type: 'SET_DATA'; payload: { document: { id: string; filename: string; }; paragraphs: AnalyzedParagraph[]; pageDimensions: PageDimension[], suggestions: string[][] } }
  | { type: 'START_PROCESSING'; payload: { id: string, filename: string } }
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SET_SELECTION'; payload: Set<string> }
  | { type: 'EDIT_PARAGRAPH'; payload: { id: string; newContent: string } }
  | { type: 'SIMPLE_MERGE'; payload: { ids: string[] } }
  | { type: 'UNMERGE_PARAGRAPH', payload: { id: string } }
  | { type: 'OPEN_AI_MERGE_MODAL'; payload: { type: MergeType } }
  | { type: 'CLOSE_AI_MERGE_MODAL' }
  | { type: 'SET_AI_SUGGESTION'; payload: { content: string, enrichment: Record<string, any> } | null }
  | { type: 'CONFIRM_AI_MERGE'; payload: { result: { content: string, enrichment: Record<string, any> }, prompt: string, customInstructions?: string } }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_HOVERED_ID'; payload: string | null }
  | { type: 'SAVE_STATE_START' }
  | { type: 'SAVE_STATE_SUCCESS' }
  | { type: 'SAVE_STATE_FAILURE'; payload: string }
  | { type: 'RESET_STATE' };


export const initialState: AppState = {
  document: null,
  initialParagraphs: [],
  paragraphs: [],
  pageDimensions: [],
  selectedIds: new Set(),
  history: [],
  isLoading: false,
  isSaving: false,
  loadingMessage: '',
  error: null,
  currentView: ViewType.TABLE,
  mergeSuggestions: [],
  hoveredId: null,
  isMergeModalOpen: false,
  mergeType: null,
  paragraphsToMerge: [],
  aiMergeSuggestion: null,
};

const performMerge = (
    paragraphs: AnalyzedParagraph[],
    idsToMerge: string[],
    newParagraphContent: string,
    enrichment: Record<string, any> | undefined
): AnalyzedParagraph[] => {
    const paragraphsToMerge = paragraphs.filter(p => idsToMerge.includes(p.id));
    if (paragraphsToMerge.length === 0) return paragraphs;

    // Use the first paragraph as the base for the new merged paragraph
    const firstPara = paragraphsToMerge[0];
    const newParagraph: AnalyzedParagraph = {
        id: generateUniqueId('merged'),
        parentId: firstPara.parentId,
        content: newParagraphContent,
        role: enrichment?.role || firstPara.role,
        level: firstPara.level,
        enrichment: enrichment,
        boundingBox: firstPara.boundingBox, // Could be improved to merge boxes
        pageNumber: firstPara.pageNumber,
        isMerged: true,
        sourceIds: idsToMerge,
    };
    
    // Filter out old paragraphs and add the new one
    const remainingParagraphs = paragraphs.filter(p => !idsToMerge.includes(p.id));
    const insertIndex = paragraphs.findIndex(p => p.id === firstPara.id);
    remainingParagraphs.splice(insertIndex >= 0 ? insertIndex : 0, 0, newParagraph);

    // Re-parent children of merged nodes to the new node
    return remainingParagraphs.map(p => {
        if (p.parentId && idsToMerge.includes(p.parentId)) {
            return { ...p, parentId: newParagraph.id };
        }
        return p;
    });
};

export const reducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...initialState,
        document: action.payload.document,
        initialParagraphs: action.payload.paragraphs,
        paragraphs: action.payload.paragraphs,
        pageDimensions: action.payload.pageDimensions,
        mergeSuggestions: action.payload.suggestions,
      };
      
    case 'START_PROCESSING':
      return {
        ...initialState,
        document: action.payload,
        isLoading: true,
        loadingMessage: 'Waiting for server...'
      };
    
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };

    case 'SET_SELECTION':
      return { ...state, selectedIds: action.payload };

    case 'EDIT_PARAGRAPH': {
      const oldParagraph = state.paragraphs.find(p => p.id === action.payload.id);
      if (!oldParagraph) return state;

      const newUserAction: UserAction = {
        type: 'EDIT_CONTENT',
        payload: { id: action.payload.id, oldContent: oldParagraph.content, newContent: action.payload.newContent }
      };

      return {
        ...state,
        paragraphs: state.paragraphs.map(p =>
          p.id === action.payload.id ? { ...p, content: action.payload.newContent } : p
        ),
        history: [...state.history, newUserAction]
      };
    }

    case 'SIMPLE_MERGE': {
      const paragraphsToMerge = state.paragraphs
        .filter(p => action.payload.ids.includes(p.id))
        .sort((a, b) => state.paragraphs.indexOf(a) - state.paragraphs.indexOf(b));

      const newContent = paragraphsToMerge.map(p => p.content).join(' ');
      const newParagraph: AnalyzedParagraph = {
        id: generateUniqueId('merged'),
        parentId: paragraphsToMerge[0]?.parentId || null,
        content: newContent,
        role: paragraphsToMerge[0]?.role || null,
        level: paragraphsToMerge[0]?.level || 0,
        boundingBox: paragraphsToMerge[0]?.boundingBox || null,
        pageNumber: paragraphsToMerge[0]?.pageNumber || null,
        isMerged: true,
        sourceIds: action.payload.ids,
      };

      const newUserAction: UserAction = { type: 'SIMPLE_MERGE', payload: { ids: action.payload.ids, newParagraph } };

      const newParagraphs = performMerge(state.paragraphs, action.payload.ids, newContent, undefined);
      
      return {
        ...state,
        paragraphs: newParagraphs,
        selectedIds: new Set(),
        history: [...state.history, newUserAction]
      };
    }
    
    case 'UNMERGE_PARAGRAPH': {
      const mergedPara = state.paragraphs.find(p => p.id === action.payload.id);
      if (!mergedPara || !mergedPara.isMerged || !mergedPara.sourceIds) {
        return state;
      }
      
      const originalParagraphs = state.initialParagraphs.filter(p => mergedPara.sourceIds!.includes(p.id));
      
      // Remove the merged paragraph and insert the original ones in its place
      const mergedIndex = state.paragraphs.findIndex(p => p.id === action.payload.id);
      const paragraphsCopy = [...state.paragraphs];
      paragraphsCopy.splice(mergedIndex, 1, ...originalParagraphs);

      // Re-parent any children that were attached to the merged paragraph
      const finalParagraphs = paragraphsCopy.map(p => {
        if (p.parentId === mergedPara.id) {
          // Find original parent from initial state
          const originalChild = state.initialParagraphs.find(ip => ip.id === p.id);
          return { ...p, parentId: originalChild?.parentId || null };
        }
        return p;
      });

      return {
        ...state,
        paragraphs: finalParagraphs,
        selectedIds: new Set(), // Clear selection after unmerging
      };
    }
    
    case 'OPEN_AI_MERGE_MODAL': {
      const paragraphsToMerge = state.paragraphs
        .filter(p => state.selectedIds.has(p.id))
        .sort((a, b) => state.paragraphs.indexOf(a) - state.paragraphs.indexOf(b));
      return {
        ...state,
        isMergeModalOpen: true,
        mergeType: action.payload.type,
        paragraphsToMerge,
        aiMergeSuggestion: null, // Reset suggestion
      };
    }

    case 'CLOSE_AI_MERGE_MODAL':
      return {
        ...state,
        isMergeModalOpen: false,
        isLoading: false, // Ensure loading is off
        loadingMessage: '',
        mergeType: null,
        paragraphsToMerge: [],
      };
      
    case 'SET_AI_SUGGESTION':
        return {
            ...state,
            aiMergeSuggestion: action.payload,
            isLoading: false,
            loadingMessage: '',
        }
    
    case 'CONFIRM_AI_MERGE': {
      const idsToMerge = state.paragraphsToMerge.map(p => p.id);
      const newParagraph: AnalyzedParagraph = {
        id: generateUniqueId('merged'),
        parentId: state.paragraphsToMerge[0]?.parentId || null,
        content: action.payload.result.content,
        role: action.payload.result.enrichment?.role || state.paragraphsToMerge[0]?.role || null,
        level: state.paragraphsToMerge[0]?.level || 0,
        enrichment: action.payload.result.enrichment,
        boundingBox: state.paragraphsToMerge[0]?.boundingBox || null,
        pageNumber: state.paragraphsToMerge[0]?.pageNumber || null,
        isMerged: true,
        sourceIds: idsToMerge,
      };
      
      const newUserAction: UserAction = { type: 'AI_MERGE', payload: { ids: idsToMerge, newParagraph, prompt: action.payload.prompt, customInstructions: action.payload.customInstructions } };
      
      const newParagraphs = performMerge(state.paragraphs, idsToMerge, newParagraph.content, newParagraph.enrichment);
      
      return {
        ...state,
        paragraphs: newParagraphs,
        selectedIds: new Set(),
        history: [...state.history, newUserAction],
        isMergeModalOpen: false,
        mergeType: null,
        paragraphsToMerge: [],
        aiMergeSuggestion: null,
      };
    }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.message || '',
        error: action.payload.isLoading ? null : state.error, // Clear error on new loading
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false, loadingMessage: '' };
      
    case 'SET_HOVERED_ID':
        return { ...state, hoveredId: action.payload };
        
    case 'SAVE_STATE_START':
      return { ...state, isSaving: true, error: null };
      
    case 'SAVE_STATE_SUCCESS':
      return { ...state, isSaving: false };
      
    case 'SAVE_STATE_FAILURE':
      return { ...state, isSaving: false, error: action.payload };

    case 'RESET_STATE':
        return initialState;

    default:
      return state;
  }
};
