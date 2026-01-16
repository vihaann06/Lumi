'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { DocRow } from '../useFolderData'

type Props = {
  folderId: string
  documents: DocRow[]
  isLoading: boolean
  onDelete?: (docId: string) => void
  deletingId?: string | null
  onRename?: (docId: string) => void
  renamingId?: string | null
}

export default function DocumentList({
  folderId,
  documents,
  isLoading,
  onDelete,
  deletingId,
  onRename,
  renamingId,
}: Props) {
  const router = useRouter()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const supabase = getSupabaseClient()
  const [thumbUrls, setThumbUrls] = useState<Record<string, string | null>>({})

  const docsWithThumbs = useMemo(
    () => documents.filter((d) => d.thumbnail_path),
    [documents]
  )

  useEffect(() => {
    let cancelled = false
    const loadThumbs = async () => {
      if (!supabase) return
      const entries = await Promise.all(
        docsWithThumbs.map(async (doc) => {
          const bucket = doc.thumbnail_bucket || 'documents'
          const path = doc.thumbnail_path!
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
          if (error || !data?.signedUrl) return [doc.id, null] as const
          return [doc.id, data.signedUrl] as const
        })
      )
      if (cancelled) return
      setThumbUrls((prev) => {
        const next = { ...prev }
        entries.forEach(([id, url]) => {
          next[id] = url
        })
        return next
      })
    }
    loadThumbs()
    return () => {
      cancelled = true
    }
  }, [docsWithThumbs, supabase])

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading...</p>
  }

  if (!documents.length) return null

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Files in this folder</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="relative rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition cursor-pointer"
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
          >
            {thumbUrls[doc.id] ? (
              <div className="mb-3 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrls[doc.id] as string}
                  alt={doc.title || 'Thumbnail'}
                  className="w-full aspect-[3/2] object-cover"
                />
              </div>
            ) : (
              <div className="mb-3 aspect-[3/2] rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                No preview
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900 truncate">{doc.title || 'Untitled'}</p>
              <p className="text-xs text-slate-500 capitalize">{doc.doc_type || 'file'}</p>
            </div>
            {(onDelete || onRename) && (
              <div className="absolute bottom-2 right-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    setOpenMenuId((prev) => (prev === doc.id ? null : doc.id))
                  }}
                  className="p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {openMenuId === doc.id && (
                  <div className="absolute bottom-10 right-0 w-36 rounded-lg border border-slate-200 bg-white shadow-lg z-10">
                    {onRename && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          onRename(doc.id)
                        }}
                        disabled={Boolean(renamingId && renamingId === doc.id)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {renamingId === doc.id ? 'Renaming…' : 'Rename'}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          const confirmed = window.confirm('Delete this file?')
                          if (!confirmed) return
                          onDelete(doc.id)
                        }}
                        disabled={Boolean(deletingId && deletingId === doc.id)}
                        className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

