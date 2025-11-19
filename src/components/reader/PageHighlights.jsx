import React from 'react';

/**
 * Page Highlights Component
 */
export default function PageHighlights({ highlights, currentPageInView }) {
  if (highlights.length === 0) return null;

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg shadow p-4 mx-auto">
      <h3 className="font-semibold text-sm text-gray-900 mb-3">
        Highlights on page {currentPageInView} ({highlights.length})
      </h3>
      <div className="space-y-2">
        {highlights.map((highlight, idx) => (
          <div
            key={idx}
            className="text-sm text-gray-700 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400"
          >
            "{highlight.text}"
          </div>
        ))}
      </div>
    </div>
  );
}

