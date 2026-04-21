'use client'

import React, { useState } from 'react'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Link, Image, Minus, Plus, ChevronDown, Printer, Undo, Redo, PaintBucket, Type, Highlighter, MoreVertical } from 'lucide-react'
import type { EditProposal } from '@/lib/services/ai/synthesize'

type WriterProps = {
  fileName: string
  content: string
  onChangeContent: (val: string) => void
  pendingEditProposal: EditProposal | null
  onApprovePendingEdit: () => void
  onRejectPendingEdit: () => void
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

export default function Writer({
  fileName,
  content,
  onChangeContent,
  pendingEditProposal,
  onApprovePendingEdit,
  onRejectPendingEdit
}: WriterProps) {
  const [zoom, setZoom] = useState(100)
  const [font, setFont] = useState('Arial')
  const [fontSize, setFontSize] = useState('11')

  const fonts = ['Arial', 'Calibri', 'Comic Sans MS', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana']
  const fontSizes = ['8', '9', '10', '11', '12', '14', '18', '24', '30', '36']
  const lineOps = pendingEditProposal ? getLineDiffOps(content || '', pendingEditProposal.proposedContent || '') : []

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
    <div className="h-full flex flex-col bg-[#f9fbfd]">
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
            <textarea
              value={content}
              onChange={(e) => onChangeContent(e.target.value)}
              placeholder="Start typing..."
              className="w-full min-h-[1056px] resize-none outline-none text-gray-900 leading-relaxed"
              style={{
                fontFamily: font,
                fontSize: `${fontSize}pt`,
                lineHeight: '1.5'
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}