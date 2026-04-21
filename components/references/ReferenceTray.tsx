'use client'

import { useState } from 'react'
import type { Reference } from '@/lib/types/references'
import { X, Loader2, Link as LinkIcon } from 'lucide-react'

type Props = {
  references: Reference[]
  isLoading?: boolean
  onRemove?: (id: string) => void
  onSelect?: (ref: Reference) => void
}

function truncate(text: string, max = 80) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export default function ReferenceTray({ references, isLoading, onRemove, onSelect }: Props) {
  const [open, setOpen] = useState(true)

  return (
    <div className="fixed left-4 bottom-4 z-40 max-w-sm">
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <LinkIcon className="h-4 w-4 text-indigo-500" />
            References ({references.length})
          </div>
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
        {open && (
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-slate-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}
            {!isLoading && references.length === 0 && (
              <div className="px-3 py-3 text-slate-400 text-sm">No references yet</div>
            )}
            {references.map((ref, idx) => (
              <div
                key={ref.id}
                className="px-3 py-2 flex items-start gap-2 group cursor-pointer hover:bg-indigo-50/60"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/lumi-reference', JSON.stringify(ref))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => onSelect?.(ref)}
              >
                <div className="mt-0.5 text-[11px] font-semibold text-indigo-500">R{idx + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {ref.sourceDocTitle || 'Untitled source'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {ref.pageNumber ? `Page ${ref.pageNumber}` : 'No page'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-snug">
                    {truncate(ref.selectedText, 90)}
                  </p>
                </div>
                {onRemove && (
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(ref.id)
                    }}
                    aria-label="Remove reference"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
