'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, BookmarkCheck, X } from 'lucide-react'
import Writer from '../../../../components/writer/Writer'
import WritingAIPanel from '../../../../components/writer/WritingAIPanel'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import { useReferences } from '@/hooks/useReferences'
import type { Reference } from '@/lib/types/references'

export default function FolderWritePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-50" />}>
      <FolderWriteContent />
    </Suspense>
  )
}

function FolderWriteContent() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const folderId = params?.id ?? ''
  const docId = searchParams.get('docId') || ''
  const initialName = useMemo(() => searchParams.get('name') || '', [searchParams])
  const hideHeader =
    (searchParams.get('hideHeader') || '').toLowerCase() === '1' ||
    (searchParams.get('hideHeader') || '').toLowerCase() === 'true'

  const [fileName, setFileName] = useState(initialName)
  const [content, setContent] = useState('')
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(360)
  const minPanel = 280
  const maxPanel = 520
  const supabase = getSupabaseClient()

  const { references, removeReference } = useReferences(folderId || null)
  const [activeRefs, setActiveRefs] = useState<Reference[]>([])
  const [refBubbleOpen, setRefBubbleOpen] = useState(false)

  const addActiveRef = useCallback((ref: Reference) => {
    setActiveRefs((prev) => {
      if (prev.some((r) => r.id === ref.id)) return prev
      return [...prev, ref]
    })
  }, [])

  const removeActiveRef = useCallback((id: string) => {
    setActiveRefs((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // Load existing content
  useEffect(() => {
    const load = async () => {
      if (!supabase || !docId) return
      const { data } = await supabase
        .from('document_assets')
        .select('content_json')
        .eq('doc_id', docId)
        .eq('kind', 'metadata_json')
        .maybeSingle()
      if (data?.content_json?.content) {
        setContent(data.content_json.content as string)
      }

      const doc = await supabase
        .from('documents')
        .select('title')
        .eq('id', docId)
        .maybeSingle()
      if (doc.data?.title) {
        setFileName(doc.data.title)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  // Save content (debounced)
  useEffect(() => {
    if (!supabase || !docId) return
    const timer = setTimeout(async () => {
      await supabase.from('document_assets').upsert({
        doc_id: docId,
        workspace_id: null,
        kind: 'metadata_json',
        bucket: 'documents',
        path: `docs/${docId}.json`,
        content_json: { content },
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [content, docId, supabase])

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Header (hidden when embedded in folder iframe) */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
          <button
            onClick={() => router.push(`/folders/${encodeURIComponent(folderId)}`)}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to folder
          </button>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Document name"
          />
        </div>
      )}

      {/* Main layout: writer + AI panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Writer area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <Writer fileName={fileName || 'Untitled'} content={content} onChangeContent={setContent} />
        </div>

        {/* Resizable divider */}
        <div
          className="w-1.5 cursor-col-resize bg-transparent hover:bg-slate-200 active:bg-slate-300 flex-shrink-0"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = panelWidth
            const onMove = (ev: MouseEvent) => {
              const delta = ev.clientX - startX
              const next = Math.min(Math.max(startWidth - delta, minPanel), maxPanel)
              setPanelWidth(next)
            }
            const onUp = () => {
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
        />

        {/* AI Panel */}
        <div
          className="border-l border-slate-200/60 flex-shrink-0 overflow-hidden"
          style={{
            width: panelCollapsed ? 48 : panelWidth,
            minWidth: panelCollapsed ? 48 : minPanel,
            maxWidth: panelCollapsed ? 48 : maxPanel,
          }}
        >
          <WritingAIPanel
            activeRefs={activeRefs}
            onRemoveActiveRef={removeActiveRef}
            documentContent={content}
            isCollapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
          />
        </div>
      </div>

      {/* Reference bubble - bottom left */}
      <div className="absolute bottom-5 left-5 z-40">
        {refBubbleOpen && (
          <div className="absolute bottom-14 left-0 w-80 max-h-96 bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">References</span>
              <span className="text-xs text-slate-400">{references.length} collected</span>
            </div>
            {references.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No references yet. Collect them while reading PDFs.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {references.map((ref, idx) => {
                  const isActive = activeRefs.some((r) => r.id === ref.id)
                  return (
                    <div
                      key={ref.id}
                      className={`group px-3 py-2.5 cursor-pointer transition-colors ${
                        isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => addActiveRef(ref)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                          <span className="font-semibold text-indigo-500 flex-shrink-0">R{idx + 1}</span>
                          <span className="font-medium text-slate-600 truncate">{ref.sourceDocTitle || 'Untitled'}</span>
                          {ref.pageNumber && <span className="text-slate-400 flex-shrink-0">p.{ref.pageNumber}</span>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isActive && (
                            <span className="text-[10px] text-indigo-500 font-medium">added</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeReference(ref.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                        &ldquo;{ref.selectedText}&rdquo;
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setRefBubbleOpen((v) => !v)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors relative ${
            refBubbleOpen
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
          }`}
          title="References"
        >
          <BookmarkCheck className="w-5 h-5" />
          {references.length > 0 && !refBubbleOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
              {references.length}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

