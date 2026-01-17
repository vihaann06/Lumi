'use client'

import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Props = {
  title: string
}

export default function FolderHeader({ title }: Props) {
  const router = useRouter()
  return (
    <div className="mb-6 px-8 py-4 flex items-center gap-3 bg-white border-b border-slate-200">
      <button
        onClick={() => router.push('/')}
        className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
        aria-label="Go to home"
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
    </div>
  )
}

