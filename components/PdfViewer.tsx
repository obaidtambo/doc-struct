
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AnalyzedParagraph, PageDimension } from '../types';

// Set the workerSrc to a reliable CDN to ensure compatibility and avoid loading issues.
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

interface PdfViewerProps {
  pdfSource: File | null;
  paragraphs: AnalyzedParagraph[];
  pageDimensions: PageDimension[];
  hoveredId: string | null;
}

interface PageRender {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  viewport: pdfjsLib.PageViewport;
}

const fileToUint8Array = async (file: File): Promise<Uint8Array> => {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
};

const PdfViewer: React.FC<PdfViewerProps> = ({ pdfSource, paragraphs, pageDimensions, hoveredId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageRenders, setPageRenders] = useState<PageRender[]>([]);
  const [highlightBox, setHighlightBox] = useState<{ top: number; left: number; width: number; height: number; } | null>(null);

  useEffect(() => {
    const renderPdf = async () => {
      if (!containerRef.current || !pdfSource) {
        if (containerRef.current) containerRef.current.innerHTML = '';
        setPageRenders([]);
        return;
      }

      // Clear previous renders
      containerRef.current.innerHTML = ''; 
      setPageRenders([]);

      let pdfData: Uint8Array;
      try {
        if (pdfSource instanceof File) {
           pdfData = await fileToUint8Array(pdfSource);
        } else {
           // This case should ideally not be hit with the new design, but is kept for robustness
           console.error("PDF source is not a file object.");
           return;
        }

        const loadingTask = pdfjsLib.getDocument(pdfData);
        const pdf = await loadingTask.promise;
        const renders: PageRender[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (!containerRef.current) return;
          
          const scale = containerRef.current.clientWidth / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.display = 'block';
          canvas.style.marginBottom = '8px';
          containerRef.current.appendChild(canvas);
          
          const canvasContext = canvas.getContext('2d');
          if (!canvasContext) continue;
          
          const renderParameters: pdfjsLib.RenderParameters = {
            canvasContext,
            viewport,
            canvas,
          };
          await page.render(renderParameters).promise;
          renders.push({ pageNumber: i, canvas, viewport });
        }
        setPageRenders(renders);
      } catch (error) {
        console.error('Failed to render PDF:', error);
        if (containerRef.current) {
            containerRef.current.innerHTML = `<div class="p-4 text-red-400">Error loading PDF. It may be corrupt, protected, or not found. (${(error as Error).message})</div>`;
        }
      }
    };

    renderPdf();
  }, [pdfSource]);

  useEffect(() => {
    if (!hoveredId || pageRenders.length === 0 || pageDimensions.length === 0) {
      setHighlightBox(null);
      return;
    }

    const para = paragraphs.find(p => p.id === hoveredId);
    if (!para || !para.boundingBox || !para.pageNumber) {
      setHighlightBox(null);
      return;
    }

    const { boundingBox, pageNumber } = para;

    const pageRender = pageRenders.find(pr => pr.pageNumber === pageNumber);
    const ocrDim = pageDimensions.find(pd => pd.pageNumber === pageNumber);

    if (!pageRender || !ocrDim) {
        setHighlightBox(null);
        return;
    }

    const { canvas } = pageRender;
    const scaleX = canvas.width / ocrDim.width;
    const scaleY = canvas.height / ocrDim.height;
    
    let topOffset = 0;
    for(const pr of pageRenders) {
        if(pr.pageNumber < pageNumber) {
            topOffset += pr.canvas.offsetHeight + 8; // 8px margin
        }
    }

    // Convert dimensions from inches (used in OCR data) to pixels
    const widthInPixels = boundingBox.width * scaleX;
    const heightInPixels = boundingBox.height * scaleY;
    const xInPixels = boundingBox.x * scaleX;
    const yInPixels = boundingBox.y * scaleY;

    setHighlightBox({
      left: xInPixels,
      top: yInPixels + topOffset,
      width: widthInPixels,
      height: heightInPixels,
    });

  }, [hoveredId, paragraphs, pageRenders, pageDimensions]);

  return (
    <div className="w-full h-full bg-base-300 overflow-auto relative">
      <div ref={containerRef} className="p-4" />
      {highlightBox && (
        <div
          className="absolute bg-brand-secondary/40 border-2 border-brand-primary rounded-sm transition-all duration-100 pointer-events-none"
          style={{
            left: `${highlightBox.left + 16}px`, // +16 for container padding
            top: `${highlightBox.top + 16}px`, // +16 for container padding
            width: `${highlightBox.width}px`,
            height: `${highlightBox.height}px`,
          }}
        ></div>
      )}
    </div>
  );
};

export default PdfViewer;
