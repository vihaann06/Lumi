'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  X,
  Sparkles,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import type { Reference } from '@/lib/types/references'
import {
  synthesizeChat,
  synthesizeEditProposal,
  refsToContext,
  extractReferenceMentions,
  type SynthesisMessage,
  type EditProposal,
} from '@/lib/services/ai/synthesize'

function truncate(text: string, maxLen = 50): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '...'
}

type WritingAIPanelProps = {
  activeRefs: Reference[]
  onRemoveActiveRef: (id: string) => void
  documentContent: string
  onProposeEdit: (proposal: EditProposal) => void
  hasPendingEdit: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function WritingAIPanel({
  activeRefs,
  onRemoveActiveRef,
  documentContent,
  onProposeEdit,
  hasPendingEdit,
  isCollapsed,
  onToggleCollapse,
}: WritingAIPanelProps) {
  const [messages, setMessages] = useState<SynthesisMessage[]>([])
  const [mode, setMode] = useState<'ask' | 'edit'>('ask')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    if (mode === 'ask') {
      const userMsg: SynthesisMessage = { role: 'user', content: trimmed }
      const updated = [...messages, userMsg]
      setMessages(updated)
      setInput('')
      setIsLoading(true)

      try {
        const refCtx = refsToContext(activeRefs)
        const aiContent = await synthesizeChat(updated, refCtx, documentContent)
        setMessages([...updated, { role: 'assistant', content: aiContent }])
      } catch (err: any) {
        setMessages([
          ...updated,
          {
            role: 'assistant',
            content: `Error: ${err.message || 'Something went wrong. Please try again.'}`,
          },
        ])
      } finally {
        setIsLoading(false)
      }
      return
    }

    setInput('')
    setIsLoading(true)
    try {
      const refCtx = refsToContext(activeRefs)
      const proposal = await synthesizeEditProposal(trimmed, refCtx, documentContent)
      proposal.referenceMentions = extractReferenceMentions(proposal.proposedContent, refCtx)
      onProposeEdit(proposal)
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: `[Edit request] ${trimmed}` },
        {
          role: 'assistant',
          content: `I proposed edits for your draft. Review them in the document view and approve/reject there.\n\n${proposal.summary}`,
        },
      ])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to generate edit proposal.'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          title="Open AI panel"
        >
          <PanelRightOpen className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">Synthesis AI</span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-slate-100 text-slate-400"
          title="Collapse panel"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>
      <div className="px-3 py-2 border-b border-slate-200/60 bg-slate-50/50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('ask')}
          className={`text-xs px-2.5 py-1 rounded-md border ${
            mode === 'ask'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Ask
        </button>
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`text-xs px-2.5 py-1 rounded-md border ${
            mode === 'edit'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Edit
        </button>
        {mode === 'edit' && hasPendingEdit && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            Pending review in document
          </span>
        )}
      </div>

      {/* Active references chips */}
      {activeRefs.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-200/60 bg-slate-50/50">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Using {activeRefs.length} reference{activeRefs.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeRefs.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center gap-1.5 text-xs bg-white rounded-md border border-slate-200 pl-2 pr-1 py-1 cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/lumi-reference', JSON.stringify(ref))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <span className="text-indigo-500 font-semibold">R{ref.referenceNumber}</span>
                <span className="text-slate-500 max-w-[100px] truncate">
                  {truncate(ref.selectedText, 30)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveActiveRef(ref.id)}
                  className="p-0.5 text-slate-400 hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 max-w-[200px] mx-auto leading-relaxed">
              {mode === 'edit'
                ? 'Describe what to edit. I will propose document changes for your approval.'
                : activeRefs.length > 0
                ? 'Ask me to synthesize, connect, or integrate your references.'
                : 'Click references in the bubble to add them, then ask me to help synthesize.'}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === 'user'
                ? 'text-slate-700'
                : 'text-slate-600 bg-slate-50 rounded-lg p-3'
            }`}
          >
            {msg.role === 'user' ? (
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-semibold text-slate-500">U</span>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-lg p-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Synthesizing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200/60 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'edit'
                ? 'e.g., "Rewrite the introduction for clarity and add a stronger thesis."'
                : activeRefs.length > 0
                  ? 'e.g., "Synthesize these references into a paragraph..."'
                  : 'Add references first, then ask...'
            }
            rows={2}
            className="flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
