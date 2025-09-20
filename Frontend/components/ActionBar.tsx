import React, { useState, useRef, useEffect } from 'react';
import { Merge, Wand } from './Icons';
import { MergeType } from '../types';

interface ActionBarProps {
  selectedCount: number;
  onConcatMerge: () => void;
  onAiMerge: (type: MergeType) => void;
}

const ActionBar: React.FC<ActionBarProps> = ({ selectedCount, onConcatMerge, onAiMerge }) => {
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
        setIsAiMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  if (selectedCount === 0) {
    return null;
  }
  
  const handleAiMenuClick = (type: MergeType) => {
    onAiMerge(type);
    setIsAiMenuOpen(false);
  }

  return (
    <div className="sticky top-[100px] z-10 bg-base-300/80 backdrop-blur-sm p-3 border-y border-base-300 flex items-center justify-between">
      <p className="text-sm font-semibold text-content-primary">
        {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onConcatMerge}
          disabled={selectedCount < 2}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-content-primary bg-base-200 hover:bg-base-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Concatenate content of selected rows"
        >
          <Merge className="w-4 h-4" />
          Concat Merge
        </button>

        <div className="relative" ref={aiMenuRef}>
          <button
            onClick={() => setIsAiMenuOpen(!isAiMenuOpen)}
            disabled={selectedCount < 2}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Use AI to merge selected rows coherently"
          >
            <Wand className="w-4 h-4" />
            AI Merge
            <svg className={`w-4 h-4 transition-transform ${isAiMenuOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {isAiMenuOpen && (
             <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md shadow-lg bg-base-100 ring-1 ring-base-300 ring-opacity-75 focus:outline-none z-20">
              <div className="py-1">
                <button
                  onClick={() => handleAiMenuClick('AI_DEFAULT')}
                  className="text-content-primary block w-full text-left px-4 py-2 text-sm hover:bg-base-300"
                >
                  <p className="font-semibold">Default Merge</p>
                  <p className="text-xs text-content-secondary">Quickly merge using the default AI prompt.</p>
                </button>
                 <button
                  onClick={() => handleAiMenuClick('AI_CUSTOM')}
                  className="text-content-primary block w-full text-left px-4 py-2 text-sm hover:bg-base-300"
                >
                  <p className="font-semibold">Merge with Instructions</p>
                  <p className="text-xs text-content-secondary">Provide custom instructions to guide the AI.</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionBar;