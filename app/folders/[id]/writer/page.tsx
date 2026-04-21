'use client'

import { Suspense, useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Writer from '../../../../components/writer/Writer'
import WritingAIPanel from '../../../../components/writer/WritingAIPanel'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import { useFileReferences } from '@/hooks/useFileReferences'
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
  const [accountId, setAccountId] = useState<string | null>(null)
  const [extraRefs, setExtraRefs] = useState<Reference[]>([])

  // File-scoped references: only refs attached to this specific document
  const { references: fileRefs, detach: detachRef, attach: attachRef } = useFileReferences(docId || null)

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

  // Auth for attaching references
  useEffect(() => {
    if (!supabase) return
    const hydrate = async () => {
      const session = await supabase.auth.getSession()
      setAccountId(session.data.session?.user?.id ?? null)
    }
    hydrate()
    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAccountId(session?.user?.id ?? null)
    })
    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [supabase])

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

  const activeRefs = useMemo(() => {
    const seen = new Set<string>()
    const merged: Reference[] = []
    fileRefs.forEach((r) => {
      if (!seen.has(r.id)) {
        seen.add(r.id)
        merged.push(r)
      }
    })
    extraRefs.forEach((r) => {
      if (!seen.has(r.id)) {
        seen.add(r.id)
        merged.push(r)
      }
    })
    return merged
  }, [fileRefs, extraRefs])

  const addActiveRef = useCallback(
    (ref: Reference) => {
      setExtraRefs((prev) => {
        if (prev.find((r) => r.id === ref.id)) return prev
        if (fileRefs.find((r) => r.id === ref.id)) return prev
        return [...prev, ref]
      })
      if (accountId && attachRef) {
        attachRef(accountId, ref.id)
      }
    },
    [accountId, attachRef, fileRefs]
  )

  const handleReferenceDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/lumi-reference')) return
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/lumi-reference')
    if (!raw) return
    try {
      const ref = JSON.parse(raw) as Reference
      addActiveRef(ref)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'reference:add-to-chat' && event.data.reference) {
        addActiveRef(event.data.reference as Reference)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [addActiveRef])

  useEffect(() => {
    setExtraRefs((prev) => prev.filter((r) => !fileRefs.find((fr) => fr.id === r.id)))
  }, [fileRefs])

  const handleRemoveActiveRef = (id: string) => {
    detachRef(id)
    setExtraRefs((prev) => prev.filter((r) => r.id !== id))
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'reference:add-to-chat' && event.data.reference) {
        addActiveRef(event.data.reference as Reference)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [addActiveRef])

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
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/lumi-reference')) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={handleReferenceDrop}
        >
          <WritingAIPanel
            activeRefs={activeRefs}
            onRemoveActiveRef={handleRemoveActiveRef}
            documentContent={content}
            isCollapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
          />
        </div>
      </div>
    </div>
  )
}
