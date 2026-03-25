import React from 'react';
import { Lightbulb, FileText, Highlighter, BookmarkPlus } from 'lucide-react';

/**
 * Selection Menu Component
 */
export default function SelectionMenu({
  menuPosition,
  onAIExplain,
  onAISummary,
  onHighlight,
  onSaveReference
}) {
  if (!menuPosition) return null;

  return (
    <div
      className="selection-menu absolute z-50 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 p-1.5"
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1">
        <button
          onClick={onAIExplain}
          className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap"
        >
          <Lightbulb className="w-4 h-4" />
          Explain
        </button>
        <button
          onClick={onAISummary}
          className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-purple-600 hover:bg-purple-50/50 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap"
        >
          <FileText className="w-4 h-4" />
          Summary
        </button>
        <button
          onClick={onHighlight}
          className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-amber-600 hover:bg-amber-50/50 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap"
        >
          <Highlighter className="w-4 h-4" />
          Highlight
        </button>
        <button
          onClick={onSaveReference}
          className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap"
        >
          <BookmarkPlus className="w-4 h-4" />
          Reference
        </button>
      </div>
    </div>
  );
}
