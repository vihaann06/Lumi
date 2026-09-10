'use client'

import React, { useEffect, useRef } from 'react';
import { Link2, GitCompare, Scale } from 'lucide-react';
import ReferenceTextHoverPreview from '@/components/references/ReferenceTextHoverPreview';

const ACTIONS = [
  {
    id: 'connect',
    label: 'Connect',
    description: 'Explain the relationship',
    Icon: Link2,
    accent: 'text-indigo-600',
    accentHover: 'hover:bg-indigo-50/70',
  },
  {
    id: 'compare',
    label: 'Compare',
    description: 'Similarities & differences',
    Icon: GitCompare,
    accent: 'text-sky-600',
    accentHover: 'hover:bg-sky-50/70',
  },
  {
    id: 'contrast',
    label: 'Contrast',
    description: 'Tensions & disagreements',
    Icon: Scale,
    accent: 'text-amber-600',
    accentHover: 'hover:bg-amber-50/70',
  },
];

export default function CrossSourceMenu({
  position,
  reference,
  onSelectAction,
  onDismiss,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!position) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss?.();
      }
    };
    const onMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        onDismiss?.();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [position, onDismiss]);

  if (!position) return null;

  const refLabel = reference?.referenceNumber ? `R${reference.referenceNumber}` : 'reference';
  const fullRefText = (reference?.selectedText || reference?.text || '').trim();
  const refSnippet = fullRefText.slice(0, 90);

  return (
    <div
      ref={rootRef}
      className="cross-source-menu absolute z-[200] w-[320px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 overflow-visible"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, calc(-100% - 28px))',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 pt-3 pb-2 border-b border-slate-100">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-400">
          Cross-source synthesis
        </p>
        <div className="mt-1.5 flex items-start gap-2">
          <span className="inline-flex items-center justify-center min-w-[28px] h-[20px] px-1.5 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-semibold">
            {refLabel}
          </span>
          <ReferenceTextHoverPreview text={fullRefText} layout="block" subheading="Referenced passage">
            <p className="text-xs text-slate-600 leading-snug line-clamp-2 cursor-default">{refSnippet}{fullRefText.length > 90 ? '…' : ''}</p>
          </ReferenceTextHoverPreview>
        </div>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map(({ id, label, description, Icon, accent, accentHover }) => (
            <div key={id} className="relative group">
              <button
                type="button"
                onClick={() => onSelectAction?.(id)}
                className={`w-full flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg ${accentHover} transition-colors`}
              >
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 ${accent}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-[12px] font-medium text-slate-800">{label}</span>
              </button>
              <div className="pointer-events-none absolute z-[260] left-1/2 -translate-x-1/2 -top-9 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="whitespace-nowrap text-[11px] text-white bg-slate-800/95 px-2 py-1 rounded-md shadow-lg">
                  {description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
