import React from 'react';
import { Loader2, Lightbulb, FileText, Search, ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * Explanation Panel Component
 */
export default function ExplanationPanel({
  isCollapsed,
  onToggleCollapse,
  selectedText,
  selectedHighlight,
  isLoading,
  explanation,
  summary,
  referenceCheck
}) {
  if (isCollapsed) {
    return (
      <div className="bg-white border-l border-gray-200 overflow-y-auto flex flex-col transition-all duration-300 w-12">
        <div className="flex flex-col items-center py-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Expand panel"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-l border-gray-200 overflow-y-auto flex flex-col transition-all duration-300 w-96">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-blue-600" />
          AI Explanation
        </h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Collapse panel"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      
      <div className="p-4 flex-1">
        {(selectedText || selectedHighlight) && (
          <div className={`mb-4 p-3 rounded-lg border ${
            selectedHighlight 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-blue-50 border-blue-100'
          }`}>
            <p className={`text-sm font-medium mb-1 ${
              selectedHighlight ? 'text-yellow-900' : 'text-blue-900'
            }`}>
              {selectedHighlight ? 'Selected Highlight:' : 'Selected Text:'}
            </p>
            <p className={`text-sm italic ${
              selectedHighlight ? 'text-yellow-800' : 'text-blue-800'
            }`}>
              "{selectedHighlight ? selectedHighlight.text : selectedText}"
            </p>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : explanation ? (
          <div className="prose prose-sm max-w-none">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-blue-600" />
              Explanation
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{explanation}</p>
          </div>
        ) : summary ? (
          <div className="prose prose-sm max-w-none">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Summary
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
          </div>
        ) : referenceCheck ? (
          <div className="prose prose-sm max-w-none">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Search className="w-5 h-5 text-green-600" />
              Reference Check
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{referenceCheck}</p>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select text and choose an action from the menu</p>
          </div>
        )}
      </div>
    </div>
  );
}

