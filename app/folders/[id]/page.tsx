'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Upload, FileEdit, ArrowLeft } from 'lucide-react'

export default function FolderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const folderId = params?.id

  const [writeContent, setWriteContent] = useState('')
  const [writeStatus, setWriteStatus] = useState<'idle' | 'saved'>('idle')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file && file.type === 'application/pdf') {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result
        if (!base64) return
        sessionStorage.setItem('pdfFile', base64 as string)
        sessionStorage.setItem('pdfFileName', file.name)

        const fileUrl = URL.createObjectURL(file)
        router.push(
          `/reader?folderId=${encodeURIComponent(
            folderId
          )}&fileUrl=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(
            file.name
          )}`
        )
      }
      reader.readAsDataURL(file)
    }
  }

  useEffect(() => {
    setWriteStatus('idle')
  }, [writeContent])

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-semibold text-slate-900">Folder</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Write section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileEdit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Write</p>
              <p className="text-xs text-slate-500">
                Create a simple document (AI assistance coming soon)
              </p>
            </div>
          </div>
          <textarea
            value={writeContent}
            onChange={(e) => setWriteContent(e.target.value)}
            placeholder="Start writing..."
            className="w-full h-48 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="mt-3 text-xs text-slate-500">
            {writeContent.length} characters
          </div>
          <button
            type="button"
            onClick={() => setWriteStatus('saved')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 shadow-sm hover:bg-indigo-700 transition"
          >
            Save draft
          </button>
          {writeStatus === 'saved' && (
            <p className="mt-2 text-xs text-emerald-600">
              Draft saved locally (persistence coming soon).
            </p>
          )}
        </div>

        {/* Read section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Read</p>
              <p className="text-xs text-slate-500">Upload a PDF and open the reader</p>
            </div>
          </div>
          <label className="group flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50 transition">
            <div className="flex flex-col items-center gap-2 text-slate-500 text-sm">
              <Upload className="h-5 w-5" />
              <span>Click to upload PDF</span>
              <span className="text-xs text-slate-400">We’ll open it in the reader</span>
            </div>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    </div>
  )
}

