'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, FileText, Upload, MoreHorizontal, BookmarkCheck, X, Pencil, Trash2 } from 'lucide-react'
import { useFolderData } from './useFolderData'
import EmptyState from '../../../components/folders/EmptyState'
import NameModal from '../../../components/folders/NameModal'
import ReadModal from '../../../components/folders/ReadModal'
import RenameModal from '../../../components/folders/RenameModal'
import { generateThumbnail } from '../../../lib/utils/thumbnails'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import { useReferences } from '@/hooks/useReferences'
import type { Reference } from '@/lib/types/references'

export default function FolderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const folderId = params?.id ?? ''
  const supabase = getSupabaseClient()

  // --- data ---
  const {
    folderName,
    documents,
    isLoadingDocs,
    insertPdfDocument,
    insertWriterDocument,
    deleteDocument,
    renameDocument,
  } = useFolderData(folderId)

  const { references, removeReference } = useReferences(folderId || null)

  // --- UI state ---
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
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [refBubbleOpen, setRefBubbleOpen] = useState(false)

  // active doc = file is open (replaces grid with viewer)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [activeSrc, setActiveSrc] = useState<string | null>(null)

  // --- thumbnail URLs ---
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!supabase || !documents.length) return
    const load = async () => {
      const urls: Record<string, string> = {}
      for (const doc of documents) {
        if (doc.thumbnail_path && doc.thumbnail_bucket) {
          const { data, error } = await supabase.storage
            .from(doc.thumbnail_bucket)
            .createSignedUrl(doc.thumbnail_path, 3600)
          if (!error && data?.signedUrl) urls[doc.id] = data.signedUrl
        }
      }
      setThumbUrls(urls)
    }
    load()
  }, [documents, supabase])

  // --- handlers ---
  const buildDocSrc = (docId: string, title: string, docType: string) => {
    const safeTitle = encodeURIComponent(title || 'Untitled')
    if (docType === 'pdf') {
      return `/folders/${encodeURIComponent(folderId)}/reader?docId=${encodeURIComponent(docId)}&fileName=${safeTitle}&hideHeader=1`
    }
    return `/folders/${encodeURIComponent(folderId)}/writer?docId=${encodeURIComponent(docId)}&name=${safeTitle}&hideHeader=1`
  }

  const handleOpenDoc = (docId: string) => {
    const doc = documents.find((d) => d.id === docId)
    if (!doc) return
    setActiveDocId(docId)
    setActiveSrc(buildDocSrc(doc.id, doc.title || '', doc.doc_type || 'file'))
  }

  const handleBackToGrid = () => {
    setActiveDocId(null)
    setActiveSrc(null)
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file || !folderId) return
    try {
      if (file.type !== 'application/pdf') {
        setUploadError('Only PDF is supported for read uploads right now.')
        return
      }
      const thumbnail = await generateThumbnail(file)
      const effectiveName = fileName.trim() || file.name
      const inserted = await insertPdfDocument(effectiveName, file, thumbnail)
      if (!inserted?.docId) {
        setUploadError('Upload failed. Please try again.')
        return
      }
      // cache for reader
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
      setUploadError(err?.message || 'Upload failed. Please try again.')
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
      if (docId === activeDocId) handleBackToGrid()
    } catch (err: any) {
      setDeleteError(err?.message || 'Delete failed.')
    } finally {
      setDeletingId(null)
      setContextMenuId(null)
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

  // close context menu on outside click
  useEffect(() => {
    if (!contextMenuId) return
    const handler = () => setContextMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [contextMenuId])

  // --- active doc title ---
  const activeDoc = activeDocId ? documents.find((d) => d.id === activeDocId) : null

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={activeDocId ? handleBackToGrid : () => router.push('/')}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition flex-shrink-0"
            aria-label={activeDocId ? 'Back to folder' : 'Back to home'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {activeDoc ? activeDoc.title || 'Untitled' : folderName || 'Folder'}
            </p>
            {activeDoc && (
              <p className="text-[11px] text-slate-400 truncate">{folderName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingDocs && <span className="text-xs text-slate-400">Loading...</span>}
          {!activeDocId && (
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
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setIsAddMenuOpen(false); setFileName(''); setIsNameModalOpen(true) }}
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    Start writing
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setIsAddMenuOpen(false); setFileName(''); setIsReadModalOpen(true) }}
                  >
                    <Upload className="w-4 h-4 text-slate-400" />
                    Upload PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error banners */}
      {(uploadError || deleteError || renameError) && (
        <div className="px-5 py-2 flex-shrink-0">
          {uploadError && <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{uploadError}</div>}
          {deleteError && <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{deleteError}</div>}
          {renameError && <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{renameError}</div>}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {documents.length === 0 && !isLoadingDocs ? (
          <EmptyState />
        ) : activeDocId && activeSrc ? (
          /* === File viewer === */
          <iframe
            key={activeSrc}
            src={activeSrc}
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            title="Document viewer"
          />
        ) : (
          /* === Grid view === */
          <div className="h-full overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-3 gap-5 max-w-5xl mx-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                  onClick={() => handleOpenDoc(doc.id)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
                    {thumbUrls[doc.id] ? (
                      <img
                        src={thumbUrls[doc.id]}
                        alt={doc.title || 'Document'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.title || 'Untitled'}</p>
                      <p className="text-[11px] text-slate-400 uppercase">{doc.doc_type || 'file'}</p>
                    </div>
                    {/* Context menu trigger */}
                    <button
                      type="button"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        setContextMenuId(contextMenuId === doc.id ? null : doc.id)
                      }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Context menu */}
                  {contextMenuId === doc.id && (
                    <div
                      className="absolute right-2 bottom-12 w-36 rounded-lg border border-slate-200 bg-white shadow-lg z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setRenameTargetId(doc.id)
                          setRenameValue(doc.title || '')
                          setRenameModalOpen(true)
                          setContextMenuId(null)
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        Rename
                      </button>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                        disabled={deletingId === doc.id}
                        onClick={() => {
                          if (window.confirm('Delete this file?')) handleDeleteDocument(doc.id)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === doc.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reference bubble — show on grid view only; inside a file the iframe has its own */}
      {!activeDocId && (
      <div className="absolute bottom-5 left-5 z-40">
        {refBubbleOpen && (
          <div className="absolute bottom-14 left-0 w-80 max-h-96 bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">References</span>
              <span className="text-xs text-slate-400">{references.length} collected</span>
            </div>
            {references.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                Select text in a PDF and click &ldquo;Reference&rdquo; to collect evidence.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {references.map((ref, idx) => (
                  <div key={ref.id} className="group px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs min-w-0">
                        <span className="font-semibold text-indigo-500 flex-shrink-0">R{idx + 1}</span>
                        <span className="font-medium text-slate-600 truncate">{ref.sourceDocTitle || 'Untitled'}</span>
                        {ref.pageNumber && <span className="text-slate-400 flex-shrink-0">p.{ref.pageNumber}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReference(ref.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity flex-shrink-0"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                      &ldquo;{ref.selectedText}&rdquo;
                    </p>
                  </div>
                ))}
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
      )}

      {/* Modals */}
      {isReadModalOpen && (
        <ReadModal
          fileName={fileName}
          onChangeName={setFileName}
          onUpload={handleFileUpload}
          onClose={() => { setIsReadModalOpen(false); setFileName('') }}
        />
      )}
      {isNameModalOpen && (
        <NameModal
          fileName={fileName}
          onChangeName={setFileName}
          onConfirm={handleStartWriting}
          onClose={() => { setIsNameModalOpen(false); setFileName('') }}
        />
      )}
      <RenameModal
        fileName={renameValue}
        isOpen={renameModalOpen}
        onClose={() => { setRenameModalOpen(false); setRenameTargetId(null) }}
        onConfirm={(name) => { if (renameTargetId) handleRenameDocument(renameTargetId, name) }}
      />
    </div>
  )
}
