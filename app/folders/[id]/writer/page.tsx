'use client'

import { Suspense, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Writer from '../../../../components/writer/Writer'
import WritingAIPanel from '../../../../components/writer/WritingAIPanel'
import WriterReferenceActionMenu from '../../../../components/writer/WriterReferenceActionMenu'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import { useFileReferences } from '@/hooks/useFileReferences'
import { getDocumentContent, upsertDocumentContent } from '@/lib/db/queries/documentContents'
import type { Reference } from '@/lib/types/references'
import {
  refsToContext,
  extractReferenceMentions,
  synthesizeWriterSpanAction,
  type EditProposal,
  type SynthesisMessage,
} from '@/lib/services/ai/synthesize'
import {
  listSynthesisReferenceMentionsForDocument,
  syncSynthesisReferenceMentions,
  type SynthesisReferenceMention,
} from '@/lib/db/queries/synthesisReferenceLinks'
import {
  createWriterTextReferenceLink,
  type WriterReferenceActionType,
} from '@/lib/db/queries/writerTextReferenceLinks'

const inMemoryWriterDrafts = new Map<string, { content: string; updatedAt: number }>()
let hasWarnedLocalDraftStorage = false

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
  const [writerSelection, setWriterSelection] = useState<{
    start: number
    end: number
    text: string
  } | null>(null)
  const [pendingDroppedReference, setPendingDroppedReference] = useState<Reference | null>(null)
  const [selectionActionMenuPosition, setSelectionActionMenuPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [externalPanelEvent, setExternalPanelEvent] = useState<{
    id: string
    message: SynthesisMessage
  } | null>(null)
  const [isSelectionActionLoading, setIsSelectionActionLoading] = useState(false)
  const hasLocalEditsRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const queuedContentRef = useRef<string | null>(null)
  const [writerDocMeta, setWriterDocMeta] = useState<{
    workspaceId: string | null
    accountId: string | null
  }>({ workspaceId: null, accountId: null })
  const retryTimerRef = useRef<number | null>(null)
  const cloudSaveBlockedRef = useRef(false)
  const warnedCloudSaveBlockedRef = useRef(false)
  const activeLoadDocIdRef = useRef<string>('')
  const LOCAL_DRAFT_PREFIX = 'lumi:writer-draft:'

  // File-scoped references: only refs attached to this specific document
  const { references: fileRefs, detach: detachRef, attach: attachRef } = useFileReferences(docId || null)

  const getLocalDraftKey = useCallback(
    (targetDocId: string) => `${LOCAL_DRAFT_PREFIX}${targetDocId}`,
    []
  )

  const readLocalDraft = useCallback((targetDocId: string): string | null => {
    const memoryDraft = inMemoryWriterDrafts.get(targetDocId)
    let storageDraft: { content: string; updatedAt: number } | null = null
    const parseDraft = (raw: string | null): { content: string; updatedAt: number } | null => {
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.content === 'string') {
          return {
            content: parsed.content,
            updatedAt: Number(parsed?.updatedAt || 0) || 0,
          }
        }
      } catch {
        if (typeof raw === 'string') {
          return { content: raw, updatedAt: 0 }
        }
      }
      return null
    }

    const candidates: Array<{ content: string; updatedAt: number }> = []
    if (memoryDraft) candidates.push(memoryDraft)
    try {
      const raw = window.localStorage.getItem(getLocalDraftKey(targetDocId))
      const parsed = parseDraft(raw)
      if (parsed) candidates.push(parsed)
    } catch {
      if (!hasWarnedLocalDraftStorage) {
        hasWarnedLocalDraftStorage = true
        console.warn('localStorage unavailable in writer iframe; using in-memory draft fallback.')
      }
    }

    try {
      const parentWin = window.parent
      if (parentWin && parentWin !== window) {
        const parentLocal = parentWin.localStorage.getItem(getLocalDraftKey(targetDocId))
        const parsedParentLocal = parseDraft(parentLocal)
        if (parsedParentLocal) candidates.push(parsedParentLocal)
      }
    } catch {
      // parent window may be inaccessible in some sandbox contexts
    }

    storageDraft = candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
    return storageDraft?.content ?? null
  }, [getLocalDraftKey])

  const writeLocalDraft = useCallback((targetDocId: string, snapshot: string) => {
    const payload = { content: snapshot, updatedAt: Date.now() }
    inMemoryWriterDrafts.set(targetDocId, payload)
    const serialized = JSON.stringify(payload)
    try {
      window.localStorage.setItem(getLocalDraftKey(targetDocId), serialized)
    } catch {
      if (!hasWarnedLocalDraftStorage) {
        hasWarnedLocalDraftStorage = true
        console.warn('Unable to persist writer draft to localStorage; using in-memory draft fallback.')
      }
    }
    try {
      const parentWin = window.parent
      if (parentWin && parentWin !== window) {
        parentWin.localStorage.setItem(getLocalDraftKey(targetDocId), serialized)
      }
    } catch {
      // parent window may be inaccessible in some sandbox contexts
    }
  }, [getLocalDraftKey])

  // Initialize per-doc editor state with local draft first (if available).
  useEffect(() => {
    if (!docId) return
    activeLoadDocIdRef.current = docId
    setPendingEditProposal(null)
    setFocusedReferenceId(null)
    setCitationMentions([])
    setContent('')
    hasLocalEditsRef.current = false
    cloudSaveBlockedRef.current = false
    warnedCloudSaveBlockedRef.current = false
    queuedContentRef.current = null
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    const localDraft = readLocalDraft(docId)
    if (typeof localDraft === 'string' && localDraft.trim().length > 0) {
      setContent(localDraft)
      hasLocalEditsRef.current = true
    }
  }, [docId, readLocalDraft])

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [])

  // Load existing content
  useEffect(() => {
    const load = async () => {
      if (!supabase || !docId) return
      const loadDocId = docId
      const { data: docRow, error: docError } = await supabase
        .from('documents')
        .select('title, workspace_id, account_id, file_bucket, file_path')
        .eq('id', docId)
        .maybeSingle()
      if (activeLoadDocIdRef.current !== loadDocId) return
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
      }

      let didLoadContent = false
      const rowContent = await getDocumentContent(supabase, loadDocId)
      if (activeLoadDocIdRef.current !== loadDocId) return
      if (typeof rowContent === 'string' && !hasLocalEditsRef.current) {
        setContent(rowContent)
        writeLocalDraft(loadDocId, rowContent)
        didLoadContent = true
      }
      if (didLoadContent) return

      const writerBucket = (docRow as any)?.file_bucket
      const writerPath = (docRow as any)?.file_path
      if (writerBucket && writerPath) {
        const { data: writerBlob, error: writerDownloadError } = await supabase.storage
          .from(writerBucket)
          .download(writerPath)
        if (activeLoadDocIdRef.current !== loadDocId) return

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
              writeLocalDraft(loadDocId, parsedContent)
              didLoadContent = true
              const workspaceId = (docRow as any)?.workspace_id
              const ownerAccountId = (docRow as any)?.account_id
              if (workspaceId && ownerAccountId) {
                void upsertDocumentContent(supabase, {
                  docId: loadDocId,
                  workspaceId,
                  accountId: ownerAccountId,
                  content: parsedContent,
                })
              }
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
      if (activeLoadDocIdRef.current !== loadDocId) return
      if (assetError) {
        console.error('Failed loading writer metadata asset row', assetError)
      }

      if (assetRow?.bucket && assetRow?.path) {
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from(assetRow.bucket)
          .download(assetRow.path)
        if (activeLoadDocIdRef.current !== loadDocId) return

        if (downloadError) {
          console.error('Failed loading writer content blob', downloadError)
        } else if (fileBlob) {
          try {
            const raw = await fileBlob.text()
            const parsed = JSON.parse(raw)
            if (typeof parsed?.content === 'string' && !hasLocalEditsRef.current) {
              setContent(parsed.content)
              writeLocalDraft(loadDocId, parsed.content)
              const workspaceId = (docRow as any)?.workspace_id
              const ownerAccountId = (docRow as any)?.account_id
              if (workspaceId && ownerAccountId) {
                void upsertDocumentContent(supabase, {
                  docId: loadDocId,
                  workspaceId,
                  accountId: ownerAccountId,
                  content: parsed.content,
                })
              }
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
      !writerDocMeta.workspaceId ||
      !writerDocMeta.accountId
    ) return false
    if (cloudSaveBlockedRef.current) return true

    const saveResult = await upsertDocumentContent(supabase, {
      docId,
      workspaceId: writerDocMeta.workspaceId,
      accountId: writerDocMeta.accountId,
      content: snapshot,
    })
    if (!saveResult.ok) {
      if (saveResult.rlsDenied) {
        cloudSaveBlockedRef.current = true
        if (!warnedCloudSaveBlockedRef.current) {
          warnedCloudSaveBlockedRef.current = true
          console.warn(
            'Cloud save blocked by Supabase RLS for this document_contents row. Keeping draft in local storage.'
          )
        }
        return true
      }
      console.error('Failed saving writer content row')
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
    writerDocMeta.workspaceId,
    writerDocMeta.accountId,
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
    if (!docId) return
    writeLocalDraft(docId, content)
  }, [content, docId, writeLocalDraft])

  useEffect(() => {
    if (!hasLocalEditsRef.current) return
    const timer = setTimeout(() => {
      queueWriterSave(content)
    }, 600)
    return () => clearTimeout(timer)
  }, [content, queueWriterSave, docId])

  // If doc metadata arrives after edits started, flush latest queued save.
  useEffect(() => {
    if (!hasLocalEditsRef.current) return
    queueWriterSave(content)
  }, [
    writerDocMeta.workspaceId,
    writerDocMeta.accountId,
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

  const pushExternalPanelMessage = useCallback((message: SynthesisMessage) => {
    setExternalPanelEvent({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
    })
  }, [])

  useEffect(() => {
    if (writerSelection) return
    setSelectionActionMenuPosition(null)
    setPendingDroppedReference(null)
  }, [writerSelection])

  const persistWriterSpanProvenance = useCallback(
    async ({
      reference,
      actionType,
      selection,
      groundednessScore,
      analysisSummary,
    }: {
      reference: Reference
      actionType: WriterReferenceActionType
      selection: { start: number; end: number; text: string }
      groundednessScore?: number | null
      analysisSummary?: string | null
    }) => {
      if (!supabase || !accountId || !docId || !folderId || !writerDocMeta.workspaceId) return
      await createWriterTextReferenceLink(supabase, {
        accountId,
        workspaceId: writerDocMeta.workspaceId,
        folderId,
        synthesisDocId: docId,
        referenceId: reference.id,
        spanStart: selection.start,
        spanEnd: selection.end,
        selectedTextSnapshot: selection.text,
        actionType,
        groundednessScore: groundednessScore ?? null,
        analysisSummary: analysisSummary ?? null,
      })
    },
    [supabase, accountId, docId, folderId, writerDocMeta.workspaceId]
  )

  const handleDropReferenceOnSelection = useCallback(
    ({
      reference,
      position,
    }: {
      reference: Reference
      position: { x: number; y: number }
    }) => {
      if (!writerSelection || !writerSelection.text?.trim()) return
      setPendingDroppedReference(reference)
      setSelectionActionMenuPosition({
        x: position.x,
        y: Math.max(52, position.y - 36),
      })
      addActiveRef(reference)
    },
    [writerSelection, addActiveRef]
  )

  const handleDismissSelectionActionMenu = useCallback(() => {
    setSelectionActionMenuPosition(null)
    setPendingDroppedReference(null)
  }, [])

  const handleWriterSelectionAction = useCallback(
    async (actionType: WriterReferenceActionType) => {
      if (!pendingDroppedReference || !writerSelection) {
        handleDismissSelectionActionMenu()
        return
      }

      const ref = pendingDroppedReference
      const selection = writerSelection
      handleDismissSelectionActionMenu()

      if (actionType === 'cite') {
        const citationToken = `[R${ref.referenceNumber}]`
        const nextContent = `${content.slice(0, selection.end)} ${citationToken}${content.slice(selection.end)}`
        hasLocalEditsRef.current = true
        if (docId) writeLocalDraft(docId, nextContent)
        setContent(nextContent)

        const refCtx = refsToContext(activeRefs)
        const mentions = extractReferenceMentions(nextContent, refCtx)
        setCitationMentions(mentions)
        if (supabase && docId && folderId && accountId) {
          void syncSynthesisReferenceMentions(supabase, {
            accountId,
            folderId,
            synthesisDocId: docId,
            mentions,
          })
        }

        await persistWriterSpanProvenance({
          reference: ref,
          actionType: 'cite',
          selection,
        })
        pushExternalPanelMessage({
          role: 'assistant',
          content: `Attached [R${ref.referenceNumber}] to the selected text.`,
        })
        return
      }

      setIsSelectionActionLoading(true)
      try {
        const refCtx = refsToContext([ref])
        const result = await synthesizeWriterSpanAction({
          actionMode:
            actionType === 'evaluate_grounding'
              ? 'evaluate_grounding'
              : actionType === 'support'
              ? 'support'
              : 'connect',
          selectedText: selection.text,
          references: refCtx,
          documentContent: content,
        })

        await persistWriterSpanProvenance({
          reference: ref,
          actionType,
          selection,
          groundednessScore: result.groundednessScore,
          analysisSummary: result.analysisSummary,
        })

        if (actionType === 'evaluate_grounding') {
          const scoreLine =
            typeof result.groundednessScore === 'number'
              ? `Groundedness score: ${result.groundednessScore}/100`
              : 'Groundedness score: unavailable'
          pushExternalPanelMessage({
            role: 'assistant',
            content: `${scoreLine}\n\n${result.content}`,
            groundednessScore: result.groundednessScore ?? null,
          })
        } else {
          pushExternalPanelMessage({
            role: 'assistant',
            content: result.content || 'No suggestion returned.',
          })
        }
      } catch (error: any) {
        pushExternalPanelMessage({
          role: 'assistant',
          content: `Error: ${error?.message || 'Failed to process selection action.'}`,
        })
      } finally {
        setIsSelectionActionLoading(false)
      }
    },
    [
      pendingDroppedReference,
      writerSelection,
      handleDismissSelectionActionMenu,
      content,
      activeRefs,
      supabase,
      docId,
      folderId,
      accountId,
      writeLocalDraft,
      persistWriterSpanProvenance,
      pushExternalPanelMessage,
    ]
  )

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
    if (docId) {
      writeLocalDraft(docId, next)
    }
    setContent(next)
  }, [docId, writeLocalDraft])

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
          <div className="relative h-full">
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
              onSelectionChange={setWriterSelection}
              activeSelection={writerSelection}
              hasActiveSelection={Boolean(writerSelection?.text?.trim())}
              onDropReferenceOnSelection={handleDropReferenceOnSelection}
            />
            <WriterReferenceActionMenu
              position={selectionActionMenuPosition}
              onSelectAction={handleWriterSelectionAction}
              onDismiss={handleDismissSelectionActionMenu}
            />
          </div>
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
            externalEvent={externalPanelEvent}
            externalLoading={isSelectionActionLoading}
            onDropReference={handleReferenceDrop}
          />
        </div>
      </div>
    </div>
  )
}
