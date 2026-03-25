'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import {
  listFolderReferences,
  createReference,
  deleteReference,
} from '@/lib/db/queries/references'
import type { Reference, ReferenceInsert } from '@/lib/types/references'

export function useReferences(folderId: string | null) {
  const supabase = getSupabaseClient()
  const [references, setReferences] = useState<Reference[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !folderId) return
    setIsLoading(true)
    const refs = await listFolderReferences(supabase, folderId)
    setReferences(refs)
    setIsLoading(false)
  }, [supabase, folderId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addReference = useCallback(
    async (accountId: string, input: ReferenceInsert): Promise<Reference | null> => {
      if (!supabase) return null
      const ref = await createReference(supabase, accountId, input)
      if (ref) {
        setReferences((prev) => [...prev, ref])
      }
      return ref
    },
    [supabase]
  )

  const removeReference = useCallback(
    async (referenceId: string): Promise<boolean> => {
      if (!supabase) return false
      const ok = await deleteReference(supabase, referenceId)
      if (ok) {
        setReferences((prev) => prev.filter((r) => r.id !== referenceId))
      }
      return ok
    },
    [supabase]
  )

  return { references, isLoading, addReference, removeReference, refresh }
}
