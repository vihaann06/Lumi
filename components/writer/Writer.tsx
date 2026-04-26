'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Link, Image, Minus, Plus, ChevronDown, Printer, Undo, Redo, PaintBucket, Type, Highlighter, MoreVertical } from 'lucide-react'
import type { EditProposal } from '@/lib/services/ai/synthesize'
import type { Reference } from '@/lib/types/references'
import type { SynthesisReferenceMention } from '@/lib/db/queries/synthesisReferenceLinks'

type WriterProps = {
  fileName: string
  content: string
  onChangeContent: (val: string) => void
  pendingEditProposal: EditProposal | null
  onApprovePendingEdit: () => void
  onRejectPendingEdit: () => void
  citationMentions: SynthesisReferenceMention[]
  referenceLookup: Reference[]
  focusedReferenceId: string | null
  onGoToSourceReference: (referenceId: string) => void
  onSelectionChange: (selection: { start: number; end: number; text: string } | null) => void
  activeSelection: { start: number; end: number; text: string } | null
  hasActiveSelection: boolean
  onDropReferenceOnSelection: (payload: {
    reference: Reference
    position: { x: number; y: number }
  }) => void
}

type LineOp = {
  type: 'unchanged' | 'added' | 'removed'
  line: string
}

type TokenDiff = {
  oldChanged: boolean[]
  newChanged: boolean[]
  oldTokens: string[]
  newTokens: string[]
}

type TokenOp = {
  type: 'unchanged' | 'added' | 'removed'
  token: string
}

type InlineCitationOccurrence = {
  key: string
  refLabel: string
  referenceId: string
}

type InlineCitationSegment =
  | { type: 'text'; text: string }
  | { type: 'citation'; text: string; occurrence: InlineCitationOccurrence }

type InlineCitationPosition = {
  key: string
  refLabel: string
  referenceId: string
  top: number
  left: number
  width: number
  height: number
}

const splitLines = (text: string) => text.split('\n')

const buildLcsTable = (a: string[], b: string[]) => {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

const getLineDiffOps = (oldText: string, newText: string): LineOp[] => {
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)
  const dp = buildLcsTable(oldLines, newLines)
  const ops: LineOp[] = []

  let i = oldLines.length
  let j = newLines.length
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'unchanged', line: oldLines[i - 1] })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'removed', line: oldLines[i - 1] })
      i--
    } else {
      ops.push({ type: 'added', line: newLines[j - 1] })
      j--
    }
  }
  while (i > 0) {
    ops.push({ type: 'removed', line: oldLines[i - 1] })
    i--
  }
  while (j > 0) {
    ops.push({ type: 'added', line: newLines[j - 1] })
    j--
  }

  return ops.reverse()
}

const splitWordTokens = (line: string) => line.match(/\S+|\s+/g) || []

const getWordDiff = (oldLine: string, newLine: string): TokenDiff => {
  const oldTokens = splitWordTokens(oldLine)
  const newTokens = splitWordTokens(newLine)
  const dp = buildLcsTable(oldTokens, newTokens)

  const oldChanged = Array(oldTokens.length).fill(false)
  const newChanged = Array(newTokens.length).fill(false)

  let i = oldTokens.length
  let j = newTokens.length
  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      oldChanged[i - 1] = true
      i--
    } else {
      newChanged[j - 1] = true
      j--
    }
  }
  while (i > 0) {
    oldChanged[i - 1] = true
    i--
  }
  while (j > 0) {
    newChanged[j - 1] = true
    j--
  }

  return { oldChanged, newChanged, oldTokens, newTokens }
}

const getWordOps = (oldLine: string, newLine: string): TokenOp[] => {
  const oldTokens = splitWordTokens(oldLine)
  const newTokens = splitWordTokens(newLine)
  const dp = buildLcsTable(oldTokens, newTokens)
  const ops: TokenOp[] = []

  let i = oldTokens.length
  let j = newTokens.length

  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      ops.push({ type: 'unchanged', token: oldTokens[i - 1] })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'removed', token: oldTokens[i - 1] })
      i--
    } else {
      ops.push({ type: 'added', token: newTokens[j - 1] })
      j--
    }
  }

  while (i > 0) {
    ops.push({ type: 'removed', token: oldTokens[i - 1] })
    i--
  }
  while (j > 0) {
    ops.push({ type: 'added', token: newTokens[j - 1] })
    j--
  }

  return ops.reverse()
}

const INLINE_CITATION_REGEX = /\[(R\d+)\]/gi

export default function Writer({
  fileName,
  content,
  onChangeContent,
  pendingEditProposal,
  onApprovePendingEdit,
  onRejectPendingEdit,
  citationMentions,
  referenceLookup,
  focusedReferenceId,
  onGoToSourceReference,
  onSelectionChange,
  activeSelection,
  hasActiveSelection,
  onDropReferenceOnSelection,
}: WriterProps) {
  const [zoom, setZoom] = useState(100)
  const [font, setFont] = useState('Arial')
  const [fontSize, setFontSize] = useState('11')

  const fonts = ['Arial', 'Calibri', 'Comic Sans MS', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana']
  const fontSizes = ['8', '9', '10', '11', '12', '14', '18', '24', '30', '36']
  const lineOps = pendingEditProposal ? getLineDiffOps(content || '', pendingEditProposal.proposedContent || '') : []

  const referenceById = new Map(referenceLookup.map((ref) => [ref.id, ref]))
  const mentionByReferenceId = useMemo(
    () => new Map(citationMentions.map((m) => [m.referenceId, m])),
    [citationMentions]
  )
  const labelToReferenceId = useMemo(() => {
    const map = new Map<string, string>()
    citationMentions.forEach((mention) => {
      map.set(mention.refLabel.toUpperCase(), mention.referenceId)
    })
    return map
  }, [citationMentions])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [inlineCitationPositions, setInlineCitationPositions] = useState<InlineCitationPosition[]>([])
  const MIN_EDITOR_HEIGHT = 1056

  useEffect(() => {
    const textareaEl = textareaRef.current
    if (!textareaEl || pendingEditProposal) return
    textareaEl.style.height = 'auto'
    textareaEl.style.height = `${Math.max(textareaEl.scrollHeight, MIN_EDITOR_HEIGHT)}px`
  }, [content, font, fontSize, pendingEditProposal])

  const inlineCitationModel = useMemo(() => {
    if (!content || labelToReferenceId.size === 0) {
      return { segments: [{ type: 'text', text: content || '' } as InlineCitationSegment], occurrences: [] as InlineCitationOccurrence[] }
    }

    const segments: InlineCitationSegment[] = []
    const occurrences: InlineCitationOccurrence[] = []
    let lastIndex = 0
    let localCounter = 0

    INLINE_CITATION_REGEX.lastIndex = 0
    let match: RegExpExecArray | null = INLINE_CITATION_REGEX.exec(content)

    while (match) {
      const fullToken = match[0]
      const labelRaw = String(match[1] || '').toUpperCase()
      const mappedReferenceId = labelToReferenceId.get(labelRaw)
      const start = match.index
      const end = start + fullToken.length

      if (start > lastIndex) {
        segments.push({ type: 'text', text: content.slice(lastIndex, start) })
      }

      if (mappedReferenceId) {
        const occurrence: InlineCitationOccurrence = {
          key: `${mappedReferenceId}-${localCounter}`,
          refLabel: labelRaw,
          referenceId: mappedReferenceId,
        }
        occurrences.push(occurrence)
        segments.push({ type: 'citation', text: fullToken, occurrence })
        localCounter += 1
      } else {
        segments.push({ type: 'text', text: fullToken })
      }

      lastIndex = end
      match = INLINE_CITATION_REGEX.exec(content)
    }

    if (lastIndex < content.length) {
      segments.push({ type: 'text', text: content.slice(lastIndex) })
    }

    return { segments, occurrences }
  }, [content, labelToReferenceId])

  useEffect(() => {
    const textareaEl = textareaRef.current
    const mirrorEl = mirrorRef.current
    if (!textareaEl || !mirrorEl) {
      setInlineCitationPositions([])
      return
    }

    const nextPositions: InlineCitationPosition[] = inlineCitationModel.occurrences
      .map((occurrence) => {
        const markerEl = mirrorEl.querySelector(
          `[data-inline-citation-key="${occurrence.key}"]`
        ) as HTMLSpanElement | null
        if (!markerEl) return null
        return {
          key: occurrence.key,
          refLabel: occurrence.refLabel,
          referenceId: occurrence.referenceId,
          top: markerEl.offsetTop - scrollTop,
          left: markerEl.offsetLeft - scrollLeft,
          width: markerEl.offsetWidth,
          height: markerEl.offsetHeight,
        }
      })
      .filter((item): item is InlineCitationPosition => Boolean(item))

    setInlineCitationPositions(nextPositions)
  }, [inlineCitationModel, scrollTop, scrollLeft, font, fontSize, zoom])

  useEffect(() => {
    const textareaEl = textareaRef.current
    if (!textareaEl) return
    const handleScroll = () => {
      setScrollTop(textareaEl.scrollTop)
      setScrollLeft(textareaEl.scrollLeft)
    }
    textareaEl.addEventListener('scroll', handleScroll)
    return () => textareaEl.removeEventListener('scroll', handleScroll)
  }, [])

  const updateSelection = () => {
    const textareaEl = textareaRef.current
    if (!textareaEl) return
    const start = textareaEl.selectionStart ?? 0
    const end = textareaEl.selectionEnd ?? 0
    if (end > start) {
      onSelectionChange({ start, end, text: content.slice(start, end) })
    } else {
      onSelectionChange(null)
    }
  }

  const restoreActiveSelection = () => {
    const textareaEl = textareaRef.current
    if (!textareaEl || !activeSelection || !hasActiveSelection) return
    const start = Math.max(0, Math.min(activeSelection.start, content.length))
    const end = Math.max(start, Math.min(activeSelection.end, content.length))
    textareaEl.focus({ preventScroll: true })
    textareaEl.setSelectionRange(start, end)
  }

  useEffect(() => {
    const textareaEl = textareaRef.current
    if (!textareaEl || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      setScrollTop((prev) => prev)
      setScrollLeft((prev) => prev)
    })
    observer.observe(textareaEl)
    return () => observer.disconnect()
  }, [])

  const renderInlineWordOps = (ops: TokenOp[]) => (
    <span className="whitespace-pre-wrap">
      {ops.map((op, idx) => {
        const isWhitespace = op.token.trim().length === 0
        if (isWhitespace || op.type === 'unchanged') {
          return <span key={idx}>{op.token}</span>
        }

        if (op.type === 'removed') {
          return (
            <span key={idx} className="bg-rose-200 text-rose-900 rounded-sm line-through">
              {op.token}
            </span>
          )
        }

        return (
          <span key={idx} className="bg-emerald-200 text-emerald-900 rounded-sm">
            {op.token}
          </span>
        )
      })}
    </span>
  )

  const renderedDiffLines: React.ReactNode[] = []
  for (let idx = 0; idx < lineOps.length; idx++) {
    const op = lineOps[idx]
    const next = lineOps[idx + 1]
    const isPair = op.type === 'removed' && next?.type === 'added'

    if (isPair) {
      const wordOps = getWordOps(op.line, next.line)
      renderedDiffLines.push(
        <div key={`pair-${idx}`} className="text-sm leading-relaxed">
          <div className="inline-block min-w-4 text-amber-500 mr-2 align-top">~</div>
          <div className="inline">{renderInlineWordOps(wordOps)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 ml-6">Inline edit</div>
        </div>
      )
      idx++
      continue
    }

    if (op.type === 'added') {
      const next = lineOps[idx + 1]
      const prev = lineOps[idx - 1]
      const isLikelyRewriteNeighbor = prev?.type === 'removed' || next?.type === 'removed'
      if (isLikelyRewriteNeighbor) {
        const neighbor = prev?.type === 'removed' ? prev : next
        if (neighbor) {
          const wordOps = getWordOps(neighbor.line, op.line)
          renderedDiffLines.push(
            <div key={`rewrite-${idx}`} className="text-sm leading-relaxed">
              <div className="inline-block min-w-4 text-amber-500 mr-2 align-top">~</div>
              <div className="inline">{renderInlineWordOps(wordOps)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 ml-6">Inline edit</div>
            </div>
          )
          continue
        }
      }
      renderedDiffLines.push(
        <div key={`add-${idx}`} className="text-sm leading-relaxed">
          <span className="text-emerald-500 mr-2">+</span>
          <span className="bg-emerald-100 text-emerald-900 rounded-sm">{op.line}</span>
        </div>
      )
      continue
    }

    if (op.type === 'removed') {
      const prev = lineOps[idx - 1]
      const next = lineOps[idx + 1]
      const hasLikelyRewriteNeighbor = prev?.type === 'added' || next?.type === 'added'
      if (hasLikelyRewriteNeighbor) {
        continue
      }
      renderedDiffLines.push(
        <div key={`rem-${idx}`} className="text-sm leading-relaxed">
          <span className="text-rose-500 mr-2">−</span>
          <span className="bg-rose-100 text-rose-900 rounded-sm">{op.line}</span>
        </div>
      )
      continue
    }

    renderedDiffLines.push(
      <div key={`same-${idx}`} className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
        {op.line}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="h-full flex flex-col bg-[#f9fbfd]">
      {/* Top Bar */}
      <div className="bg-[#f9fbfd] border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white rounded border border-gray-300 flex items-center justify-center">
                <div className="w-6 h-7 bg-blue-500 rounded-sm"></div>
              </div>
              <div>
                <input
                  type="text"
                  value={fileName || 'Untitled document'}
                  className="text-[18px] text-gray-800 bg-transparent border-none outline-none hover:border hover:border-gray-300 px-1 rounded"
                  readOnly
                />
                <div className="flex items-center gap-3 text-[13px] text-gray-600">
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">File</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Edit</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">View</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Insert</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Format</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Tools</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Extensions</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Help</button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded font-medium">
              Share
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <MoreVertical className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#edf2fa] border-b border-gray-300 px-4 py-2">
        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Undo">
            <Undo className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Redo">
            <Redo className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Print">
            <Printer className="h-5 w-5 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1 hover:bg-gray-200 rounded">
              <Minus className="h-4 w-4 text-gray-700" />
            </button>
            <span className="text-sm text-gray-700 w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 hover:bg-gray-200 rounded">
              <Plus className="h-4 w-4 text-gray-700" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Font Family */}
          <select 
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 cursor-pointer min-w-[140px]"
          >
            {fonts.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* Font Size */}
          <select 
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 cursor-pointer w-16"
          >
            {fontSizes.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Text Formatting */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Bold">
            <Bold className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Italic">
            <Italic className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Underline">
            <Underline className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded flex items-center" title="Text color">
            <Type className="h-5 w-5 text-gray-700" />
            <ChevronDown className="h-3 w-3 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded flex items-center" title="Highlight">
            <Highlighter className="h-5 w-5 text-gray-700" />
            <ChevronDown className="h-3 w-3 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Insert */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Insert link">
            <Link className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Insert image">
            <Image className="h-5 w-5 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Alignment */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Align left">
            <AlignLeft className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Align center">
            <AlignCenter className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Align right">
            <AlignRight className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Justify">
            <AlignJustify className="h-5 w-5 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Lists */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Bulleted list">
            <List className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Numbered list">
            <ListOrdered className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-auto bg-[#f9fbfd] py-6">
        <div className="mx-auto bg-white shadow-lg" style={{ 
          width: `${8.5 * zoom}px`,
          minHeight: `${11 * zoom}px`,
          padding: `${zoom}px`,
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center'
        }}>
          {pendingEditProposal ? (
            <div className="min-h-[1056px]">
              <div className="sticky top-0 z-10 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Pending AI edits
                  </p>
                  <p className="text-xs text-amber-800">{pendingEditProposal.summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onApprovePendingEdit}
                    className="text-xs px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={onRejectPendingEdit}
                    className="text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-white"
                  >
                    Reject
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {renderedDiffLines}
              </div>
            </div>
          ) : (
            <div className="relative min-h-[1056px]">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onChangeContent(e.target.value)}
                onSelect={updateSelection}
                onKeyUp={updateSelection}
                onMouseUp={updateSelection}
                placeholder="Start typing..."
                className="w-full min-h-[1056px] resize-none overflow-hidden outline-none text-gray-900 leading-relaxed p-0"
                style={{
                  fontFamily: font,
                  fontSize: `${fontSize}pt`,
                  lineHeight: '1.5'
                }}
                onDragOver={(e) => {
                  if (!hasActiveSelection) return
                  if (!Array.from(e.dataTransfer.types || []).includes('application/lumi-reference')) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                  restoreActiveSelection()
                }}
                onDrop={(e) => {
                  if (!hasActiveSelection) return
                  if (!Array.from(e.dataTransfer.types || []).includes('application/lumi-reference')) return
                  e.preventDefault()
                  restoreActiveSelection()
                  const raw = e.dataTransfer.getData('application/lumi-reference')
                  if (!raw) return
                  try {
                    const reference = JSON.parse(raw) as Reference
                    const rootRect = rootRef.current?.getBoundingClientRect()
                    onDropReferenceOnSelection({
                      reference,
                      position: {
                        x: e.clientX - (rootRect?.left || 0),
                        y: e.clientY - (rootRect?.top || 0),
                      },
                    })
                  } catch {
                    // ignore malformed drag payload
                  }
                }}
              />
              {inlineCitationModel.occurrences.length > 0 && (
                <>
                  <div
                    ref={mirrorRef}
                    aria-hidden="true"
                    className="absolute inset-0 invisible whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
                    style={{
                      fontFamily: font,
                      fontSize: `${fontSize}pt`,
                      lineHeight: '1.5',
                      padding: 0,
                    }}
                  >
                    {inlineCitationModel.segments.map((segment, idx) => {
                      if (segment.type === 'text') return <React.Fragment key={`txt-${idx}`}>{segment.text}</React.Fragment>
                      return (
                        <span
                          key={segment.occurrence.key}
                          data-inline-citation-key={segment.occurrence.key}
                        >
                          {segment.text}
                        </span>
                      )
                    })}
                  </div>
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {inlineCitationPositions.map((chip) => {
                      const ref = referenceById.get(chip.referenceId)
                      const mention = mentionByReferenceId.get(chip.referenceId)
                      const isFocused = focusedReferenceId === chip.referenceId
                      const markerLabel = `[${chip.refLabel}]`
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          className={`group pointer-events-auto absolute z-10 inline-flex items-center justify-center rounded-sm border text-[10px] font-semibold leading-none transition-all duration-200 hover:shadow-sm ${
                            isFocused
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                              : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300'
                          }`}
                          style={{
                            top: chip.top,
                            left: chip.left,
                            width: chip.width,
                            height: chip.height,
                          }}
                          onClick={() => onGoToSourceReference(chip.referenceId)}
                          title="Go to referenced source highlight"
                        >
                          <span className="whitespace-nowrap">{markerLabel}</span>
                          <span className="pointer-events-none absolute left-full top-1/2 ml-1 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm group-hover:inline-flex">
                            {(ref?.sourceDocTitle || 'Source')}{ref?.pageNumber ? ` p.${ref.pageNumber}` : ''} • x{mention?.citationCount || 1}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}