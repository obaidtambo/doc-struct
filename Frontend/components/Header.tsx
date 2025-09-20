
import React from 'react';
import { Network, CloudUpload, FileText } from './Icons';

interface HeaderProps {
  isSaving: boolean;
  onSaveChanges: () => void;
  documentName?: string;
}

const Header: React.FC<HeaderProps> = ({ isSaving, onSaveChanges, documentName }) => {
  return (
    <header className="bg-base-100 border-b border-base-300 shadow-sm sticky top-0 z-20">
      <div className="container mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <div className="bg-brand-primary p-2 rounded-md">
            <Network className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-content-primary">
                    Docu-Struct Workbench
                </h1>
                <p className="text-xs text-content-secondary">AI-Powered Document Structuring</p>
            </div>
        </div>

        <div className="flex items-center gap-4">
            {documentName && (
              <div className="hidden md:flex items-center gap-2 text-sm text-content-secondary border border-base-300 px-3 py-1.5 rounded-md">
                <FileText className="w-4 h-4" />
                <span className="font-medium truncate max-w-xs" title={documentName}>{documentName}</span>
              </div>
            )}
            <button
              onClick={onSaveChanges}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-base-300 text-content-primary hover:bg-base-300/80 disabled:opacity-50 disabled:cursor-wait"
              title="Save current analysis state to the server"
              aria-label="Save changes"
            >
              <CloudUpload className={`w-5 h-5 ${isSaving ? 'animate-pulse' : ''}`} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
