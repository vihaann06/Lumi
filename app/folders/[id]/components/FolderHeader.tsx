'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Props = {
  title: string
}

export default function FolderHeader({ title }: Props) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={() => router.push('/')}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
    </div>
  )
}

