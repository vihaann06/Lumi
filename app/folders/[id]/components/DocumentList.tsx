'use client'

import { useRouter } from 'next/navigation'
import { DocRow } from '../useFolderData'

type Props = {
  folderId: string
  documents: DocRow[]
  isLoading: boolean
}

export default function DocumentList({ folderId, documents, isLoading }: Props) {
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
          </div>
        ))}
      </div>
    </div>
  )
}

