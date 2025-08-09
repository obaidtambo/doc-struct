
import React, { useState, useEffect } from 'react';
import { AnalyzedParagraph } from '../types';
import { generateMergeResult } from '../services/hitlAgents';
import { Merge, Wand, X } from './Icons';
import Loader from './Loader';

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  paragraphsToMerge: AnalyzedParagraph[];
  suggestedResult: { content: string, enrichment: Record<string, string> } | null;
  onConfirmMerge: (result: { content: string, enrichment: Record<string, string> }) => void;
  isLoading: boolean;
}

const MergeModal: React.FC<MergeModalProps> = ({
  isOpen,
  onClose,
  paragraphsToMerge,
  suggestedResult,
  onConfirmMerge,
  isLoading,
}) => {
  const [userInstruction, setUserInstruction] = useState('');
  const [isProcessingWithInstruction, setIsProcessingWithInstruction] = useState(false);

  useEffect(() => {
    // Reset instruction when modal opens with new candidates
    if (isOpen) {
      setUserInstruction('');
    }
  }, [isOpen, paragraphsToMerge]);

  if (!isOpen) return null;

  const handleMergeWithInstruction = async () => {
    if (!userInstruction) return;
    setIsProcessingWithInstruction(true);
    try {
      const result = await generateMergeResult(paragraphsToMerge, userInstruction);
      onConfirmMerge(result);
    } catch (e) {
      console.error("Failed to merge with instruction", e);
      // You might want to show an error to the user here
    } finally {
      setIsProcessingWithInstruction(false);
    }
  };

  const renderEnrichment = (enrichment: Record<string, string>) => (
    <div className="text-xs bg-base-300 p-2 rounded-md font-mono">
      {Object.entries(enrichment).map(([key, value]) => (
        <div key={key}>
          <span className="text-content-secondary">{key}: </span>
          <span className="text-brand-light">{`"${value}"`}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-base-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-base-300">
        <header className="flex items-center justify-between p-4 border-b border-base-300">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Merge className="w-6 h-6 text-brand-primary" />
            Merge Paragraphs
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

          {/* Right side: AI Suggestion and User Input */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Wand className="w-5 h-5 text-purple-400" />
              AI Suggestion & Action
            </h3>
            {isLoading || !suggestedResult ? (
              <Loader message="AI is generating a merge suggestion..." />
            ) : (
              <div className="space-y-4">
                <div className="bg-base-100 p-3 rounded-md border border-green-700/50">
                   <p className="text-sm font-semibold text-green-400 mb-2">Suggested Merged Content</p>
                   <p className="text-sm text-content-primary mb-3">{suggestedResult.content}</p>
                   <p className="text-sm font-semibold text-green-400 mb-2">Suggested Merged Details</p>
                   {renderEnrichment(suggestedResult.enrichment)}
                </div>
                <button
                  onClick={() => onConfirmMerge(suggestedResult)}
                  className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition-colors"
                >
                  Accept & Merge
                </button>
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-base-300" />
                    </div>
                    <div className="relative flex justify-center">
                        <span className="bg-base-200 px-2 text-sm text-content-secondary">Or provide custom instructions</span>
                    </div>
                </div>
                <div>
                  <textarea
                    value={userInstruction}
                    onChange={(e) => setUserInstruction(e.target.value)}
                    placeholder="e.g., 'Combine the content, but make the job title the main point and list the company and dates as details in the enrichment.'"
                    className="w-full p-2 rounded-md bg-base-100 border border-base-300 focus:ring-2 focus:ring-brand-primary focus:outline-none text-sm"
                    rows={4}
                  />
                  <button
                    onClick={handleMergeWithInstruction}
                    disabled={!userInstruction || isProcessingWithInstruction}
                    className="w-full mt-2 bg-brand-primary text-white font-bold py-2 px-4 rounded hover:bg-brand-dark transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                    {isProcessingWithInstruction ? 'Merging...' : 'Merge with my Instructions'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeModal;
