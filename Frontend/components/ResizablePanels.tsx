
import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelsProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialSize?: number;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({ left, right, initialSize = 50 }) => {
  const [panelWidth, setPanelWidth] = useState(initialSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
  };
  
  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current && containerRef.current) {
      const bounds = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - bounds.left) / bounds.width) * 100;
      // Clamp width between 15% and 85%
      setPanelWidth(Math.max(15, Math.min(newWidth, 85)));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="flex h-full w-full" ref={containerRef}>
      <div style={{ width: `${panelWidth}%` }} className="h-full overflow-hidden">
        {left}
      </div>
      <div
        className="w-2 h-full cursor-col-resize bg-base-300 hover:bg-brand-primary transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
      />
      <div style={{ width: `${100 - panelWidth}%` }} className="h-full overflow-hidden">
        {right}
      </div>
    </div>
  );
};

export default ResizablePanels;
