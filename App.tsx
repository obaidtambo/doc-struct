
import React, { useState, useCallback, useEffect } from 'react';
import { AnalyzedParagraph, ViewType, PageDimension, OcrExtractionResult, BoundingBox } from './types';
import { processDocument, runAiAnalysisOnOcr } from './services/documentAnalysisPipeline';
import { getMergeSuggestions, generateMergeResult } from './services/hitlAgents';
import Header from './components/Header';
import TableView from './components/TableView';
import GraphView from './components/GraphView';
import Loader from './components/Loader';
import ErrorMessage from './components/ErrorMessage';
import DownloadMenu from './components/DownloadMenu';
import { Database, GitBranch, FileUp, LayoutColumns, Wand, Merge } from './components/Icons';
import PdfViewer from './components/PdfViewer';
import MergeModal from './components/MergeModal';

// Helper function to convert a File to a Data URL
const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Helper function to convert a Data URL back to a File
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error("Invalid Data URL");
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

const calculateCombinedBoundingBox = (
    paragraphs: AnalyzedParagraph[]
): { boundingBox: BoundingBox | null; pageNumber: number | null } => {
    if (paragraphs.length === 0) {
        return { boundingBox: null, pageNumber: null };
    }

    const validParas = paragraphs.filter(p => p.boundingBox && p.pageNumber !== null);
    if (validParas.length === 0) {
        return { boundingBox: null, pageNumber: null };
    }

    const firstPara = validParas[0];
    const firstPageNumber = firstPara.pageNumber;

    const allOnSamePage = validParas.every(p => p.pageNumber === firstPageNumber);

    if (allOnSamePage) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        validParas.forEach(({ boundingBox: box }) => {
            if (box) {
                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.width);
                maxY = Math.max(maxY, box.y + box.height);
            }
        });

        return {
            boundingBox: {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
            },
            pageNumber: firstPageNumber,
        };
    } else {
        // Fallback for multi-page merges: use the first valid paragraph's data.
        return {
            boundingBox: firstPara.boundingBox,
            pageNumber: firstPara.pageNumber,
        };
    }
};


const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfSource, setPdfSource] = useState<File | null>(null);
  const [uploadedOcrData, setUploadedOcrData] = useState<OcrExtractionResult | null>(null);
  const [rawOcrForDownload, setRawOcrForDownload] = useState<OcrExtractionResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [paragraphs, setParagraphs] = useState<AnalyzedParagraph[]>([]);
  const [pageDimensions, setPageDimensions] = useState<PageDimension[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>(ViewType.TABLE);
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const [showPdf, setShowPdf] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [hoveredParagraphId, setHoveredParagraphId] = useState<string | null>(null);

  // Human-in-the-loop (HITL) state
  const [isHitlMode, setIsHitlMode] = useState<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [mergeSuggestions, setMergeSuggestions] = useState<string[][]>([]);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [mergeCandidates, setMergeCandidates] = useState<AnalyzedParagraph[]>([]);
  const [suggestedMergeResult, setSuggestedMergeResult] = useState<{ content: string, enrichment: Record<string, string> } | null>(null);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // Load state from localStorage on initial mount
  useEffect(() => {
    const savedState = localStorage.getItem('savedAnalysisState');
    if (savedState) {
        try {
            const { paragraphs, pageDimensions, fileName, pdfDataUrl, isLocked: savedIsLocked } = JSON.parse(savedState);
            if (paragraphs && pageDimensions && fileName && savedIsLocked) {
                setParagraphs(paragraphs);
                setPageDimensions(pageDimensions);
                setFileName(fileName);
                if (pdfDataUrl) {
                    const pdfFile = dataURLtoFile(pdfDataUrl, fileName);
                    setPdfSource(pdfFile);
                    setShowPdf(true);
                }
                setIsLocked(true); // Always lock if state is restored
            }
        } catch (e) {
            console.error("Failed to load saved state from localStorage", e);
            localStorage.removeItem('savedAnalysisState');
        }
    }
  }, []);

  const clearHitlState = () => {
      setIsHitlMode(false);
      setSelectedRowIds([]);
      setMergeSuggestions([]);
      setIsSuggesting(false);
  };

  useEffect(() => {
    if (isHitlMode && paragraphs.length > 0 && mergeSuggestions.length === 0 && !isSuggesting) {
      const fetchSuggestions = async () => {
        setIsSuggesting(true);
        try {
          const suggestions = await getMergeSuggestions(paragraphs);
          setMergeSuggestions(suggestions);
        } catch (e) {
          console.error("Failed to get merge suggestions", e);
          setError("Could not retrieve merge suggestions from the AI.");
        } finally {
          setIsSuggesting(false);
        }
      };
      fetchSuggestions();
    }
  }, [isHitlMode, paragraphs, mergeSuggestions.length, isSuggesting]);
  
  const handleToggleLockMode = useCallback(async () => {
    const nextLockedState = !isLocked;
    setIsLocked(nextLockedState);

    if (nextLockedState) {
        // Save state to localStorage
        let pdfDataUrl: string | null = null;
        if (pdfSource) {
            pdfDataUrl = await fileToDataURL(pdfSource);
        }
        const stateToSave = {
            paragraphs,
            pageDimensions,
            fileName,
            pdfDataUrl,
            isLocked: true,
        };
        localStorage.setItem('savedAnalysisState', JSON.stringify(stateToSave));
    } else {
        // Clear state and localStorage
        localStorage.removeItem('savedAnalysisState');
        clearAnalysis();
    }
  }, [isLocked, paragraphs, pageDimensions, fileName, pdfSource]);


  const handleToggleHitlMode = () => {
    const newMode = !isHitlMode;
    setIsHitlMode(newMode);
    if (!newMode) {
      clearHitlState();
    }
  };

  const handleSelectionChange = (id: string) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleInitiateMerge = async () => {
    if (selectedRowIds.length < 2) return;
    
    const candidates = paragraphs
      .filter(p => selectedRowIds.includes(p.id))
      .sort((a, b) => paragraphs.findIndex(p => p.id === a.id) - paragraphs.findIndex(p => p.id === b.id));
      
    setMergeCandidates(candidates);
    setIsMergeModalOpen(true);
    setIsMerging(true);
    setSuggestedMergeResult(null);

    try {
      const result = await generateMergeResult(candidates);
      setSuggestedMergeResult(result);
    } catch (e) {
      console.error("Failed to generate merge result", e);
      setError("Failed to get a merge suggestion from the AI.");
    } finally {
      setIsMerging(false);
    }
  };

  const handleConfirmMerge = (finalMergeResult: { content: string, enrichment: Record<string, string> }) => {
    if (mergeCandidates.length === 0) return;

    const newId = `merged-${mergeCandidates.map(p => p.id.split('-')[1] || p.id).join('-')}`;
    
    const { boundingBox, pageNumber } = calculateCombinedBoundingBox(mergeCandidates);
    const firstParaForMeta = mergeCandidates[0]; // For role, level, etc.

    const newParagraph: AnalyzedParagraph = {
      id: newId,
      parentId: firstParaForMeta.parentId,
      level: firstParaForMeta.level,
      role: firstParaForMeta.role,
      content: finalMergeResult.content,
      enrichment: finalMergeResult.enrichment,
      boundingBox: boundingBox,
      pageNumber: pageNumber,
    };

    const newParagraphs = paragraphs.filter(p => !mergeCandidates.some(c => c.id === p.id));
    const insertIndex = paragraphs.findIndex(p => p.id === firstParaForMeta.id);
    newParagraphs.splice(insertIndex, 0, newParagraph);

    setParagraphs(newParagraphs);
    setMergeCandidates([]);
    setSelectedRowIds([]);
    setIsMergeModalOpen(false);
    setMergeSuggestions([]);
  };

  const clearAnalysis = useCallback(() => {
      setFile(null);
      setPdfSource(null);
      setUploadedOcrData(null);
      setRawOcrForDownload(null);
      setFileName('');
      setParagraphs([]);
      setPageDimensions([]);
      setSvgElement(null);
      setError(null);
      setShowPdf(true);
      clearHitlState();
      setIsLocked(false);
      localStorage.removeItem('savedAnalysisState');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        clearAnalysis();
        setFileName(selectedFile.name);

        if (selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setPdfSource(selectedFile);
            setShowPdf(true);
        } else if (selectedFile.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const result = JSON.parse(event.target?.result as string);
                    if (result.blocks && result.pageDimensions) {
                        setUploadedOcrData(result);
                        setFile(null);
                        setPdfSource(null);
                        setShowPdf(false); 
                    } else setError('Invalid OCR JSON format.');
                } catch (jsonError) {
                    setError('Failed to parse JSON file.');
                }
            };
            reader.readAsText(selectedFile);
        } else {
            setError('Unsupported file type. Please upload a PDF or OCR JSON file.');
            setFile(null);
        }
    }
  };

  const handleProcessDocument = useCallback(async () => {
    if (!file && !uploadedOcrData) {
      setError('Please select a PDF or OCR JSON file to analyze.');
      return;
    }

    setIsLoading(true);
    setError(null);
    clearHitlState();
    setParagraphs([]);
    setPageDimensions([]);
    setSvgElement(null);
    setRawOcrForDownload(null);
    setAnalysisStatus('Initializing...');
    
    try {
        if (uploadedOcrData) {
            const { paragraphs: result, pageDimensions: dims } = await runAiAnalysisOnOcr(uploadedOcrData, setAnalysisStatus);
            setParagraphs(result);
            setPageDimensions(dims);
        } else if (file) {
            const { ocrResult, finalResult } = await processDocument(file, setAnalysisStatus);
            setRawOcrForDownload(ocrResult);
            setParagraphs(finalResult.paragraphs);
            setPageDimensions(finalResult.pageDimensions);
        }
    } catch (err: any) {
      console.error("Error in analysis pipeline:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setAnalysisStatus('');
    }
  }, [file, uploadedOcrData]);
  
  const handleGraphReady = useCallback((svg: SVGSVGElement) => setSvgElement(svg), []);

  const renderContent = () => {
    if (isLoading) return <Loader message={analysisStatus} />;
    if (error && !isMergeModalOpen) return <ErrorMessage message={error} />;
    
    if (paragraphs.length === 0 && (file || uploadedOcrData)) {
        return (
            <div className="text-center py-16 px-4">
              <h3 className="text-lg font-semibold text-content-primary">Ready to Analyze</h3>
              <p className="text-content-secondary mt-2">Click "Analyze Pipeline" to generate the structured data.</p>
            </div>
        );
    }
    
    if (paragraphs.length > 0) {
        return activeView === ViewType.TABLE ? 
          <TableView 
            paragraphs={paragraphs} 
            onHover={setHoveredParagraphId}
            isHitlMode={isHitlMode}
            selectedRowIds={selectedRowIds}
            onSelectionChange={handleSelectionChange}
            mergeSuggestions={mergeSuggestions}
          /> : 
          <GraphView paragraphs={paragraphs} onGraphReady={handleGraphReady} />;
    }

    return (
        <div className="text-center py-16 px-4">
          <h3 className="text-lg font-semibold text-content-primary">Upload a Document</h3>
          <p className="text-content-secondary mt-2">Select a PDF or OCR JSON file to begin.</p>
        </div>
    );
  };

  const hasAnalysisInput = !!file || !!uploadedOcrData;
  const showResultsArea = hasAnalysisInput || pdfSource;

  return (
    <div className="min-h-screen bg-base-200 text-content-primary font-sans">
      <Header isLocked={isLocked} onToggleLockMode={handleToggleLockMode} />
      <main className="container mx-auto p-4 md:p-8">
        <div className={`bg-base-100 rounded-lg border border-base-300 shadow-md p-6 transition-opacity ${isLocked ? 'opacity-60' : ''}`}>
          <h2 className="text-xl font-bold mb-1">Upload Document</h2>
          <p className="text-content-secondary mb-4 text-sm">Select a PDF for full analysis or an OCR JSON file to re-run AI steps.</p>
          
          <div className={`mt-4 flex justify-center rounded-md border border-dashed border-base-300 px-6 py-10 ${isLocked ? 'cursor-not-allowed' : ''}`}>
            <div className="text-center">
              <FileUp className="mx-auto h-10 w-10 text-gray-500" aria-hidden="true" />
              <div className="mt-4 flex text-sm leading-6 text-gray-400 justify-center">
                <label
                  htmlFor="file-upload"
                  className={`relative rounded-md bg-base-100 font-semibold text-brand-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-secondary focus-within:ring-offset-2 focus-within:ring-offset-base-200 ${isLocked ? 'cursor-not-allowed text-gray-500' : 'cursor-pointer hover:text-brand-light'}`}
                >
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf,.json" onChange={handleFileChange} disabled={isLoading || isLocked} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-500">PDF or OCR JSON file</p>
              {fileName && <p className="text-sm font-medium text-content-primary mt-4">Selected: {fileName}</p>}
            </div>
          </div>
          
          <div className="mt-6 flex justify-end items-center gap-4">
            <button
              onClick={handleProcessDocument}
              disabled={isLoading || isLocked || !hasAnalysisInput}
              className="px-5 py-2.5 bg-brand-primary text-white font-semibold rounded-md shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-100 focus:ring-brand-primary transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed min-w-[200px] text-center"
            >
              {isLoading ? (analysisStatus || 'Working...') : 'Analyze Pipeline'}
            </button>
          </div>
        </div>

        {showResultsArea && (
           <div className={`mt-8 grid transition-all duration-300 ${showPdf ? 'grid-cols-1 md:grid-cols-2 gap-8' : 'grid-cols-1'}`}>
            {showPdf && (
                <div className="bg-base-100 rounded-lg border border-base-300 shadow-md h-[80vh] overflow-hidden">
                    <PdfViewer
                      pdfSource={pdfSource}
                      paragraphs={paragraphs}
                      pageDimensions={pageDimensions}
                      hoveredId={hoveredParagraphId}
                    />
                </div>
            )}
            <div className={`bg-base-100 rounded-lg border border-base-300 shadow-md ${showPdf ? 'col-span-1' : 'col-span-1'}`}>
               <div className="p-4 border-b border-base-300 flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-xl font-bold text-content-primary">
                    {paragraphs.length > 0 ? 'Analysis Result' : 'Document View'}
                  </h2>
                  <div className="flex items-center gap-2 md:gap-4">
                    { (pdfSource) &&
                      <div className="flex items-center space-x-1 bg-base-200 p-1 rounded-lg">
                           <button onClick={() => setShowPdf(!showPdf)} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${showPdf ? 'bg-base-100 text-brand-primary shadow-sm' : 'text-content-secondary hover:bg-base-300'}`} aria-pressed={showPdf} title="Toggle PDF View" >
                              <LayoutColumns className="w-5 h-5" />
                           </button>
                      </div>
                    }
                        
                    {paragraphs.length > 0 && (
                      <>
                        <div className="flex items-center space-x-1 bg-base-200 p-1 rounded-lg">
                            <button onClick={() => setActiveView(ViewType.TABLE)} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${activeView === ViewType.TABLE ? 'bg-base-100 text-brand-primary shadow-sm' : 'text-content-secondary hover:bg-base-300'}`} aria-pressed={activeView === ViewType.TABLE}>
                              <Database className="w-5 h-5 inline-block mr-1" /> Table
                            </button>
                            <button onClick={() => setActiveView(ViewType.GRAPH)} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${activeView === ViewType.GRAPH ? 'bg-base-100 text-brand-primary shadow-sm' : 'text-content-secondary hover:bg-base-300'}`} aria-pressed={activeView === ViewType.GRAPH}>
                              <GitBranch className="w-5 h-5 inline-block mr-1" /> Graph
                            </button>
                        </div>

                        {activeView === ViewType.TABLE && (
                          <div className="flex items-center space-x-1 bg-base-200 p-1 rounded-lg">
                              <button onClick={handleToggleHitlMode} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${isHitlMode ? 'bg-purple-300 text-purple-800 shadow-sm' : 'text-content-secondary hover:bg-base-300'}`} title="Toggle Interactive Edit Mode">
                                <Wand className="w-5 h-5 inline-block mr-1" /> {isSuggesting ? 'Thinking...' : 'Interactive'}
                              </button>
                          </div>
                        )}

                        <DownloadMenu data={paragraphs} activeView={activeView} svgElement={svgElement} rawOcrData={rawOcrForDownload} />
                      </>
                    )}
                  </div>
                </div>
              
              {isHitlMode && selectedRowIds.length > 1 && (
                <div className="p-2 border-b border-base-300 bg-base-200/50 flex justify-center">
                  <button onClick={handleInitiateMerge} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors">
                    <Merge className="w-5 h-5" />
                    Merge {selectedRowIds.length} Selected Rows
                  </button>
                </div>
              )}

              <div className="p-1 sm:p-4">
                {renderContent()}
              </div>
            </div>
          </div>
        )}
      </main>

       <MergeModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          paragraphsToMerge={mergeCandidates}
          suggestedResult={suggestedMergeResult}
          onConfirmMerge={handleConfirmMerge}
          isLoading={isMerging}
       />
    </div>
  );
};

export default App;
