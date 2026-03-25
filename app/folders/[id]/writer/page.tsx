'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Writer from '../../../../components/writer/Writer'
import WritingAIPanel from '../../../../components/writer/WritingAIPanel'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import { useFileReferences } from '@/hooks/useFileReferences'

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

  // File-scoped references: only refs attached to this specific document
  const { references: fileRefs, detach: detachRef } = useFileReferences(docId || null)

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
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
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

        {/* AI Panel — uses file-scoped references automatically */}
        <div
          className="border-l border-slate-200/60 flex-shrink-0 overflow-hidden"
          style={{
            width: panelCollapsed ? 48 : panelWidth,
            minWidth: panelCollapsed ? 48 : minPanel,
            maxWidth: panelCollapsed ? 48 : maxPanel,
          }}
        >
          <WritingAIPanel
            activeRefs={fileRefs}
            onRemoveActiveRef={(id) => detachRef(id)}
            documentContent={content}
            isCollapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
          />
        </div>
      </div>
    </div>
  )
}
