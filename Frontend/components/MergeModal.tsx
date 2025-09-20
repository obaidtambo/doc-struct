import React, { useState, useEffect } from 'react';
import { AnalyzedParagraph, MergeType } from '../types';
import { Merge, Wand, X } from './Icons';
import Loader from './Loader';

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  paragraphsToMerge: AnalyzedParagraph[];
  suggestedResult: { content: string, enrichment: Record<string, string> } | null;
  onConfirmMerge: (result: { content: string, enrichment: Record<string, string> }, customInstructions?: string) => void;
  isLoading: boolean;
  mergeType: MergeType | null;
  onRunWithInstructions: (type: MergeType, instructions: string) => void;
}

const MergeModal: React.FC<MergeModalProps> = ({
  isOpen,
  onClose,
  paragraphsToMerge,
  suggestedResult,
  onConfirmMerge,
  isLoading,
  mergeType,
  onRunWithInstructions
}) => {
  const [customInstructions, setCustomInstructions] = useState('');
  
  useEffect(() => {
    // Clear instructions when the modal is closed or the type changes
    if (!isOpen) {
      setCustomInstructions('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const renderEnrichment = (enrichment: Record<string, string>) => (
    <div className="text-xs bg-base-300 p-2 rounded-md font-mono">
      {Object.entries(enrichment).map(([key, value]) => (
        <div key={key}>
          <span className="text-content-primary">{key}: </span>
          <span className="text-content-secondary">{`"${String(value)}"`}</span>
        </div>
      ))}
    </div>
  );

  const handleConfirm = () => {
    if (suggestedResult) {
      onConfirmMerge(suggestedResult, mergeType === 'AI_CUSTOM' ? customInstructions : undefined);
    }
  };
  
  const handleRerun = () => {
    if (mergeType === 'AI_CUSTOM' && customInstructions) {
      onRunWithInstructions('AI_CUSTOM', customInstructions);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-base-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-base-300">
        <header className="flex items-center justify-between p-4 border-b border-base-300">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Merge className="w-6 h-6 text-brand-primary" />
            AI Merge Assistant
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-base-300">
            <X className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left side: Paragraphs to merge */}
          <div>
            <h3 className="font-semibold text-lg mb-2">Selected Paragraphs ({paragraphsToMerge.length})</h3>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
              {paragraphsToMerge.map(p => (
                <div key={p.id} className="bg-base-100 p-3 rounded-md border border-base-300">
                  <p className="text-sm text-content-primary mb-2">{p.content}</p>
                  {p.enrichment && Object.keys(p.enrichment).length > 0 && renderEnrichment(p.enrichment)}
                </div>
              ))}
            </div>
          </div>

          {/* Right side: AI Suggestion and Action */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Wand className="w-5 h-5 text-purple-400" />
              AI Suggestion
            </h3>
            
            {mergeType === 'AI_CUSTOM' && (
              <div className='mb-4'>
                 <label htmlFor="custom-instructions" className="block text-sm font-medium text-content-secondary mb-1">
                  Custom Instructions (Optional)
                </label>
                <textarea
                  id="custom-instructions"
                  rows={3}
                  className="w-full bg-base-100 border border-base-300 rounded-md text-sm p-2 focus:ring-brand-primary focus:border-brand-primary"
                  placeholder="e.g., Merge into a bulleted list..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
                <button
                  onClick={handleRerun}
                  disabled={!customInstructions || isLoading}
                  className="mt-2 w-full bg-brand-primary text-white font-semibold py-2 px-4 rounded hover:bg-brand-secondary transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Running...' : 'Run with Instructions'}
                </button>
              </div>
            )}

            {isLoading || !suggestedResult ? (
              <Loader message={isLoading ? 'Generating suggestion...' : 'Ready for instructions...'} />
            ) : (
              <div className="space-y-4">
                <div className="bg-base-100 p-3 rounded-md border border-green-700/50">
                   <p className="text-sm font-semibold text-green-400 mb-2">Suggested Merged Content</p>
                   <p className="text-sm text-content-primary mb-3">{suggestedResult.content}</p>
                   <p className="text-sm font-semibold text-green-400 mb-2">Suggested Merged Details</p>
                   {renderEnrichment(suggestedResult.enrichment)}
                </div>
                <button
                  onClick={handleConfirm}
                  className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition-colors"
                >
                  Accept & Merge
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeModal;