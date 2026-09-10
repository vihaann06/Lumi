'use client'

import { createPortal } from 'react-dom'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const TIP_MAX_H = 280
const GAP = 8

type TipStyle = {
  left: number
  top: number
  maxWidth: number
  maxHeight: number
}

function computeTip(anchor: HTMLElement | null, text: string): TipStyle | null {
  const trimmed = (text || '').trim()
  if (!anchor || !trimmed) return null
  const r = anchor.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxWidth = Math.min(448, vw - 16)
  const left = Math.max(8, Math.min(r.left, vw - maxWidth - 8))
  const top = r.bottom + GAP
  const maxHeight = Math.min(TIP_MAX_H, Math.max(96, vh - top - 12))
  return { left, top, maxWidth, maxHeight }
}

function TooltipBubble({
  tip,
  body,
  subheading,
}: {
  tip: TipStyle
  body: string
  subheading?: string | null
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[10000] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl"
      style={{
        left: tip.left,
        top: tip.top,
        maxWidth: tip.maxWidth,
        maxHeight: tip.maxHeight,
      }}
    >
      {subheading ? (
        <p className="mb-2 border-b border-slate-100 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {subheading}
        </p>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{body}</p>
    </div>
  )
}

type TooltipOptions = {
  /** Shown above quoted body (e.g. source title + page). */
  subheading?: string | null
}

/** For elements that cannot wrap children (e.g. citation `button`). */
export function useReferenceTextTooltip<T extends HTMLElement = HTMLElement>(
  text: string,
  options?: TooltipOptions
) {
  const anchorRef = useRef<T | null>(null)
  const [tip, setTip] = useState<TipStyle | null>(null)

  const measure = useCallback(() => {
    setTip(computeTip(anchorRef.current, text))
  }, [text])

  const show = useCallback(() => {
    measure()
  }, [measure])

  const hide = useCallback(() => {
    setTip(null)
  }, [])

  useLayoutEffect(() => {
    if (!tip) return
    const sync = () => setTip(computeTip(anchorRef.current, text))
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [tip, text])

  const trimmed = (text || '').trim()
  const subheading = options?.subheading?.trim() || null

  const tooltip =
    tip && trimmed
      ? createPortal(
          <TooltipBubble tip={tip} body={trimmed} subheading={subheading} />,
          document.body
        )
      : null

  return {
    anchorRef,
    hoverHandlers: trimmed ? { onMouseEnter: show, onMouseLeave: hide } : {},
    tooltip,
  }
}

export default function ReferenceTextHoverPreview({
  text,
  children,
  className = '',
  layout = 'inline',
  subheading,
}: {
  text: string
  children: React.ReactNode
  className?: string
  layout?: 'inline' | 'block'
  subheading?: string | null
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [tip, setTip] = useState<TipStyle | null>(null)

  const measure = useCallback(() => {
    setTip(computeTip(anchorRef.current, text))
  }, [text])

  const show = useCallback(() => {
    measure()
  }, [measure])

  const hide = useCallback(() => {
    setTip(null)
  }, [])

  useLayoutEffect(() => {
    if (!tip) return
    const sync = () => setTip(computeTip(anchorRef.current, text))
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [tip, text])

  const trimmed = (text || '').trim()
  if (!trimmed) {
    return <div className={className}>{children}</div>
  }

  const layoutClass = layout === 'block' ? 'block w-full min-w-0' : 'inline-block max-w-full align-bottom'
  const sub = subheading?.trim() || null

  return (
    <>
      <div
        ref={anchorRef}
        className={`${layoutClass} ${className}`.trim()}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </div>
      {tip && createPortal(<TooltipBubble tip={tip} body={trimmed} subheading={sub} />, document.body)}
    </>
  )
}
