'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Writer from '../../../../components/writer/Writer'
import { getSupabaseClient } from '@/lib/supabaseClient'

export default function FolderWritePage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const folderId = params?.id
  const docId = searchParams.get('docId') || ''
  const initialName = useMemo(() => searchParams.get('name') || '', [searchParams])

  const [fileName, setFileName] = useState(initialName)
  const [content, setContent] = useState('')
  const supabase = getSupabaseClient()

  // Load existing content
  useEffect(() => {
    const load = async () => {
      if (!supabase || !docId) return
      const { data } = await supabase
        .from('document_assets')
        .select('content_json')
        .eq('doc_id', docId)
        .eq('kind', 'metadata_json')
        .maybeSingle()
      if (data?.content_json?.content) {
        setContent(data.content_json.content as string)
      }

      const doc = await supabase
        .from('documents')
        .select('title')
        .eq('id', docId)
        .maybeSingle()
      if (doc.data?.title) {
        setFileName(doc.data.title)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  // Save content (debounced)
  useEffect(() => {
    if (!supabase || !docId) return
    const timer = setTimeout(async () => {
      await supabase.from('document_assets').upsert({
        doc_id: docId,
        workspace_id: null,
        kind: 'metadata_json',
        bucket: 'documents',
        path: `docs/${docId}.json`,
        content_json: { content },
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [content, docId, supabase])

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
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

      <Writer fileName={fileName || 'Untitled'} content={content} onChangeContent={setContent} />
    </div>
  )
}

