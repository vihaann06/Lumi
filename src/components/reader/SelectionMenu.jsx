import React from 'react';
import { Lightbulb, FileText, Highlighter } from 'lucide-react';

/**
 * Selection Menu Component
 */
export default function SelectionMenu({ 
  menuPosition, 
  onAIExplain, 
  onAISummary, 
  onHighlight 
}) {
  if (!menuPosition) return null;

  return (
    <div
      className="selection-menu absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2"
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        <button
          onClick={onAIExplain}
          className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Lightbulb className="w-4 h-4" />
          AI Explanation
        </button>
        <button
          onClick={onAISummary}
          className="px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <FileText className="w-4 h-4" />
          AI Summary
        </button>
        <button
          onClick={onHighlight}
          className="px-3 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Highlighter className="w-4 h-4" />
          Highlight
        </button>
      </div>
    </div>
  );
}

