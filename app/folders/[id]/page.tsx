'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Upload, FileEdit, ArrowLeft, Plus } from 'lucide-react'

export default function FolderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const folderId = params?.id

  const [writeContent, setWriteContent] = useState('')
  const [writeStatus, setWriteStatus] = useState<'idle' | 'saved'>('idle')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedAction, setSelectedAction] = useState<'write' | 'read' | null>(
    null
  )
  const [fileName, setFileName] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file && file.type === 'application/pdf') {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result
        if (!base64) return
        sessionStorage.setItem('pdfFile', base64 as string)
        const effectiveName = fileName.trim() || file.name
        sessionStorage.setItem('pdfFileName', effectiveName)

        const fileUrl = URL.createObjectURL(file)
        router.push(
          `/reader?folderId=${encodeURIComponent(
            folderId
          )}&fileUrl=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(
            effectiveName
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

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <Plus className="h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600">No files yet. Add your first file.</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 shadow-sm hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              Add file
            </button>
            {isAddOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 text-left overflow-hidden">
                <button
                  type="button"
                  className="w-full px-4 py-3 text-sm text-slate-800 hover:bg-indigo-50 flex items-center gap-2"
                  onClick={() => {
                    setSelectedAction('write')
                    setIsAddOpen(false)
                    setWriteStatus('idle')
                    setFileName('')
                  }}
                >
                  <FileEdit className="h-4 w-4 text-indigo-500" />
                  Start writing
                </button>
                <label className="w-full px-4 py-3 text-sm text-slate-800 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer">
                  <Upload className="h-4 w-4 text-indigo-500" />
                  Upload to read
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      setSelectedAction('read')
                      setIsAddOpen(false)
                      handleFileUpload(event)
                    }}
                    onClick={(e) => {
                      // allow re-uploading same file
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-ignore
                      e.target.value = null
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAction === 'write' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileEdit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Write</p>
              <p className="text-xs text-slate-500">
                Name your document and start writing (AI assistance coming soon)
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Document name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => {
                if (!fileName.trim()) return
                router.push(
                  `/folders/${encodeURIComponent(folderId)}/write?name=${encodeURIComponent(
                    fileName.trim()
                  )}`
                )
              }}
              disabled={!fileName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 shadow-sm hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Start writing
            </button>
          </div>
        </div>
      )}

      {selectedAction === 'read' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Read</p>
              <p className="text-xs text-slate-500">Name the file, then upload to open the reader</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="File name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
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
                disabled={!fileName.trim()}
              />
            </label>
            {!fileName.trim() && (
              <p className="text-xs text-amber-600">Enter a name before uploading.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

