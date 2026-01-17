'use client'

import { useState } from 'react'
import { FileEdit, Upload, Plus } from 'lucide-react'

type Props = {
  disabled?: boolean
  onSelectWrite: () => void
  onSelectRead: () => void
}

export default function AddFab({ disabled, onSelectWrite, onSelectRead }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300 hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Add file"
        >
          <Plus className="h-6 w-6" />
        </button>
        {open && (
          <div className="absolute bottom-16 right-0 w-64 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 text-left overflow-hidden">
            <button
              type="button"
              className="w-full px-4 py-3 text-sm text-slate-800 hover:bg-indigo-50 flex items-center gap-2"
              onClick={() => {
                onSelectWrite()
                setOpen(false)
              }}
            >
              <FileEdit className="h-4 w-4 text-indigo-500" />
              Start writing
            </button>
            <button
              type="button"
              className="w-full px-4 py-3 text-sm text-slate-800 hover:bg-indigo-50 flex items-center gap-2"
              onClick={() => {
                onSelectRead()
                setOpen(false)
              }}
            >
              <Upload className="h-4 w-4 text-indigo-500" />
              Upload to read
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

