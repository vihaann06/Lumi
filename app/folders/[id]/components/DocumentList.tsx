'use client'

import { useRouter } from 'next/navigation'
import { DocRow } from '../useFolderData'

type Props = {
  folderId: string
  documents: DocRow[]
  isLoading: boolean
  onDelete?: (docId: string) => void
  deletingId?: string | null
}

export default function DocumentList({
  folderId,
  documents,
  isLoading,
  onDelete,
  deletingId,
}: Props) {
  const router = useRouter()

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading...</p>
  }

  if (!documents.length) return null

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Files in this folder</h3>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{doc.title || 'Untitled'}</p>
              <p className="text-xs text-slate-500">{doc.doc_type || 'file'}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (doc.doc_type === 'pdf') {
                    router.push(
                      `/folders/${encodeURIComponent(
                        folderId
                      )}/reader?docId=${encodeURIComponent(doc.id)}&fileName=${encodeURIComponent(
                        doc.title || 'Untitled'
                      )}`
                    )
                  } else {
                    router.push(
                      `/folders/${encodeURIComponent(
                        folderId
                      )}/write?docId=${encodeURIComponent(doc.id)}&name=${encodeURIComponent(
                        doc.title || 'Untitled'
                      )}`
                    )
                  }
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                Open
              </button>
              {onDelete && (
                <button
                  onClick={() => {
                    const confirmed = window.confirm('Delete this file?')
                    if (!confirmed) return
                    onDelete(doc.id)
                  }}
                  disabled={Boolean(deletingId && deletingId === doc.id)}
                  className="text-sm text-rose-600 hover:text-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

