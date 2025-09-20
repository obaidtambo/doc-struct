// FIX: Provide full implementation for the TableView component.
import React, { useState, useMemo } from 'react';
import { AnalyzedParagraph } from '../types';
import InlineMergeEditor from './InlineMergeEditor';
import { GitBranch, TestTube, Split } from './Icons';

interface TableViewProps {
  paragraphs: AnalyzedParagraph[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onEditSave: (id: string, newContent: string) => void;
  onUnmerge: (id: string) => void;
  mergeSuggestions: string[][];
  onHoverRow: (id: string | null) => void;
}

const TableView: React.FC<TableViewProps> = ({
  paragraphs,
  selectedIds,
  onSelectionChange,
  onEditSave,
  onUnmerge,
  mergeSuggestions,
  onHoverRow,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSelectRow = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    onSelectionChange(newSelectedIds);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectionChange(new Set(paragraphs.map(p => p.id)));
    } else {
      onSelectionChange(new Set());
    }
  };
  
  const handleEditSave = (id: string, newContent: string) => {
      onEditSave(id, newContent);
      setEditingId(null);
  }

  const suggestionMap = useMemo(() => {
    const map = new Map<string, string>();
    mergeSuggestions.forEach((group, index) => {
      const groupId = `suggestion-${index}`;
      group.forEach(paraId => map.set(paraId, groupId));
    });
    return map;
  }, [mergeSuggestions]);
  
  const getSuggestionColor = (id: string): string => {
      const suggestionId = suggestionMap.get(id);
      if (!suggestionId) return 'border-transparent';
      const colors = ['border-blue-500', 'border-green-500', 'border-yellow-500', 'border-pink-500', 'border-indigo-500'];
      const hash = suggestionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return colors[hash % colors.length];
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left text-content-secondary table-fixed">
        <thead className="text-xs text-content-secondary uppercase bg-base-200">
          <tr>
            <th scope="col" className="p-4 w-12">
              <input
                type="checkbox"
                className="w-4 h-4 text-brand-primary bg-base-100 border-base-300 rounded focus:ring-brand-secondary"
                onChange={handleSelectAll}
                checked={selectedIds.size === paragraphs.length && paragraphs.length > 0}
                // @ts-ignore - 'indeterminate' is a valid property on checkbox inputs
                indeterminate={selectedIds.size > 0 && selectedIds.size < paragraphs.length}
              />
            </th>
            <th scope="col" className="px-3 py-3 w-16">Lvl</th>
            <th scope="col" className="px-3 py-3 w-48">Role</th>
            <th scope="col" className="px-3 py-3 w-48">ID</th>
            <th scope="col" className="px-3 py-3">Content</th>
            <th scope="col" className="px-3 py-3 w-40">Parent ID</th>
             <th scope="col" className="px-3 py-3 w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paragraphs.map((p) => (
            editingId === p.id ? (
                <InlineMergeEditor key={p.id} paragraph={p} onSave={handleEditSave} onCancel={() => setEditingId(null)} />
            ) : (
            <tr
              key={p.id}
              className={`border-b border-base-300 hover:bg-base-200/50 ${selectedIds.has(p.id) ? 'bg-brand-primary/10' : 'bg-base-100'}`}
              onMouseEnter={() => onHoverRow(p.id)}
              onMouseLeave={() => onHoverRow(null)}
            >
              <td className={`p-4 border-l-4 ${getSuggestionColor(p.id)}`}>
                 <input
                  type="checkbox"
                  className="w-4 h-4 text-brand-primary bg-base-100 border-base-300 rounded focus:ring-brand-secondary"
                  checked={selectedIds.has(p.id)}
                  onChange={() => handleSelectRow(p.id)}
                />
              </td>
              <td className="px-3 py-2 text-center">{p.level}</td>
              <td className="px-3 py-2 font-mono text-xs truncate" title={p.role || ''}>{p.role}</td>
              <td className="px-3 py-2 font-mono text-xs truncate" title={p.id}>
                {p.id}
              </td>
              <td className="px-3 py-2 text-content-primary">
                {suggestionMap.has(p.id) && <TestTube className="w-4 h-4 inline-block mr-2 text-blue-400" title="Part of merge suggestion"/>}
                {p.content}
              </td>
              <td className="px-3 py-2 font-mono text-xs truncate" title={p.parentId || ''}>
                {p.parentId ? <><GitBranch className="w-3 h-3 inline-block mr-1"/>{p.parentId.slice(0,8)}...</> : '-'}
              </td>
              <td className="px-3 py-2">
                 {p.isMerged ? (
                    <button onClick={() => onUnmerge(p.id)} className="flex items-center gap-1 font-medium text-yellow-400 hover:underline" title="Revert this merge">
                      <Split className="w-3 h-3" />
                      Unmerge
                    </button>
                 ) : (
                    <button onClick={() => setEditingId(p.id)} className="font-medium text-brand-primary hover:underline">Edit</button>
                 )}
              </td>
            </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableView;
