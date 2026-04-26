'use client'

import { useEffect, useRef } from 'react'
import { Link2, ShieldCheck, Network, Gauge } from 'lucide-react'
import type { WriterReferenceActionType } from '@/lib/db/queries/writerTextReferenceLinks'

type Props = {
  position: { x: number; y: number } | null
  onSelectAction: (action: WriterReferenceActionType) => void
  onDismiss: () => void
}

const actions: Array<{
  id: WriterReferenceActionType
  label: string
  icon: typeof Link2
}> = [
  { id: 'cite', label: 'Cite', icon: Link2 },
  { id: 'support', label: 'Support', icon: ShieldCheck },
  { id: 'connect', label: 'Connect', icon: Network },
  { id: 'evaluate_grounding', label: 'Evaluate Grounding', icon: Gauge },
]

export default function WriterReferenceActionMenu({
  position,
  onSelectAction,
  onDismiss,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!position) return
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        onDismiss()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [position, onDismiss])

  if (!position) return null

  return (
    <div
      ref={rootRef}
      className="absolute z-[220] w-[320px] bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 p-2"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, calc(-100% - 10px))',
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-400 px-2 pb-1">
        Attach reference
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onSelectAction(action.id)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Icon className="w-4 h-4 text-indigo-500" />
              <span>{action.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
