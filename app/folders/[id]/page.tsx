'use client'

import { ChangeEvent, useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, FileText, Upload, Pencil, Trash2, BookmarkCheck } from 'lucide-react'
import { useFolderData } from './useFolderData'
import EmptyState from '../../../components/folders/EmptyState'
import NameModal from '../../../components/folders/NameModal'
import ReadModal from '../../../components/folders/ReadModal'
import RenameModal from '../../../components/folders/RenameModal'
import { generateThumbnail } from '../../../lib/utils/thumbnails'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import { useReferences } from '@/hooks/useReferences'
import { attachReferenceToFile } from '@/lib/db/queries/fileReferences'
import { getReferenceById } from '@/lib/db/queries/references'
import { getCurrentUserId } from '@/lib/db/queries/auth'
import ReferenceTray from '../../../components/references/ReferenceTray'

export default function FolderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const folderId = params?.id ?? ''
  const supabase = getSupabaseClient()

  const {
    folderName,
    documents,
    isLoadingDocs,
    insertPdfDocument,
    insertWriterDocument,
    deleteDocument,
    renameDocument,
  } = useFolderData(folderId)

  const {
    references,
    isLoading: refsLoading,
    removeReference,
    refresh: refreshReferences,
  } = useReferences(folderId || null)

  // UI state
  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  const [isReadModalOpen, setIsReadModalOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)

  // IDE layout
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [activeSrc, setActiveSrc] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const minSidebar = 220
  const maxSidebar = 480
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const pendingIframeMessageRef = useRef<any | null>(null)

  // Drag-and-drop reference attachment
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [attachFeedback, setAttachFeedback] = useState<string | null>(null)
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null)

  // Build iframe src
  const buildDocSrc = (docId: string, title: string, docType: string) => {
    const safeTitle = encodeURIComponent(title || 'Untitled')
    if (docType === 'pdf') {
      return `/folders/${encodeURIComponent(folderId)}/reader?docId=${encodeURIComponent(docId)}&fileName=${safeTitle}&hideHeader=1`
    }
    return `/folders/${encodeURIComponent(folderId)}/writer?docId=${encodeURIComponent(docId)}&name=${safeTitle}&hideHeader=1`
  }

  const handleSelectDoc = (docId: string) => {
    const doc = documents.find((d) => d.id === docId)
    if (!doc) return
    setActiveDocId(docId)
    setActiveSrc(buildDocSrc(doc.id, doc.title || '', doc.doc_type || 'file'))
  }

  const postMessageToIframe = useCallback((message: any) => {
    const win = iframeRef.current?.contentWindow
    if (win) {
      win.postMessage(message, '*')
      return true
    }
    return false
  }, [])

  const handleGoToReference = (reference: any) => {
    if (!reference) return
    setSelectedReferenceId(reference.id)

    const sourceDoc = documents.find((d) => d.id === reference.sourceDocId)
    if (sourceDoc && sourceDoc.doc_type === 'pdf') {
      const message = {
        type: 'reference:navigate',
        referenceId: reference.id,
        pageNumber: reference.pageNumber,
        selectedText: reference.selectedText,
      }
      if (activeDocId === sourceDoc.id) {
        const delivered = postMessageToIframe(message)
        if (!delivered) pendingIframeMessageRef.current = message
      } else {
        pendingIframeMessageRef.current = message
        handleSelectDoc(sourceDoc.id)
      }
      return
    }

    postMessageToIframe({ type: 'reference:navigate', referenceId: reference.id })
  }

  const handleAddReference = (reference: any) => {
    if (!reference) return
    setSelectedReferenceId(reference.id)
    postMessageToIframe({ type: 'reference:add-to-chat', reference })
  }

  // Auto-select first doc
  useEffect(() => {
    if (documents.length && !activeDocId) {
      handleSelectDoc(documents[0].id)
    } else if (!documents.length) {
      setActiveDocId(null)
      setActiveSrc(null)
    }
  }, [documents, activeDocId])

  // Refresh references when child iframes report new ones
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'reference:created') {
        refreshReferences()
        return
      }
      if (event.data?.type === 'reference:go-to-source' && event.data.referenceId) {
        const targetId = String(event.data.referenceId)
        const ref = references.find((r) => r.id === targetId)
        if (ref) {
          handleGoToReference(ref)
        } else {
          if (supabase) {
            void getReferenceById(supabase, targetId).then((found) => {
              if (found) {
                handleGoToReference(found)
                return
              }
              refreshReferences()
            })
          } else {
            refreshReferences()
          }
        }
        return
      }
      if (event.data?.type === 'synthesis:navigate' && event.data.synthesisDocId) {
        const synthesisDocId = String(event.data.synthesisDocId)
        const referenceId = event.data.referenceId ? String(event.data.referenceId) : null
        const msg = referenceId
          ? { type: 'synthesis:focus-reference', referenceId }
          : null
        if (activeDocId === synthesisDocId) {
          if (msg) {
            const delivered = postMessageToIframe(msg)
            if (!delivered) pendingIframeMessageRef.current = msg
          }
        } else {
          pendingIframeMessageRef.current = msg
          handleSelectDoc(synthesisDocId)
        }
        return
      }
      if (event.data?.type === 'reference:focus' && event.data.referenceId) {
        const targetId = String(event.data.referenceId)
        setSelectedReferenceId(targetId)
        if (!references.find((ref) => ref.id === targetId)) {
          refreshReferences()
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [refreshReferences, references, activeDocId, postMessageToIframe, supabase])

  // --- File operations ---
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file || !folderId) return
    try {
      if (file.type !== 'application/pdf') {
        setUploadError('Only PDF is supported.')
        return
      }
      const thumbnail = await generateThumbnail(file)
      const effectiveName = fileName.trim() || file.name
      const inserted = await insertPdfDocument(effectiveName, file, thumbnail)
      if (!inserted?.docId) { setUploadError('Upload failed.'); return }
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result
        if (base64) {
          try { sessionStorage.setItem('pdfFile', base64 as string) } catch {}
          sessionStorage.setItem('pdfFileName', effectiveName)
        }
      }
      reader.readAsDataURL(file)
      setIsReadModalOpen(false)
      setFileName('')
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.')
    } finally {
      e.target.value = ''
    }
  }

  const handleStartWriting = async () => {
    const docId = await insertWriterDocument(fileName.trim())
    if (!docId) return
    setIsNameModalOpen(false)
    setFileName('')
  }

  const handleDeleteDocument = async (docId: string) => {
    setDeleteError(null)
    setDeletingId(docId)
    try {
      await deleteDocument(docId)
      if (docId === activeDocId) {
        const remaining = documents.filter((d) => d.id !== docId)
        if (remaining.length) handleSelectDoc(remaining[0].id)
        else { setActiveDocId(null); setActiveSrc(null) }
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleRenameDocument = async (docId: string, name?: string) => {
    setRenameError(null)
    const trimmed = (name ?? '').trim()
    if (!trimmed) { setRenameError('Name cannot be empty.'); return }
    try {
      await renameDocument(docId, trimmed)
      setRenameModalOpen(false)
      setRenameTargetId(null)
      setRenameValue('')
    } catch (err: any) {
      setRenameError(err?.message || 'Rename failed.')
    }
  }

  // --- Drag-and-drop: attach reference to file ---
  const handleFileDragOver = useCallback((e: React.DragEvent, docId: string) => {
    if (e.dataTransfer.types.includes('application/lumi-reference')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropTargetId(docId)
    }
  }, [])

  const handleFileDragLeave = useCallback(() => {
    setDropTargetId(null)
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent, docId: string) => {
    e.preventDefault()
    setDropTargetId(null)
    const raw = e.dataTransfer.getData('application/lumi-reference')
    if (!raw || !supabase) return
    try {
      const ref = JSON.parse(raw)
      const uid = await getCurrentUserId(supabase)
      if (!uid) return
      const ok = await attachReferenceToFile(supabase, uid, docId, ref.id)
      if (ok) {
        const doc = documents.find((d) => d.id === docId)
        setAttachFeedback(doc?.title || 'file')
        setTimeout(() => setAttachFeedback(null), 2000)
      }
      // Open the target file so its AI panel shows the reference
      handleSelectDoc(docId)
    } catch { /* ignore */ }
  }, [supabase, documents])

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-slate-800 truncate">{folderName || 'Folder'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingDocs && <span className="text-xs text-slate-400">Loading...</span>}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
            {isAddMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                <button type="button" className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { setIsAddMenuOpen(false); setFileName(''); setIsNameModalOpen(true) }}>
                  <FileText className="w-4 h-4 text-slate-400" /> Start writing
                </button>
                <button type="button" className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { setIsAddMenuOpen(false); setFileName(''); setIsReadModalOpen(true) }}>
                  <Upload className="w-4 h-4 text-slate-400" /> Upload PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error banners */}
      {(uploadError || deleteError || renameError) && (
        <div className="px-4 py-2 flex-shrink-0">
          {uploadError && <div className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{uploadError}</div>}
          {deleteError && <div className="mb-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800">{deleteError}</div>}
          {renameError && <div className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{renameError}</div>}
        </div>
      )}

      {/* Attach feedback toast */}
      {attachFeedback && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-2 rounded-lg shadow-md">
          <BookmarkCheck className="w-4 h-4" />
          Reference attached to {attachFeedback}
        </div>
      )}

      {/* Main content: IDE layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {documents.length === 0 && !isLoadingDocs ? (
          <EmptyState />
        ) : (
          <>
            {/* Left sidebar: file explorer */}
            <div
              className="border-r border-slate-200 bg-white flex flex-col overflow-hidden flex-shrink-0"
              style={{ width: sidebarWidth, minWidth: minSidebar, maxWidth: maxSidebar }}
            >
              <div className="flex-1 overflow-y-auto">
                {documents.map((doc) => {
                  const isActive = doc.id === activeDocId
                  const isDragTarget = doc.id === dropTargetId
                  return (
                    <div
                      key={doc.id}
                      className={`group px-3 py-2.5 flex items-center justify-between cursor-pointer border-l-[3px] transition-colors ${
                        isDragTarget
                          ? 'bg-indigo-100 border-indigo-500'
                          : isActive
                          ? 'bg-indigo-50/60 border-indigo-500'
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                      onClick={() => handleSelectDoc(doc.id)}
                      onDragOver={(e) => handleFileDragOver(e, doc.id)}
                      onDragLeave={handleFileDragLeave}
                      onDrop={(e) => handleFileDrop(e, doc.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{doc.title || 'Untitled'}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{doc.doc_type || 'file'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          type="button"
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenameTargetId(doc.id)
                            setRenameValue(doc.title || '')
                            setRenameModalOpen(true)
                          }}
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          disabled={deletingId === doc.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm('Delete this file?')) handleDeleteDocument(doc.id)
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resize divider */}
            <div
              className="w-1.5 cursor-col-resize bg-transparent hover:bg-slate-200 active:bg-slate-300 flex-shrink-0"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startW = sidebarWidth
                const onMove = (ev: MouseEvent) => {
                  setSidebarWidth(Math.min(Math.max(startW + ev.clientX - startX, minSidebar), maxSidebar))
                }
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />

            {/* Right viewer */}
            <div className="flex-1 min-w-0 overflow-hidden bg-white">
              {activeSrc ? (
                <iframe
                  ref={iframeRef}
                  key={activeSrc}
                  src={activeSrc}
                  onLoad={() => {
                    if (pendingIframeMessageRef.current) {
                      const msg = pendingIframeMessageRef.current
                      const delivered = postMessageToIframe(msg)
                      if (delivered) pendingIframeMessageRef.current = null
                    }
                  }}
                  className="w-full h-full"
                  title="Document viewer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  Select a file to view
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ReferenceTray
        references={references}
        isLoading={refsLoading}
        onRemove={removeReference}
        onGoToReference={handleGoToReference}
        onAddReference={handleAddReference}
        selectedReferenceId={selectedReferenceId}
      />

      {/* Modals */}
      {isReadModalOpen && (
        <ReadModal fileName={fileName} onChangeName={setFileName} onUpload={handleFileUpload}
          onClose={() => { setIsReadModalOpen(false); setFileName('') }} />
      )}
      {isNameModalOpen && (
        <NameModal fileName={fileName} onChangeName={setFileName} onConfirm={handleStartWriting}
          onClose={() => { setIsNameModalOpen(false); setFileName('') }} />
      )}
      <RenameModal fileName={renameValue} isOpen={renameModalOpen}
        onClose={() => { setRenameModalOpen(false); setRenameTargetId(null) }}
        onConfirm={(name) => { if (renameTargetId) handleRenameDocument(renameTargetId, name) }} />
    </div>
  )
}
