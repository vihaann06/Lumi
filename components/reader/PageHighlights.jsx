import React from 'react';

/**
 * Page Highlights Component
 */
export default function PageHighlights({ highlights, currentPageInView }) {
  if (highlights.length === 0) return null;

  return (
    <div className="w-full max-w-2xl bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-4 mx-auto">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Page {currentPageInView} · {highlights.length} {highlights.length === 1 ? 'highlight' : 'highlights'}
      </h3>
      <div className="space-y-2">
        {highlights.map((highlight, idx) => (
          <div
            key={idx}
            className="text-sm text-slate-700 p-3 bg-amber-50/50 rounded-lg border-l-2 border-amber-400/60"
          >
            "{highlight.text}"
          </div>
        ))}
      </div>
    </div>
  );
}
