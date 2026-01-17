'use client'

import { ChangeEvent, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useFolderData } from './useFolderData'
import FolderHeader from '../../../components/folders/FolderHeader'
import EmptyState from '../../../components/folders/EmptyState'
import DocumentList from '../../../components/folders/DocumentList'
import AddFab from '../../../components/folders/AddFab'
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

  return (
    <div className="min-h-screen bg-slate-50 relative">
      <FolderHeader title={folderName} />

      <div className="px-6 pb-6">
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
          <div className="flex-1">
            <DocumentList
              folderId={folderId}
              documents={documents}
              isLoading={isLoadingDocs}
              onDelete={handleDeleteDocument}
              deletingId={deletingId}
              onRename={handleRenameDocument}
              renamingId={renamingId}
              onSelectForRename={(docId, currentName) => {
                setRenameTargetId(docId)
                setRenameValue(currentName)
                setRenameModalOpen(true)
              }}
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
      </div>

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