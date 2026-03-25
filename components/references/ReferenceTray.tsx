'use client'

import React, { useState } from 'react'
import { BookmarkMinus, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import type { Reference } from '@/lib/types/references'

function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '...'
}

type ReferenceTrayProps = {
  references: Reference[]
  onRemove?: (id: string) => void
  onSelect?: (ref: Reference) => void
  selectedIds?: Set<string>
  draggable?: boolean
  compact?: boolean
}

export default function ReferenceTray({
  references,
  onRemove,
  onSelect,
  selectedIds,
  draggable = false,
  compact = false,
}: ReferenceTrayProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (references.length === 0) return null

  return (
    <div className={`border-t border-slate-200/60 bg-slate-50/80 ${compact ? '' : 'flex flex-col'}`}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-100/60"
      >
        <span>References ({references.length})</span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {!collapsed && (
        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
          {references.map((ref, idx) => {
            const isSelected = selectedIds?.has(ref.id)
            return (
              <div
                key={ref.id}
                className={`group px-3 py-2 text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-emerald-50 border-l-2 border-emerald-400'
                    : 'hover:bg-slate-100/60 border-l-2 border-transparent'
                }`}
                onClick={() => onSelect?.(ref)}
                draggable={draggable}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/lumi-reference', JSON.stringify(ref))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-600 truncate">
                      {ref.sourceDocTitle || 'Untitled'}
                    </span>
                    <span className="text-slate-400 flex-shrink-0">
                      R{idx + 1}
                    </span>
                    {ref.pageNumber && (
                      <span className="text-slate-400 flex-shrink-0">p.{ref.pageNumber}</span>
                    )}
                  </div>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(ref.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-500 text-slate-400 transition-opacity"
                      title="Remove reference"
                    >
                      <BookmarkMinus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-slate-500 leading-relaxed">
                  &ldquo;{truncate(ref.selectedText)}&rdquo;
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
