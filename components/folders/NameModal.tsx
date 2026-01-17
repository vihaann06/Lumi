'use client'

import { FileEdit } from 'lucide-react'

type Props = {
  fileName: string
  onChangeName: (v: string) => void
  onConfirm: () => void
  onClose: () => void
}

export default function NameModal({ fileName, onChangeName, onConfirm, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileEdit className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Name your document</p>
            <p className="text-xs text-slate-500">We’ll open the editor next</p>
          </div>
        </div>
        <div className="space-y-4">
          <input
            type="text"
            value={fileName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Document name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onClose()
              }}
              className="text-sm text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!fileName.trim()}
              onClick={() => {
                if (!fileName.trim()) return
                onConfirm()
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 shadow-sm hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Start writing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

