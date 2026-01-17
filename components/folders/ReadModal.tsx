'use client'

import { Upload } from 'lucide-react'
import { ChangeEvent } from 'react'

type Props = {
  fileName: string
  onChangeName: (v: string) => void
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
}

export default function ReadModal({ fileName, onChangeName, onUpload, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Read</p>
            <p className="text-xs text-slate-500">Name the file, then upload to open the reader</p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={fileName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="File name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            autoFocus
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
              onChange={onUpload}
              disabled={!fileName.trim()}
            />
          </label>

          {!fileName.trim() && (
            <p className="text-xs text-amber-600">Enter a name before uploading.</p>
          )}

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
          </div>
        </div>
      </div>
    </div>
  )
}

