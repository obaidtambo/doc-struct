import React, { useReducer, useState, useCallback, useEffect } from 'react';
import { AnalyzedParagraph, DocumentStatus, ViewType, MergeType } from './types';
import Header from './components/Header';
import ResizablePanels from './components/ResizablePanels';
import PdfViewer from './components/PdfViewer';
import TableView from './components/TableView';
import GraphView from './components/GraphView';
import ActionBar from './components/ActionBar';
import Loader from './components/Loader';
import ErrorMessage from './components/ErrorMessage';
import MergeModal from './components/MergeModal';
import DownloadMenu from './components/DownloadMenu';
import { reducer, initialState } from './state/reducer';
import { normalizeParagraphs, extractOrGeneratePageDimensions } from './utils';
import { getAiMergeSuggestion } from './agents/mergeAgent';
import { generateMergeSuggestions } from './agents/suggestionAgent';
import { uploadPdf, getDocumentStatus, saveDocumentState } from './services/apiService';
import Logger from './services/logger';
import { FileUp, GitBranch, Wand, Database } from './components/Icons';
import { keysToCamel } from './utils/caseConverter';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [graphSvg, setGraphSvg] = useState<SVGSVGElement | null>(null);

  const loadData = useCallback((data: any, docId: string, filename: string) => {
    Logger.info('Loading and processing final data from backend');
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Normalizing data...' } });
    try {
      const paragraphs = normalizeParagraphs(data.paragraphs);
      const pageDimensions = extractOrGeneratePageDimensions(data, paragraphs);
      const suggestions = generateMergeSuggestions(paragraphs);
      dispatch({ type: 'SET_DATA', payload: { paragraphs, pageDimensions, suggestions, document: { id: docId, filename } } });
      Logger.info('Data loaded and processed successfully');
    } catch (error: any) {
      Logger.error('Failed to process final data', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to process data' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, []);
  
  const loadSampleData = useCallback(async () => {
    Logger.info('Attempting to load sample data...');
    dispatch({ type: 'RESET_STATE' });
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Loading sample document...' } });

    try {
        const [pdfBlob, rawJsonData] = await Promise.all([
             fetch('./Obaid_Tamboli_CV.pdf').then(res => {
                if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}. Ensure 'Obaid_Tamboli_CV.pdf' is in the root directory.`);
                return res.blob();
            }),
             fetch('./Obaid_Tamboli_CV_1757852307_flattened_initial.json').then(res => {
                if (!res.ok) throw new Error(`Failed to fetch JSON: ${res.statusText}`);
                return res.json();
            })
        ]);
        
        // Convert snake_case from JSON file to camelCase for app consistency
        const jsonData = keysToCamel(rawJsonData);

        const samplePdfFile = new File([pdfBlob], 'Obaid_Tamboli_CV.pdf', { type: 'application/pdf' });
        setPdfFile(samplePdfFile);

        // Simulate a loaded document state
        const docId = jsonData.documentId || 'sample-document';
        loadData(jsonData, docId, samplePdfFile.name);
        Logger.info('Sample data loaded successfully.');

    } catch(err: any) {
        Logger.error("Failed to load sample data", err);
        dispatch({ type: 'SET_ERROR', payload: err.message || 'Failed to load sample data.' });
        dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, loadData]);

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Logger.info('PDF file selected for upload', { name: file.name, size: file.size });
      dispatch({ type: 'RESET_STATE' });
      setPdfFile(file);
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Uploading PDF...' } });
      try {
        const { documentId } = await uploadPdf(file);
        Logger.info('PDF upload successful, starting processing...', { documentId });
        dispatch({ type: 'START_PROCESSING', payload: { id: documentId, filename: file.name } });
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'PDF upload failed.' });
      }
    }
  };

  // Polling effect for document status
  useEffect(() => {
    if (!state.document?.id || state.paragraphs.length > 0) {
      return; // Don't poll if we don't have an ID or if data is already loaded
    }

    let isCancelled = false;
    let pollCount = 0;
    Logger.info('Starting status polling for document', { id: state.document.id });
    const pollStatus = async () => {
      // Stop polling after a long time to prevent infinite loops on stalled jobs
      pollCount++;
      if (pollCount > 100) {
          Logger.warn('Polling timed out after 100 attempts.');
          dispatch({ type: 'SET_ERROR', payload: 'Processing timed out. Please try uploading again.' });
          return;
      }
        
      try {
        const statusData = await getDocumentStatus(state.document!.id);
        if (isCancelled) return;
        
        Logger.info('Received status update', statusData);
        const { status, finalData, errorMessage } = statusData;
        const friendlyMessages: Record<DocumentStatus, string> = {
            'OCR_IN_PROGRESS': 'Performing OCR on document...',
            'OCR_COMPLETED': 'Correcting document hierarchy...',
            'CORRECTION_IN_PROGRESS': 'Correcting document hierarchy...',
            'CORRECTION_COMPLETED': 'Preparing data for display...',
            'FLATTENING_IN_PROGRESS': 'Preparing data for display...',
            'COMPLETED': 'Processing complete!',
            'FAILED': 'Processing failed.',
        };

        const isProcessing = status !== 'COMPLETED' && status !== 'FAILED';
        dispatch({
          type: 'SET_LOADING',
          payload: { isLoading: isProcessing, message: friendlyMessages[status] || 'Processing...' }
        });
        
        if (status === 'COMPLETED' && finalData) {
          Logger.info('Processing complete. Final data received.', finalData);
          if (pdfFile) {
            loadData(finalData, state.document!.id, pdfFile.name);
          } else {
             Logger.error('Processing complete, but PDF file was lost from state.');
             dispatch({ type: 'SET_ERROR', payload: 'Processing complete, but PDF file was lost.' });
          }
        } else if (status === 'FAILED') {
          Logger.error('Document processing failed on backend.', { errorMessage });
          dispatch({ type: 'SET_ERROR', payload: errorMessage || 'An unknown error occurred during processing.' });
        } else if (isProcessing) {
          // If still processing, schedule the next poll
          setTimeout(() => {
            if (!isCancelled) pollStatus();
          }, 3000);
        }

      } catch (error: any) {
        if (isCancelled) return;
        Logger.error('Failed to get document status.', error);
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to get document status.' });
      }
    };
    
    pollStatus(); // Initial check

    return () => {
      Logger.info('Stopping status polling for document', { id: state.document?.id });
      isCancelled = true;
    };
  }, [state.document, state.paragraphs.length, dispatch, loadData, pdfFile]);


  const handleSelectionChange = useCallback((ids: Set<string>) => {
    dispatch({ type: 'SET_SELECTION', payload: ids });
  }, []);

  const handleEditSave = useCallback((id: string, newContent: string) => {
    dispatch({ type: 'EDIT_PARAGRAPH', payload: { id, newContent } });
  }, []);
  
  const handleUnmerge = useCallback((id: string) => {
    dispatch({ type: 'UNMERGE_PARAGRAPH', payload: { id } });
  }, []);

  const handleConcatMerge = useCallback(() => {
    if (state.selectedIds.size < 2) return;
    dispatch({ type: 'SIMPLE_MERGE', payload: { ids: Array.from(state.selectedIds) } });
  }, [state.selectedIds]);
  
  const handleAiMerge = useCallback(async (type: MergeType, customInstructions?: string) => {
      const paragraphsToMerge = state.paragraphs
        .filter(p => state.selectedIds.has(p.id))
        .sort((a, b) => state.paragraphs.indexOf(a) - state.paragraphs.indexOf(b));

      if(type === 'AI_DEFAULT') {
          dispatch({ type: 'OPEN_AI_MERGE_MODAL', payload: { type } });
          dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Generating AI suggestion...' } });
          try {
              const suggestion = await getAiMergeSuggestion(paragraphsToMerge);
              dispatch({ type: 'SET_AI_SUGGESTION', payload: suggestion });
          } catch(e: any) {
              dispatch({ type: 'CLOSE_AI_MERGE_MODAL' });
              dispatch({ type: 'SET_ERROR', payload: e.message || "AI merge failed." });
          }
      } else if (type === 'AI_CUSTOM') {
          if (!customInstructions) {
             dispatch({ type: 'OPEN_AI_MERGE_MODAL', payload: { type } });
          } else {
             dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Generating AI suggestion...' } });
             try {
                const suggestion = await getAiMergeSuggestion(state.paragraphsToMerge, customInstructions);
                dispatch({ type: 'SET_AI_SUGGESTION', payload: suggestion });
             } catch(e: any) {
                dispatch({ type: 'CLOSE_AI_MERGE_MODAL' });
                dispatch({ type: 'SET_ERROR', payload: e.message || "AI merge failed." });
             }
          }
      }
  }, [state.paragraphs, state.selectedIds, state.paragraphsToMerge]);
  
  const handleConfirmAiMerge = useCallback((result: { content: string, enrichment: Record<string, string> }, customInstructions?: string) => {
    dispatch({ type: 'CONFIRM_AI_MERGE', payload: { result, prompt: "Default Prompt", customInstructions }});
  }, []);
  
  const handleSaveChanges = async () => {
    if (!state.document) {
        Logger.warn('Save Changes clicked but no document is loaded.');
        dispatch({ type: 'SET_ERROR', payload: "No document loaded to save."});
        return;
    }
    Logger.info('Attempting to save document state...', { id: state.document.id });
    dispatch({ type: 'SAVE_STATE_START' });
    try {
        await saveDocumentState(state);
        Logger.info('Document state saved successfully.');
        dispatch({ type: 'SAVE_STATE_SUCCESS' });
        // Optional: show a success notification
    } catch (e: any) {
        dispatch({ type: 'SAVE_STATE_FAILURE', payload: e.message || 'Failed to save state.' });
    }
  };

  const renderUploadView = () => (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-base-100 text-content-primary p-4 font-sans">
      <div className="max-w-3xl text-center">
        <h2 className="text-4xl font-bold mb-3 tracking-tight">Welcome to Docu-Struct Workbench</h2>
        <p className="text-lg text-content-secondary mb-8 max-w-2xl mx-auto">
          A Git-style workbench for converting PDFs to structured data. Build better RAGs with human-in-the-loop control and complete version history.
        </p>

        {state.isLoading ? (
            <Loader message={state.loadingMessage} />
        ) : state.error ? (
            <div className="my-4">
                <ErrorMessage message={state.error} />
                <button
                    onClick={() => dispatch({ type: 'RESET_STATE' })}
                    className="mt-4 px-4 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors"
                >
                    Try Again
                </button>
            </div>
        ) : (
            <div className="flex items-center justify-center gap-4">
                <label className="cursor-pointer px-6 py-3 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors flex items-center gap-2 shadow-sm">
                    <FileUp className="w-5 h-5" />
                    Upload PDF for Analysis
                    <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
                </label>
                <button
                    onClick={loadSampleData}
                    className="px-6 py-3 bg-base-100 text-content-primary font-semibold rounded-md hover:bg-base-200 ring-1 ring-base-300 transition-colors"
                >
                    Use Sample Data
                </button>
            </div>
        )}

        <div className="mt-16 text-left border-t border-base-300 pt-8">
          <h3 className="text-xl font-bold text-center mb-6">A Version Control System for Your Documents</h3>
          <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-brand-light rounded-full mb-3">
                      <GitBranch className="w-7 h-7 text-brand-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">Commit-like Edits</h4>
                  <p className="text-sm text-content-secondary">
                      Edit, merge, and split content blocks. Every action is tracked, allowing you to unmerge and revert changes.
                  </p>
              </div>
              <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-brand-light rounded-full mb-3">
                      <Wand className="w-7 h-7 text-brand-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">AI-Assisted Structuring</h4>
                  <p className="text-sm text-content-secondary">
                      Leverage AI to intelligently merge paragraphs, but always with your final approval. You are in control.
                  </p>
              </div>
              <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-brand-light rounded-full mb-3">
                      <Database className="w-7 h-7 text-brand-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">Export Structured Data</h4>
                  <p className="text-sm text-content-secondary">
                      Once structured, export your clean data as JSON or CSV to feed into RAG pipelines or other systems.
                  </p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  if (state.paragraphs.length === 0) {
    return renderUploadView();
  }

  return (
    <div className="w-full h-screen flex flex-col bg-base-200 text-content-primary">
      <Header 
        isSaving={state.isSaving} 
        onSaveChanges={handleSaveChanges} 
        documentName={state.document?.filename} 
      />

      <main className="flex-grow flex flex-col overflow-hidden">
        <div className="p-3 bg-base-100 border-b border-base-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: ViewType.TABLE })}
                    className={`px-3 py-1.5 text-sm rounded-md ${state.currentView === ViewType.TABLE ? 'bg-brand-primary text-white' : 'bg-base-100 hover:bg-base-200 ring-1 ring-inset ring-base-300'}`}
                >
                    Table
                </button>
                <button
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: ViewType.GRAPH })}
                    className={`px-3 py-1.5 text-sm rounded-md ${state.currentView === ViewType.GRAPH ? 'bg-brand-primary text-white' : 'bg-base-100 hover:bg-base-200 ring-1 ring-inset ring-base-300'}`}
                >
                    Graph
                </button>
            </div>
             <DownloadMenu data={state.paragraphs} activeView={state.currentView} svgElement={graphSvg} />
        </div>

        {state.error && <ErrorMessage message={state.error} />}

        <div className="flex-grow overflow-hidden">
            <ResizablePanels
                left={
                    <div className="h-full flex flex-col">
                         {state.selectedIds.size > 0 && (
                            <ActionBar
                                selectedCount={state.selectedIds.size}
                                onConcatMerge={handleConcatMerge}
                                onAiMerge={handleAiMerge}
                            />
                        )}
                        <div className="flex-grow overflow-y-auto">
                            {state.isLoading ? (
                                <Loader message={state.loadingMessage} />
                            ) : state.currentView === ViewType.TABLE ? (
                                <TableView
                                    paragraphs={state.paragraphs}
                                    selectedIds={state.selectedIds}
                                    onSelectionChange={handleSelectionChange}
                                    onEditSave={handleEditSave}
                                    onUnmerge={handleUnmerge}
                                    mergeSuggestions={state.mergeSuggestions}
                                    onHoverRow={(id) => dispatch({ type: 'SET_HOVERED_ID', payload: id })}
                                />
                            ) : (
                                <GraphView
                                    paragraphs={state.paragraphs}
                                    selectedIds={state.selectedIds}
                                    onSelectionChange={handleSelectionChange}
                                    onHoverRow={(id) => dispatch({ type: 'SET_HOVERED_ID', payload: id })}
                                    setSvgElement={setGraphSvg}
                                />
                            )}
                        </div>
                    </div>
                }
                right={
                     <PdfViewer
                        pdfSource={pdfFile}
                        paragraphs={state.paragraphs}
                        pageDimensions={state.pageDimensions}
                        hoveredId={state.hoveredId}
                    />
                }
            />
        </div>
      </main>
      
      <MergeModal 
        isOpen={state.isMergeModalOpen}
        onClose={() => dispatch({ type: 'CLOSE_AI_MERGE_MODAL' })}
        paragraphsToMerge={state.paragraphsToMerge}
        suggestedResult={state.aiMergeSuggestion}
        onConfirmMerge={handleConfirmAiMerge}
        isLoading={state.isLoading && state.isMergeModalOpen}
        mergeType={state.mergeType}
        onRunWithInstructions={handleAiMerge}
      />
    </div>
  );
};

export default App;

// import React, { useReducer, useState, useCallback, useEffect } from 'react';
// import { AnalyzedParagraph, DocumentStatus, ViewType, MergeType } from './types';
// import Header from './components/Header';
// import ResizablePanels from './components/ResizablePanels';
// import PdfViewer from './components/PdfViewer';
// import TableView from './components/TableView';
// import GraphView from './components/GraphView';
// import ActionBar from './components/ActionBar';
// import Loader from './components/Loader';
// import ErrorMessage from './components/ErrorMessage';
// import MergeModal from './components/MergeModal';
// import DownloadMenu from './components/DownloadMenu';
// import { reducer, initialState } from './state/reducer';
// import { normalizeParagraphs, extractOrGeneratePageDimensions } from './utils';
// import { getAiMergeSuggestion } from './agents/mergeAgent';
// import { generateMergeSuggestions } from './agents/suggestionAgent';
// import { uploadPdf, getDocumentStatus, saveDocumentState } from './services/apiService';
// import Logger from './services/logger';
// import { FileUp } from './components/Icons';
// import { keysToCamel } from './utils/caseConverter';

// const App: React.FC = () => {
//   const [state, dispatch] = useReducer(reducer, initialState);
//   const [pdfFile, setPdfFile] = useState<File | null>(null);
//   const [graphSvg, setGraphSvg] = useState<SVGSVGElement | null>(null);

//   const loadData = useCallback((data: any, docId: string, filename: string) => {
//     Logger.info('Loading and processing final data from backend');
//     dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Normalizing data...' } });
//     try {
//       const paragraphs = normalizeParagraphs(data.paragraphs);
//       const pageDimensions = extractOrGeneratePageDimensions(data, paragraphs);
//       const suggestions = generateMergeSuggestions(paragraphs);
//       dispatch({ type: 'SET_DATA', payload: { paragraphs, pageDimensions, suggestions, document: { id: docId, filename } } });
//       Logger.info('Data loaded and processed successfully');
//     } catch (error: any) {
//       Logger.error('Failed to process final data', error);
//       dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to process data' });
//     } finally {
//       dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
//     }
//   }, []);
  
//   const loadSampleData = useCallback(async () => {
//     Logger.info('Attempting to load sample data...');
//     dispatch({ type: 'RESET_STATE' });
//     dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Loading sample document...' } });

//     try {
//         const [pdfBlob, rawJsonData] = await Promise.all([
//              fetch('./Obaid_Tamboli_CV.pdf').then(res => {
//                 if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}. Ensure 'Obaid_Tamboli_CV.pdf' is in the root directory.`);
//                 return res.blob();
//             }),
//              fetch('./Obaid_Tamboli_CV_1757852307_flattened_initial.json').then(res => {
//                 if (!res.ok) throw new Error(`Failed to fetch JSON: ${res.statusText}`);
//                 return res.json();
//             })
//         ]);
        
//         // Convert snake_case from JSON file to camelCase for app consistency
//         const jsonData = keysToCamel(rawJsonData);

//         const samplePdfFile = new File([pdfBlob], 'Obaid_Tamboli_CV.pdf', { type: 'application/pdf' });
//         setPdfFile(samplePdfFile);

//         // Simulate a loaded document state
//         const docId = jsonData.documentId || 'sample-document';
//         loadData(jsonData, docId, samplePdfFile.name);
//         Logger.info('Sample data loaded successfully.');

//     } catch(err: any) {
//         Logger.error("Failed to load sample data", err);
//         dispatch({ type: 'SET_ERROR', payload: err.message || 'Failed to load sample data.' });
//         dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
//     }
//   }, [dispatch, loadData]);

//   const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (file) {
//       Logger.info('PDF file selected for upload', { name: file.name, size: file.size });
//       dispatch({ type: 'RESET_STATE' });
//       setPdfFile(file);
//       dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Uploading PDF...' } });
//       try {
//         const { documentId } = await uploadPdf(file);
//         Logger.info('PDF upload successful, starting processing...', { documentId });
//         dispatch({ type: 'START_PROCESSING', payload: { id: documentId, filename: file.name } });
//       } catch (error: any) {
//         dispatch({ type: 'SET_ERROR', payload: error.message || 'PDF upload failed.' });
//       }
//     }
//   };

//   // Polling effect for document status
//   useEffect(() => {
//     if (!state.document?.id || state.paragraphs.length > 0) {
//       return; // Don't poll if we don't have an ID or if data is already loaded
//     }

//     let isCancelled = false;
//     let pollCount = 0;
//     Logger.info('Starting status polling for document', { id: state.document.id });
//     const pollStatus = async () => {
//       // Stop polling after a long time to prevent infinite loops on stalled jobs
//       pollCount++;
//       if (pollCount > 100) {
//           Logger.warn('Polling timed out after 100 attempts.');
//           dispatch({ type: 'SET_ERROR', payload: 'Processing timed out. Please try uploading again.' });
//           return;
//       }
        
//       try {
//         const statusData = await getDocumentStatus(state.document!.id);
//         if (isCancelled) return;
        
//         Logger.info('Received status update', statusData);
//         const { status, finalData, errorMessage } = statusData;
//         const friendlyMessages: Record<DocumentStatus, string> = {
//             'OCR_IN_PROGRESS': 'Performing OCR on document...',
//             'OCR_COMPLETED': 'Correcting document hierarchy...',
//             'CORRECTION_IN_PROGRESS': 'Correcting document hierarchy...',
//             'CORRECTION_COMPLETED': 'Preparing data for display...',
//             'FLATTENING_IN_PROGRESS': 'Preparing data for display...',
//             'COMPLETED': 'Processing complete!',
//             'FAILED': 'Processing failed.',
//         };

//         const isProcessing = status !== 'COMPLETED' && status !== 'FAILED';
//         dispatch({
//           type: 'SET_LOADING',
//           payload: { isLoading: isProcessing, message: friendlyMessages[status] || 'Processing...' }
//         });
        
//         if (status === 'COMPLETED' && finalData) {
//           Logger.info('Processing complete. Final data received.', finalData);
//           if (pdfFile) {
//             loadData(finalData, state.document!.id, pdfFile.name);
//           } else {
//              Logger.error('Processing complete, but PDF file was lost from state.');
//              dispatch({ type: 'SET_ERROR', payload: 'Processing complete, but PDF file was lost.' });
//           }
//         } else if (status === 'FAILED') {
//           Logger.error('Document processing failed on backend.', { errorMessage });
//           dispatch({ type: 'SET_ERROR', payload: errorMessage || 'An unknown error occurred during processing.' });
//         } else if (isProcessing) {
//           // If still processing, schedule the next poll
//           setTimeout(() => {
//             if (!isCancelled) pollStatus();
//           }, 3000);
//         }

//       } catch (error: any) {
//         if (isCancelled) return;
//         Logger.error('Failed to get document status.', error);
//         dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to get document status.' });
//       }
//     };
    
//     pollStatus(); // Initial check

//     return () => {
//       Logger.info('Stopping status polling for document', { id: state.document?.id });
//       isCancelled = true;
//     };
//   }, [state.document, state.paragraphs.length, dispatch, loadData, pdfFile]);


//   const handleSelectionChange = useCallback((ids: Set<string>) => {
//     dispatch({ type: 'SET_SELECTION', payload: ids });
//   }, []);

//   const handleEditSave = useCallback((id: string, newContent: string) => {
//     dispatch({ type: 'EDIT_PARAGRAPH', payload: { id, newContent } });
//   }, []);
  
//   const handleUnmerge = useCallback((id: string) => {
//     dispatch({ type: 'UNMERGE_PARAGRAPH', payload: { id } });
//   }, []);

//   const handleConcatMerge = useCallback(() => {
//     if (state.selectedIds.size < 2) return;
//     dispatch({ type: 'SIMPLE_MERGE', payload: { ids: Array.from(state.selectedIds) } });
//   }, [state.selectedIds]);
  
//   const handleAiMerge = useCallback(async (type: MergeType, customInstructions?: string) => {
//       const paragraphsToMerge = state.paragraphs
//         .filter(p => state.selectedIds.has(p.id))
//         .sort((a, b) => state.paragraphs.indexOf(a) - state.paragraphs.indexOf(b));

//       if(type === 'AI_DEFAULT') {
//           dispatch({ type: 'OPEN_AI_MERGE_MODAL', payload: { type } });
//           dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Generating AI suggestion...' } });
//           try {
//               const suggestion = await getAiMergeSuggestion(paragraphsToMerge);
//               dispatch({ type: 'SET_AI_SUGGESTION', payload: suggestion });
//           } catch(e: any) {
//               dispatch({ type: 'CLOSE_AI_MERGE_MODAL' });
//               dispatch({ type: 'SET_ERROR', payload: e.message || "AI merge failed." });
//           }
//       } else if (type === 'AI_CUSTOM') {
//           if (!customInstructions) {
//              dispatch({ type: 'OPEN_AI_MERGE_MODAL', payload: { type } });
//           } else {
//              dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Generating AI suggestion...' } });
//              try {
//                 const suggestion = await getAiMergeSuggestion(state.paragraphsToMerge, customInstructions);
//                 dispatch({ type: 'SET_AI_SUGGESTION', payload: suggestion });
//              } catch(e: any) {
//                 dispatch({ type: 'CLOSE_AI_MERGE_MODAL' });
//                 dispatch({ type: 'SET_ERROR', payload: e.message || "AI merge failed." });
//              }
//           }
//       }
//   }, [state.paragraphs, state.selectedIds, state.paragraphsToMerge]);
  
//   const handleConfirmAiMerge = useCallback((result: { content: string, enrichment: Record<string, string> }, customInstructions?: string) => {
//     dispatch({ type: 'CONFIRM_AI_MERGE', payload: { result, prompt: "Default Prompt", customInstructions }});
//   }, []);
  
//   const handleSaveChanges = async () => {
//     if (!state.document) {
//         Logger.warn('Save Changes clicked but no document is loaded.');
//         dispatch({ type: 'SET_ERROR', payload: "No document loaded to save."});
//         return;
//     }
//     Logger.info('Attempting to save document state...', { id: state.document.id });
//     dispatch({ type: 'SAVE_STATE_START' });
//     try {
//         await saveDocumentState(state);
//         Logger.info('Document state saved successfully.');
//         dispatch({ type: 'SAVE_STATE_SUCCESS' });
//         // Optional: show a success notification
//     } catch (e: any) {
//         dispatch({ type: 'SAVE_STATE_FAILURE', payload: e.message || 'Failed to save state.' });
//     }
//   };

//   const renderUploadView = () => (
//     <div className="w-full h-screen flex flex-col items-center justify-center bg-base-200 text-center p-4">
//       <div className="max-w-xl">
//         <h2 className="text-3xl font-bold mb-2">Welcome to Docu-Struct Workbench</h2>
//         <p className="text-content-secondary mb-6">
//             This tool helps you analyze, visualize, and restructure documents using AI.
//             Start by uploading a PDF to have it processed by our backend pipeline.
//         </p>

//         {state.isLoading ? (
//             <Loader message={state.loadingMessage} />
//         ) : state.error ? (
//             <div className="my-4">
//                 <ErrorMessage message={state.error} />
//                 <button
//                     onClick={() => dispatch({ type: 'RESET_STATE' })}
//                     className="mt-4 px-4 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors"
//                 >
//                     Try Again
//                 </button>
//             </div>
//         ) : (
//             <div className="flex items-center justify-center gap-4">
//                 <label className="cursor-pointer px-4 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors flex items-center gap-2">
//                     <FileUp className="w-5 h-5" />
//                     Upload PDF for Analysis
//                     <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
//                 </label>
//                 <button
//                     onClick={loadSampleData}
//                     className="px-4 py-2 bg-base-300 text-content-primary font-semibold rounded-md hover:bg-base-300/80 transition-colors"
//                 >
//                     Use Sample Data
//                 </button>
//             </div>
//         )}
//       </div>
//     </div>
//   );
  
//   if (state.paragraphs.length === 0) {
//     return renderUploadView();
//   }

//   return (
//     <div className="w-full h-screen flex flex-col bg-base-200 text-content-primary">
//       <Header 
//         isSaving={state.isSaving} 
//         onSaveChanges={handleSaveChanges} 
//         documentName={state.document?.filename} 
//       />

//       <main className="flex-grow flex flex-col overflow-hidden">
//         <div className="p-3 bg-base-100 border-b border-base-300 flex items-center justify-between">
//             <div className="flex items-center gap-2">
//                 <button 
//                     onClick={() => dispatch({ type: 'SET_VIEW', payload: ViewType.TABLE })}
//                     className={`px-3 py-1.5 text-sm rounded-md ${state.currentView === ViewType.TABLE ? 'bg-brand-primary text-white' : 'bg-base-300 hover:bg-base-300/80'}`}
//                 >
//                     Table
//                 </button>
//                 <button
//                     onClick={() => dispatch({ type: 'SET_VIEW', payload: ViewType.GRAPH })}
//                     className={`px-3 py-1.5 text-sm rounded-md ${state.currentView === ViewType.GRAPH ? 'bg-brand-primary text-white' : 'bg-base-300 hover:bg-base-300/80'}`}
//                 >
//                     Graph
//                 </button>
//             </div>
//              <DownloadMenu data={state.paragraphs} activeView={state.currentView} svgElement={graphSvg} />
//         </div>

//         {state.error && <ErrorMessage message={state.error} />}

//         <div className="flex-grow overflow-hidden">
//             <ResizablePanels
//                 left={
//                     <div className="h-full flex flex-col">
//                          {state.selectedIds.size > 0 && (
//                             <ActionBar
//                                 selectedCount={state.selectedIds.size}
//                                 onConcatMerge={handleConcatMerge}
//                                 onAiMerge={handleAiMerge}
//                             />
//                         )}
//                         <div className="flex-grow overflow-y-auto">
//                             {state.isLoading ? (
//                                 <Loader message={state.loadingMessage} />
//                             ) : state.currentView === ViewType.TABLE ? (
//                                 <TableView
//                                     paragraphs={state.paragraphs}
//                                     selectedIds={state.selectedIds}
//                                     onSelectionChange={handleSelectionChange}
//                                     onEditSave={handleEditSave}
//                                     onUnmerge={handleUnmerge}
//                                     mergeSuggestions={state.mergeSuggestions}
//                                     onHoverRow={(id) => dispatch({ type: 'SET_HOVERED_ID', payload: id })}
//                                 />
//                             ) : (
//                                 <GraphView
//                                     paragraphs={state.paragraphs}
//                                     selectedIds={state.selectedIds}
//                                     onSelectionChange={handleSelectionChange}
//                                     onHoverRow={(id) => dispatch({ type: 'SET_HOVERED_ID', payload: id })}
//                                     setSvgElement={setGraphSvg}
//                                 />
//                             )}
//                         </div>
//                     </div>
//                 }
//                 right={
//                      <PdfViewer
//                         pdfSource={pdfFile}
//                         paragraphs={state.paragraphs}
//                         pageDimensions={state.pageDimensions}
//                         hoveredId={state.hoveredId}
//                     />
//                 }
//             />
//         </div>
//       </main>
      
//       <MergeModal 
//         isOpen={state.isMergeModalOpen}
//         onClose={() => dispatch({ type: 'CLOSE_AI_MERGE_MODAL' })}
//         paragraphsToMerge={state.paragraphsToMerge}
//         suggestedResult={state.aiMergeSuggestion}
//         onConfirmMerge={handleConfirmAiMerge}
//         isLoading={state.isLoading && state.isMergeModalOpen}
//         mergeType={state.mergeType}
//         onRunWithInstructions={handleAiMerge}
//       />
//     </div>
//   );
// };

// export default App;
