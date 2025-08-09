
import React from 'react';
import { Network, Save, Lock } from './Icons';

interface HeaderProps {
  isLocked: boolean;
  onToggleLockMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ isLocked, onToggleLockMode }) => {
  return (
    <header className="bg-base-100 border-b border-base-300 shadow-sm">
      <div className="container mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <div className="bg-brand-primary p-2 rounded-md">
            <Network className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-content-primary">
                    Docu-Struct Visualizer
                </h1>
                <p className="text-xs text-content-secondary">AI-Powered Document Analysis</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <button
              onClick={onToggleLockMode}
              className={`p-2 rounded-full transition-colors ${isLocked ? 'bg-red-900/50 hover:bg-red-800/60' : 'bg-base-300 hover:bg-base-300/80'}`}
              title={isLocked ? 'Unlock and clear saved state' : 'Save current analysis state'}
              aria-label={isLocked ? 'Unlock analysis' : 'Lock analysis'}
            >
              {isLocked ? (
                <Lock className="w-5 h-5 text-red-300" />
              ) : (
                <Save className="w-5 h-5 text-content-primary" />
              )}
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
