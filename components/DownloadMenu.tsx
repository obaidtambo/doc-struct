
import React, { useState, useRef, useEffect } from 'react';
import { AnalyzedParagraph, ViewType, OcrExtractionResult } from '../types';
import { Download } from './Icons';

interface DownloadMenuProps {
  data: AnalyzedParagraph[];
  activeView: ViewType;
  svgElement: SVGSVGElement | null;
  rawOcrData: OcrExtractionResult | null;
}

const DownloadMenu: React.FC<DownloadMenuProps> = ({ data, activeView, svgElement, rawOcrData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const download = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleDownloadJSON = () => {
    download('analysis_result.json', JSON.stringify(data, null, 2), 'application/json');
  };

  const handleDownloadCSV = () => {
    const headers = ['id', 'parentId', 'level', 'role', 'content', 'enrichment'];
    const csvRows = [
      headers.join(','),
      ...data.map(row => {
        const values = headers.map(header => {
          let value = (row as any)[header] ?? '';
          if (header === 'enrichment') {
            value = JSON.stringify(value);
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        });
        return values.join(',');
      })
    ];
    download('analysis_result.csv', csvRows.join('\n'), 'text/csv');
  };
  
  const handleDownloadOcrJson = () => {
    if (!rawOcrData) return;
    download('ocr_output.json', JSON.stringify(rawOcrData, null, 2), 'application/json');
  };

  const handleDownloadSVG = () => {
    if (!svgElement) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    download('graph.svg', source, 'image/svg+xml;charset=utf-8');
  };

  const handleDownloadPNG = () => {
    if (!svgElement) return;

    const canvas = document.createElement('canvas');
    const { width, height } = svgElement.getBBox();
    const scale = 2; // for higher resolution
    canvas.width = (width || 800) * scale;
    canvas.height = (height || 600) * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#111827'; // Match bg-base-200
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'graph.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsOpen(false);
    };
    img.src = url;
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-content-primary bg-base-300/50 hover:bg-base-300 rounded-md transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Download className="w-4 h-4" />
        Download
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 origin-top-right rounded-md shadow-lg bg-base-100 ring-1 ring-base-300 ring-opacity-75 focus:outline-none z-10"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1" role="none">
            <button onClick={handleDownloadJSON} className="text-content-primary block w-full text-left px-4 py-2 text-sm hover:bg-base-300" role="menuitem">Result as JSON</button>
            {rawOcrData && (
                <button onClick={handleDownloadOcrJson} className="text-content-primary block w-full text-left px-4 py-2 text-sm hover:bg-base-300" role="menuitem">Raw OCR as JSON</button>
            )}
            
            {activeView === ViewType.TABLE && (
                <button onClick={handleDownloadCSV} className="text-content-primary block w-full text-left px-4 py-2 text-sm hover:bg-base-300" role="menuitem">Result as CSV</button>
            )}
            {activeView === ViewType.GRAPH && (
              <>
                <button onClick={handleDownloadSVG} disabled={!svgElement} className="text-content-primary block w-full text-left px-4 py-2 text-sm hover:bg-base-300 disabled:opacity-50" role="menuitem">Image as SVG</button>
                <button onClick={handleDownloadPNG} disabled={!svgElement} className="text-content-primary block w-full text-left px-4 py-2 text-sm hover:bg-base-300 disabled:opacity-50" role="menuitem">Image as PNG</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadMenu;
