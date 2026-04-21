'use client'

import { Suspense, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Writer from '../../../../components/writer/Writer'
import WritingAIPanel from '../../../../components/writer/WritingAIPanel'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import { useFileReferences } from '@/hooks/useFileReferences'
import type { Reference } from '@/lib/types/references'
import type { EditProposal } from '@/lib/services/ai/synthesize'
import {
  listSynthesisReferenceMentionsForDocument,
  syncSynthesisReferenceMentions,
  type SynthesisReferenceMention,
} from '@/lib/db/queries/synthesisReferenceLinks'

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
  const [pendingEditProposal, setPendingEditProposal] = useState<EditProposal | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(360)
  const minPanel = 280
  const maxPanel = 520
  const supabase = getSupabaseClient()
  const [accountId, setAccountId] = useState<string | null>(null)
  const [extraRefs, setExtraRefs] = useState<Reference[]>([])
  const [citationMentions, setCitationMentions] = useState<SynthesisReferenceMention[]>([])
  const [focusedReferenceId, setFocusedReferenceId] = useState<string | null>(null)
  const hasLocalEditsRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const queuedContentRef = useRef<string | null>(null)
  const [writerDocMeta, setWriterDocMeta] = useState<{
    workspaceId: string | null
    accountId: string | null
  }>({ workspaceId: null, accountId: null })
  const [writerStorageMeta, setWriterStorageMeta] = useState<{
    bucket: string | null
    path: string | null
  }>({ bucket: null, path: null })
  const retryTimerRef = useRef<number | null>(null)

  // File-scoped references: only refs attached to this specific document
  const { references: fileRefs, detach: detachRef, attach: attachRef } = useFileReferences(docId || null)

  // Load existing content
  useEffect(() => {
    const load = async () => {
      if (!supabase || !docId) return
      const { data: docRow, error: docError } = await supabase
        .from('documents')
        .select('title, workspace_id, account_id, file_bucket, file_path')
        .eq('id', docId)
        .maybeSingle()
      if (docError) {
        console.error('Failed loading writer doc row', docError)
      }

      if (docRow?.title) {
        setFileName(docRow.title)
      }
      if (docRow) {
        setWriterDocMeta({
          workspaceId: (docRow as any).workspace_id ?? null,
          accountId: (docRow as any).account_id ?? null,
        })
        setWriterStorageMeta({
          bucket: (docRow as any).file_bucket ?? null,
          path: (docRow as any).file_path ?? null,
        })
      }

      let didLoadContent = false
      const writerBucket = (docRow as any)?.file_bucket
      const writerPath = (docRow as any)?.file_path
      if (writerBucket && writerPath) {
        const { data: writerBlob, error: writerDownloadError } = await supabase.storage
          .from(writerBucket)
          .download(writerPath)

        if (writerDownloadError) {
          // New writer docs can legitimately have no blob yet.
        } else if (writerBlob) {
          try {
            const raw = await writerBlob.text()
            let parsedContent: string | null = null
            try {
              const parsed = JSON.parse(raw)
              if (typeof parsed?.content === 'string') parsedContent = parsed.content
            } catch {
              parsedContent = raw
            }
            if (typeof parsedContent === 'string' && !hasLocalEditsRef.current) {
              setContent(parsedContent)
              didLoadContent = true
            }
          } catch (parseError) {
            console.error('Failed parsing writer content blob', parseError)
          }
        }
      }

      if (didLoadContent) return

      const { data: assetRow, error: assetError } = await supabase
        .from('document_assets')
        .select('bucket, path')
        .eq('doc_id', docId)
        .eq('kind', 'metadata_json')
        .maybeSingle()
      if (assetError) {
        console.error('Failed loading writer metadata asset row', assetError)
      }

      if (assetRow?.bucket && assetRow?.path) {
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from(assetRow.bucket)
          .download(assetRow.path)

        if (downloadError) {
          console.error('Failed loading writer content blob', downloadError)
        } else if (fileBlob) {
          try {
            const raw = await fileBlob.text()
            const parsed = JSON.parse(raw)
            if (typeof parsed?.content === 'string' && !hasLocalEditsRef.current) {
              setContent(parsed.content)
            }
          } catch (parseError) {
            console.error('Failed parsing writer content blob', parseError)
          }
        }
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  useEffect(() => {
    const loadMentions = async () => {
      if (!supabase || !docId) {
        setCitationMentions([])
        return
      }
      const mentions = await listSynthesisReferenceMentionsForDocument(supabase, docId)
      setCitationMentions(mentions)
    }
    loadMentions()
  }, [supabase, docId])

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

  const persistWriterContent = useCallback(async (snapshot: string) => {
    if (
      !supabase ||
      !docId ||
      !accountId ||
      !writerDocMeta.workspaceId ||
      !writerDocMeta.accountId ||
      !writerStorageMeta.bucket ||
      !writerStorageMeta.path
    ) return false

    const payload = new Blob([snapshot], { type: 'text/plain;charset=utf-8' })

    const { error: uploadError } = await supabase.storage
      .from(writerStorageMeta.bucket)
      .upload(writerStorageMeta.path, payload, {
        upsert: true,
        contentType: 'text/plain',
        cacheControl: '3600',
      })
    if (uploadError) {
      console.error('Failed uploading writer content blob', uploadError)
      return false
    }

    const { error } = await supabase
      .from('documents')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', docId)
    if (error) {
      console.error('Failed saving writer content', error)
      return false
    }
    return true
  }, [
    supabase,
    docId,
    accountId,
    writerDocMeta.workspaceId,
    writerDocMeta.accountId,
    writerStorageMeta.bucket,
    writerStorageMeta.path,
  ])

  const flushSaveQueue = useCallback(async () => {
    if (saveInFlightRef.current) return
    saveInFlightRef.current = true
    try {
      while (queuedContentRef.current !== null) {
        const snapshot = queuedContentRef.current
        queuedContentRef.current = null
        const saved = await persistWriterContent(snapshot)
        if (!saved) {
          if (queuedContentRef.current === null) queuedContentRef.current = snapshot
          if (retryTimerRef.current) {
            window.clearTimeout(retryTimerRef.current)
          }
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null
            void flushSaveQueue()
          }, 1500)
          break
        }
      }
    } finally {
      saveInFlightRef.current = false
    }
  }, [persistWriterContent])

  const queueWriterSave = useCallback((snapshot: string) => {
    queuedContentRef.current = snapshot
    void flushSaveQueue()
  }, [flushSaveQueue])

  // Save content (debounced + serialized to avoid out-of-order overwrites)
  useEffect(() => {
    if (!hasLocalEditsRef.current) return
    const timer = setTimeout(() => {
      queueWriterSave(content)
    }, 600)
    return () => clearTimeout(timer)
  }, [content, queueWriterSave])

  // If doc metadata arrives after edits started, flush latest queued save.
  useEffect(() => {
    if (!hasLocalEditsRef.current) return
    queueWriterSave(content)
  }, [
    writerDocMeta.workspaceId,
    writerDocMeta.accountId,
    writerStorageMeta.bucket,
    writerStorageMeta.path,
    accountId,
    queueWriterSave,
  ])

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

  const handleProposeEdit = (proposal: EditProposal) => {
    setPendingEditProposal(proposal)
  }

  const handleApproveEdit = () => {
    if (!pendingEditProposal?.proposedContent) return
    const nextMentions = pendingEditProposal.referenceMentions ?? []
    hasLocalEditsRef.current = true
    setContent(pendingEditProposal.proposedContent)
    setCitationMentions(nextMentions)
    if (supabase && docId && folderId && accountId) {
      void syncSynthesisReferenceMentions(supabase, {
        accountId,
        folderId,
        synthesisDocId: docId,
        mentions: nextMentions,
      }).then((ok) => {
        if (!ok) return
        void listSynthesisReferenceMentionsForDocument(supabase, docId).then((mentions) => {
          setCitationMentions(mentions)
        })
      })
    }
    setPendingEditProposal(null)
  }

  const handleRejectEdit = () => {
    setPendingEditProposal(null)
  }

  const handleContentChange = useCallback((next: string) => {
    hasLocalEditsRef.current = true
    setContent(next)
  }, [])

  const handleGoToSourceReference = useCallback((referenceId: string) => {
    if (!referenceId) return
    window.parent.postMessage({ type: 'reference:go-to-source', referenceId }, '*')
    window.parent.postMessage({ type: 'reference:focus', referenceId }, '*')
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'synthesis:focus-reference' && event.data.referenceId) {
        const targetId = String(event.data.referenceId)
        setFocusedReferenceId(targetId)
        window.parent.postMessage({ type: 'reference:focus', referenceId: targetId }, '*')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

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
          <Writer
            fileName={fileName || 'Untitled'}
            content={content}
            onChangeContent={handleContentChange}
            pendingEditProposal={pendingEditProposal}
            onApprovePendingEdit={handleApproveEdit}
            onRejectPendingEdit={handleRejectEdit}
            citationMentions={citationMentions}
            referenceLookup={activeRefs}
            focusedReferenceId={focusedReferenceId}
            onGoToSourceReference={handleGoToSourceReference}
          />
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
            onProposeEdit={handleProposeEdit}
            hasPendingEdit={Boolean(pendingEditProposal)}
            isCollapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
          />
        </div>
      </div>
    </div>
  )
}
