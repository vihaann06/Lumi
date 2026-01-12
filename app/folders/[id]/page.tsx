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

  const {
    folderName,
    documents,
    isLoadingDocs,
    isMetaReady,
    insertPdfDocument,
    insertWriterDocument,
  } = useFolderData(folderId)

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !folderId) return
    try {
      if (file.type !== 'application/pdf') {
        console.error('Only PDF is supported for read uploads right now.')
        return
      }
      const effectiveName = fileName.trim() || file.name
      const inserted = await insertPdfDocument(effectiveName, file)
      if (!inserted?.docId) {
        console.error('Insert PDF document failed')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result
        if (!base64) return

        sessionStorage.setItem('pdfFile', base64 as string)
        sessionStorage.setItem('pdfFileName', effectiveName)

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

  return (
    <div className="min-h-screen bg-slate-50 p-6 relative">
      <FolderHeader title={folderName} />

      {documents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1">
          <DocumentList folderId={folderId} documents={documents} isLoading={isLoadingDocs} />
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