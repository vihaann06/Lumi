'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useFolderData } from './useFolderData'
// Header removed for edge-to-edge layout
import EmptyState from '../../../components/folders/EmptyState'
import NameModal from '../../../components/folders/NameModal'
import ReadModal from '../../../components/folders/ReadModal'
import { generateThumbnail } from '../../../lib/utils/thumbnails'
import RenameModal from '../../../components/folders/RenameModal'
export default function FolderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const folderId = params?.id ?? ''

  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  const [isReadModalOpen, setIsReadModalOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [activeSrc, setActiveSrc] = useState<string | null>(null)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(340)
  const minSidebar = 240
  const maxSidebar = 640

  const {
    folderName,
    documents,
    isLoadingDocs,
    isMetaReady,
    insertPdfDocument,
    insertWriterDocument,
    deleteDocument,
    renameDocument,
  } = useFolderData(folderId)

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

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result
        if (base64) {
          try {
            // Persist only if small enough; large PDFs can exceed sessionStorage quota.
            sessionStorage.setItem('pdfFile', base64 as string)
          } catch (storageErr) {
            console.warn('Skipping sessionStorage cache for PDF (likely too large):', storageErr)
          }
          sessionStorage.setItem('pdfFileName', effectiveName)
        }

        const fileUrl = URL.createObjectURL(file)
        router.push(
          `/folders/${encodeURIComponent(
            folderId
          )}/reader?docId=${encodeURIComponent(inserted.docId)}&fileUrl=${encodeURIComponent(
            fileUrl
          )}&fileName=${encodeURIComponent(effectiveName)}`
        )
      }
      reader.readAsDataURL(file)
    } catch (err: any) {
      const message = err?.message || 'Upload failed. Please try again.'
      setUploadError(message)
      console.error('PDF upload error:', err)
    } finally {
      e.target.value = ''
    }
  }

  const handleStartWriting = async () => {
    const docId = await insertWriterDocument(fileName.trim())
    if (!docId) return
    setIsNameModalOpen(false)
    router.push(
      `/folders/${encodeURIComponent(folderId)}/writer?docId=${encodeURIComponent(
        docId
      )}&name=${encodeURIComponent(fileName.trim())}`
    )
  }

  const handleDeleteDocument = async (docId: string) => {
    setDeleteError(null)
    setDeletingId(docId)
    try {
      await deleteDocument(docId)
      if (docId === activeDocId) {
        const remaining = documents.filter((d) => d.id !== docId)
        if (remaining.length) {
          handleSelectDoc(remaining[0].id)
        } else {
          setActiveDocId(null)
          setActiveSrc(null)
        }
      }
    } catch (err: any) {
      const message = err?.message || 'Delete failed. Please try again.'
      setDeleteError(message)
      console.error('Delete document error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleRenameDocument = async (docId: string, name?: string) => {
    setRenameError(null)
    const trimmed = (name ?? '').trim()
    if (!trimmed) {
      setRenameError('Name cannot be empty.')
      return
    }
    setRenamingId(docId)
    try {
      await renameDocument(docId, trimmed)
      setRenameModalOpen(false)
      setRenameTargetId(null)
      setRenameValue('')
    } catch (err: any) {
      const message = err?.message || 'Rename failed. Please try again.'
      setRenameError(message)
      console.error('Rename document error:', err)
    } finally {
      setRenamingId(null)
    }
  }

  const buildDocSrc = (docId: string, title: string, docType: string) => {
    const safeTitle = encodeURIComponent(title || 'Untitled')
    if (docType === 'pdf') {
      return `/folders/${encodeURIComponent(folderId)}/reader?docId=${encodeURIComponent(
        docId
      )}&fileName=${safeTitle}&hideHeader=1`
    }
    return `/folders/${encodeURIComponent(folderId)}/writer?docId=${encodeURIComponent(
      docId
    )}&name=${safeTitle}&hideHeader=1`
  }

  const handleSelectDoc = (docId: string) => {
    const doc = documents.find((d) => d.id === docId)
    if (!doc) return
    setActiveDocId(docId)
    setActiveSrc(buildDocSrc(doc.id, doc.title || '', doc.doc_type || 'file'))
  }

  useEffect(() => {
    if (documents.length && !activeDocId) {
      handleSelectDoc(documents[0].id)
    } else if (!documents.length) {
      setActiveDocId(null)
      setActiveSrc(null)
    }
  }, [documents, activeDocId])

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {uploadError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {uploadError}
          </div>
        )}
        {deleteError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {deleteError}
          </div>
        )}
        {renameError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {renameError}
          </div>
        )}

        {documents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex-1 min-h-0 flex gap-0 select-none">
            {/* Sidebar list */}
            <div
              className="border-r border-slate-200 bg-white overflow-hidden flex flex-col"
              style={{ width: sidebarWidth, minWidth: minSidebar, maxWidth: maxSidebar }}
            >
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between relative">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition flex-shrink-0"
                    aria-label="Back to home"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold text-slate-800 truncate">{folderName || 'Folder'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {isLoadingDocs && <p className="text-xs text-slate-400">Loading…</p>}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAddMenuOpen((prev) => !prev)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition"
                      title="Add file"
                    >
                      +
                    </button>
                    {isAddMenuOpen && (
                      <div className="absolute right-0 mt-2 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setIsAddMenuOpen(false)
                            setFileName('')
                            setIsNameModalOpen(true)
                          }}
                        >
                          Start writing
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setIsAddMenuOpen(false)
                            setFileName('')
                            setIsReadModalOpen(true)
                          }}
                        >
                          Upload PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {documents.map((doc) => {
                  const isActive = doc.id === activeDocId
                  return (
                    <div
                      key={doc.id}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-indigo-50/50 ${
                        isActive ? 'bg-indigo-50/70 border-l-4 border-indigo-500' : ''
                      }`}
                      onClick={() => handleSelectDoc(doc.id)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.title || 'Untitled'}</p>
                        <p className="text-[11px] text-slate-500">{doc.doc_type || 'file'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-slate-500 hover:text-indigo-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenameTargetId(doc.id)
                            setRenameValue(doc.title || '')
                            setRenameModalOpen(true)
                          }}
                          disabled={renamingId === doc.id}
                        >
                          {renamingId === doc.id ? 'Renaming…' : 'Rename'}
                        </button>
                        <button
                          className="text-xs text-rose-600 hover:text-rose-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            const confirmed = window.confirm('Delete this file?')
                            if (confirmed) handleDeleteDocument(doc.id)
                          }}
                          disabled={deletingId === doc.id}
                        >
                          {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Divider for resize */}
            <div
              className="w-1.5 cursor-col-resize bg-transparent hover:bg-slate-200 active:bg-slate-300"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startWidth = sidebarWidth
                const onMove = (ev: MouseEvent) => {
                  const delta = ev.clientX - startX
                  const next = Math.min(Math.max(startWidth + delta, minSidebar), maxSidebar)
                  setSidebarWidth(next)
                }
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />

            {/* Viewer pane */}
            <div className="flex-1 bg-white overflow-hidden min-h-[500px]">
              {activeSrc ? (
                <iframe
                  key={activeSrc}
                  src={activeSrc}
                  className="w-full h-full min-h-[500px]"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                  title="Document viewer"
                />
              ) : (
                <div className="w-full h-full min-h-[500px] flex items-center justify-center text-slate-500">
                  Select a file to view
                </div>
              )}
            </div>
          </div>
        )}

        {isReadModalOpen && (
          <ReadModal
            fileName={fileName}
            onChangeName={setFileName}
            onUpload={handleFileUpload}
            onClose={() => {
              setIsReadModalOpen(false)
              setFileName('')
            }}
          />
        )}

        {isNameModalOpen && (
          <NameModal
            fileName={fileName}
            onChangeName={setFileName}
            onConfirm={handleStartWriting}
            onClose={() => {
              setIsNameModalOpen(false)
              setFileName('')
            }}
          />
        )}
      </div>

      <RenameModal
        fileName={renameValue}
        isOpen={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false)
          setRenameTargetId(null)
        }}
        onConfirm={(name) => {
          if (!renameTargetId) return
          handleRenameDocument(renameTargetId, name)
        }}
      />
    </div>
  )
}