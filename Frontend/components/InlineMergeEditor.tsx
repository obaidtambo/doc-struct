// FIX: Provide full implementation for the InlineMergeEditor component.
import React, { useState } from 'react';
import { AnalyzedParagraph } from '../types';

interface InlineMergeEditorProps {
  paragraph: AnalyzedParagraph;
  onSave: (id: string, newContent: string) => void;
  onCancel: () => void;
}

const InlineMergeEditor: React.FC<InlineMergeEditorProps> = ({ paragraph, onSave, onCancel }) => {
  const [content, setContent] = useState(paragraph.content);

  const handleSave = () => {
    onSave(paragraph.id, content);
  };

  return (
    <tr className="bg-base-300">
      <td colSpan={7} className="p-2">
        <div className="flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-24 p-2 bg-base-100 border border-base-300 rounded-md text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm font-semibold rounded-md bg-base-200 hover:bg-base-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 text-sm font-semibold text-white rounded-md bg-brand-primary hover:bg-brand-secondary"
            >
              Save
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
};

export default InlineMergeEditor;
