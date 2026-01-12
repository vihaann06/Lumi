'use client'

import { FolderOpen } from 'lucide-react'

type Props = {
  message?: string
}

export default function EmptyState({ message = 'No files yet. Add your first file.' }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center py-12 min-h-[70vh]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
          <FolderOpen className="h-10 w-10 text-slate-400" />
        </div>
        <p className="text-base text-slate-600">{message}</p>
      </div>
    </div>
  )
}

