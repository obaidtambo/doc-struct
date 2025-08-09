
import React from 'react';
import { AnalyzedParagraph } from '../types';

interface TableViewProps {
  paragraphs: AnalyzedParagraph[];
  onHover: (id: string | null) => void;
  isHitlMode: boolean;
  selectedRowIds: string[];
  onSelectionChange: (id: string) => void;
  mergeSuggestions: string[][];
}

const TableView: React.FC<TableViewProps> = ({
  paragraphs,
  onHover,
  isHitlMode,
  selectedRowIds,
  onSelectionChange,
  mergeSuggestions,
}) => {
  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'title': return 'bg-indigo-900 text-indigo-300';
      case 'sectionHeading': return 'bg-blue-900 text-blue-300';
      case 'pageHeader': case 'pageFooter': case 'pageNumber': return 'bg-gray-700 text-gray-300';
      default: return 'bg-green-900 text-green-300';
    }
  };

  const getRowClasses = (paraId: string): string => {
    const isSelected = selectedRowIds.includes(paraId);
    const isInSuggestion = mergeSuggestions.some(group => group.includes(paraId));
    
    let classes = 'transition-colors';
    if (isSelected) {
      classes += ' bg-brand-primary/20';
    } else {
      classes += ' hover:bg-base-300/50';
    }
    
    if (isInSuggestion && isHitlMode) {
      classes += ' ring-2 ring-purple-500/70 ring-inset';
    }
    
    return classes;
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full divide-y divide-base-300">
        <thead className="bg-base-200/50">
          <tr>
            {isHitlMode && <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider w-12"></th>}
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">ID</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Parent ID</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Level</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Role</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Content</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody className="bg-base-100 divide-y divide-base-300">
          {paragraphs.map((para) => (
            <tr
              key={para.id}
              className={getRowClasses(para.id)}
              onMouseEnter={() => para.boundingBox && onHover(para.id)}
              onMouseLeave={() => onHover(null)}
            >
              {isHitlMode && (
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-500 bg-base-300 text-brand-primary focus:ring-brand-secondary"
                    checked={selectedRowIds.includes(para.id)}
                    onChange={() => onSelectionChange(para.id)}
                    aria-label={`Select row ${para.id}`}
                  />
                </td>
              )}
              <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-brand-secondary">{para.id}</td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-content-secondary">{para.parentId || 'null'}</td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-content-primary">{para.level}</td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-content-primary">
                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadge(para.role)}`}>
                  {para.role || 'paragraph'}
                </span>
              </td>
              <td className="px-4 py-4 text-sm text-content-primary break-words min-w-[300px] max-w-xl">{para.content}</td>
              <td className="px-4 py-4 text-sm text-content-secondary align-top min-w-[200px]">
                {para.enrichment && Object.entries(para.enrichment).length > 0 ? (
                  <ul className="list-none p-0 m-0 space-y-1">
                    {Object.entries(para.enrichment).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-semibold text-content-primary capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="pl-1">{value.toString()}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-gray-500 italic">None</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableView;
