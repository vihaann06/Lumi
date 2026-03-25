'use client'

import { Suspense } from 'react'
import ReaderScreen from '../../../../components/reader/ReaderScreen'

export default function FolderReaderPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-50" />}>
      <ReaderScreen />
    </Suspense>
  )
}

