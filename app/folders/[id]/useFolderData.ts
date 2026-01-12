'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { getCurrentUserId } from '@/lib/services/auth'
import { ensureWorkspaceForUser } from '@/lib/services/workspaces'
import { getFolderMeta, listFolderDocuments } from '@/lib/services/folders'
import { createDocument } from '@/lib/services/documents'

export type DocRow = {
  id: string
  title: string | null
  doc_type: string | null
  updated_at: string | null
}

export function useFolderData(folderId: string | null) {
  const supabase = getSupabaseClient()

  const [folderName, setFolderName] = useState('Folder')
  const [folderMeta, setFolderMeta] = useState<{
    account_id: string | null
    workspace_id: string | null
  } | null>(null)
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isMetaReady, setIsMetaReady] = useState(false)

  const fetchFolderMeta = useCallback(async () => {
    if (!supabase || !folderId) return
    const data = await getFolderMeta(supabase, folderId)
    if (data) {
      if ((data as any).name) setFolderName((data as any).name)
      setFolderMeta({
        account_id: (data as any).account_id ?? null,
        workspace_id: (data as any).workspace_id ?? null,
      })
    }
    setIsMetaReady(true)
  }, [folderId, supabase])

  const fetchDocuments = useCallback(async () => {
    if (!supabase || !folderId) return
    setIsLoadingDocs(true)
    const data = await listFolderDocuments(supabase, folderId)
    setDocuments(data as DocRow[])
    setIsLoadingDocs(false)
  }, [folderId, supabase])

  useEffect(() => {
    fetchFolderMeta()
  }, [fetchFolderMeta])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const ensureWorkspaceAndAccount = useCallback(async () => {
    if (!supabase) return null

    const uid = await getCurrentUserId(supabase)
    if (!uid) return null

    let workspaceId = folderMeta?.workspace_id ?? null
    let accountId = folderMeta?.account_id ?? null

    if (!workspaceId) {
      workspaceId = await ensureWorkspaceForUser(supabase, uid)
    }
    if (!accountId) {
      accountId = uid
    }

    if (!workspaceId || !accountId) return null
    return { workspaceId, accountId, uid }
  }, [folderMeta, supabase])

  const insertPdfDocument = useCallback(
    async (name: string, file: File) => {
      if (!supabase || !folderId) return null

      const ensured = await ensureWorkspaceAndAccount()
      if (!ensured) return null
      const { workspaceId, accountId, uid } = ensured

      const effectiveName = name || file.name
      const filePath = `read/${crypto.randomUUID()}.pdf`

      const docId = await createDocument(supabase, {
        title: effectiveName,
        folderId,
        workspaceId,
        accountId,
        ownerUserId: uid,
        docType: 'pdf',
        mimeType: file.type,
        fileBucket: 'documents',
        filePath,
        status: 'ready',
      })

      if (!docId) return null
      await fetchDocuments()
      return { docId, filePath }
    },
    [ensureWorkspaceAndAccount, fetchDocuments, folderId, supabase]
  )

  const insertWriterDocument = useCallback(
    async (name: string) => {
      if (!supabase || !folderId) return null
      const ensured = await ensureWorkspaceAndAccount()
      if (!ensured) return null
      const { workspaceId, accountId, uid } = ensured

      const filePath = `write/${crypto.randomUUID()}.txt`

      const docId = await createDocument(supabase, {
        title: name,
        folderId,
        workspaceId,
        accountId,
        ownerUserId: uid,
        docType: 'txt',
        mimeType: 'text/plain',
        fileBucket: 'documents',
        filePath,
        status: 'ready',
      })

      if (!docId) return null
      await fetchDocuments()
      return docId
    },
    [ensureWorkspaceAndAccount, fetchDocuments, folderId, supabase]
  )

  return {
    folderName,
    documents,
    isLoadingDocs,
    isMetaReady,
    insertPdfDocument,
    insertWriterDocument,
    refreshDocuments: fetchDocuments,
  }
}

