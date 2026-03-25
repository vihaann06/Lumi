'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import {
  listFileReferences,
  attachReferenceToFile,
  detachReferenceFromFile,
} from '@/lib/db/queries/fileReferences'
import type { Reference } from '@/lib/types/references'

export function useFileReferences(fileId: string | null) {
  const supabase = getSupabaseClient()
  const [references, setReferences] = useState<Reference[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !fileId) return
    setIsLoading(true)
    const refs = await listFileReferences(supabase, fileId)
    setReferences(refs)
    setIsLoading(false)
  }, [supabase, fileId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Re-fetch on window focus (cross-iframe sync)
  useEffect(() => {
    const onFocus = () => { refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const attach = useCallback(
    async (accountId: string, referenceId: string): Promise<boolean> => {
      if (!supabase || !fileId) return false
      const ok = await attachReferenceToFile(supabase, accountId, fileId, referenceId)
      if (ok) await refresh()
      return ok
    },
    [supabase, fileId, refresh]
  )

  const detach = useCallback(
    async (referenceId: string): Promise<boolean> => {
      if (!supabase || !fileId) return false
      const ok = await detachReferenceFromFile(supabase, fileId, referenceId)
      if (ok) {
        setReferences((prev) => prev.filter((r) => r.id !== referenceId))
      }
      return ok
    },
    [supabase, fileId]
  )

  return { references, isLoading, attach, detach, refresh }
}
