'use client'

import { ChangeEvent, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useFolderData } from './useFolderData'
import FolderHeader from './components/FolderHeader'
import EmptyState from './components/EmptyState'
import DocumentList from './components/DocumentList'
import AddFab from './components/AddFab'
import NameModal from './components/NameModal'
import ReadModal from './components/ReadModal'

export default function FolderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const folderId = params?.id ?? ''

  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  const [isReadModalOpen, setIsReadModalOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    folderName,
    documents,
    isLoadingDocs,
    isMetaReady,
    insertPdfDocument,
    insertWriterDocument,
    deleteDocument,
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
      const effectiveName = fileName.trim() || file.name
      const inserted = await insertPdfDocument(effectiveName, file)
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
      `/folders/${encodeURIComponent(folderId)}/write?docId=${encodeURIComponent(
        docId
      )}&name=${encodeURIComponent(fileName.trim())}`
    )
  }

  const handleDeleteDocument = async (docId: string) => {
    setDeleteError(null)
    setDeletingId(docId)
    try {
      await deleteDocument(docId)
    } catch (err: any) {
      const message = err?.message || 'Delete failed. Please try again.'
      setDeleteError(message)
      console.error('Delete document error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 relative">
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
      <FolderHeader title={folderName} />

      {documents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1">
          <DocumentList
            folderId={folderId}
            documents={documents}
            isLoading={isLoadingDocs}
            onDelete={handleDeleteDocument}
            deletingId={deletingId}
          />
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

      <AddFab
        disabled={!isMetaReady}
        onSelectWrite={() => {
          setFileName('')
          setIsNameModalOpen(true)
        }}
        onSelectRead={() => {
          setFileName('')
          setIsReadModalOpen(true)
        }}
      />
    </div>
  )
}