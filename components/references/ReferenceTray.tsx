'use client'

import { useEffect, useRef, useState } from 'react'
import type { Reference } from '@/lib/types/references'
import { X, Loader2, Link as LinkIcon } from 'lucide-react'

type Props = {
  references: Reference[]
  isLoading?: boolean
  onRemove?: (id: string) => void
  onGoToReference?: (ref: Reference) => void
  onAddReference?: (ref: Reference) => void
  selectedReferenceId?: string | null
}

export default function ReferenceTray({
  references,
  isLoading,
  onRemove,
  onGoToReference,
  onAddReference,
  selectedReferenceId
}: Props) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selectedReferenceId) return
    setOpen(true)
    const target = listRef.current?.querySelector(`[data-reference-id="${selectedReferenceId}"]`) as HTMLDivElement | null
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedReferenceId])

  return (
    <div className="fixed left-5 bottom-5 z-40">
      {open && (
        <div className="mb-3 w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <LinkIcon className="h-4 w-4 text-indigo-500" />
              References
              <span className="text-xs font-medium text-slate-400">({references.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close references"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="max-h-[360px] overflow-y-auto px-2 py-2 space-y-2">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-slate-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}
            {!isLoading && references.length === 0 && (
              <div className="px-3 py-3 text-slate-400 text-sm">No references yet</div>
            )}
            {references.map((ref) => (
              <div
                key={ref.id}
                data-reference-id={ref.id}
                className={`group rounded-xl border px-3 py-2 transition-shadow ${
                  ref.id === selectedReferenceId
                    ? 'border-emerald-200 bg-emerald-50 hover:shadow-md'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-md'
                }`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/lumi-reference', JSON.stringify(ref))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 text-[11px] font-semibold ${
                    ref.id === selectedReferenceId ? 'text-emerald-600' : 'text-indigo-500'
                  }`}>
                    R{ref.referenceNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {ref.sourceDocTitle || 'Untitled source'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {ref.pageNumber ? `Page ${ref.pageNumber}` : 'No page'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-snug text-slate-600 line-clamp-3 group-hover:line-clamp-none group-hover:max-h-60 group-hover:overflow-y-auto group-hover:rounded-md group-hover:bg-white/80">
                      {ref.selectedText?.trim() || '—'}
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
                <div className="pt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => onGoToReference?.(ref)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Go to reference
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddReference?.(ref)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    Add reference
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="relative w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-colors flex items-center justify-center"
        aria-label={open ? 'Hide references' : 'Show references'}
      >
        <LinkIcon className="h-5 w-5" />
        {references.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {references.length}
          </span>
        )}
      </button>
    </div>
  )
}
