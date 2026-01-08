'use client'

import React from 'react'
import { Bold, Italic, Underline } from 'lucide-react'

type WriterProps = {
  fileName: string
  content: string
  onChangeContent: (val: string) => void
}

export default function Writer({ fileName, content, onChangeContent }: WriterProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{fileName || 'Untitled'}</p>
          <p className="text-xs text-slate-500">Draft · Not yet synced</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <button className="p-2 hover:text-slate-700 hover:bg-slate-100 rounded-md">
            <Bold className="h-4 w-4" />
          </button>
          <button className="p-2 hover:text-slate-700 hover:bg-slate-100 rounded-md">
            <Italic className="h-4 w-4" />
          </button>
          <button className="p-2 hover:text-slate-700 hover:bg-slate-100 rounded-md">
            <Underline className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <input
          type="text"
          value={fileName}
          readOnly
          className="w-full bg-transparent text-lg font-semibold text-slate-900 focus:outline-none cursor-default"
        />
      </div>
      <div className="p-4">
        <textarea
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
          placeholder="Start writing..."
          className="w-full min-h-[400px] rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
    </div>
  )
}

