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
  thumbnail_path?: string | null
  thumbnail_bucket?: string | null
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
    const withThumbs = (data as any[]).map((d) => {
      const thumb = d.document_assets?.find?.((a: any) => a.kind === 'thumbnail_png')
      return {
        id: d.id,
        title: d.title,
        doc_type: d.doc_type,
        updated_at: d.updated_at,
        thumbnail_path: thumb?.path ?? null,
        thumbnail_bucket: thumb?.bucket ?? (thumb ? 'documents' : null),
      } as DocRow
    })
    setDocuments(withThumbs)
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
    async (name: string, file: File, thumbnail?: Blob | null) => {
      if (!supabase || !folderId) throw new Error('Missing Supabase client or folder id')

      const ensured = await ensureWorkspaceAndAccount()
      if (!ensured) throw new Error('User not signed in')
      const { workspaceId, accountId, uid } = ensured

      const effectiveName = name || file.name
      const bucket = 'documents'
      const filePath = `read/${crypto.randomUUID()}.pdf`

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })
      if (uploadError) throw uploadError

      const docId = await createDocument(supabase, {
        title: effectiveName,
        folderId,
        workspaceId,
        accountId,
        ownerUserId: uid,
        docType: 'pdf',
        mimeType: file.type,
        fileBucket: bucket,
        filePath,
        status: 'ready',
      })

      if (!docId) throw new Error('Failed to create document')

      // Upload thumbnail and store asset
      if (thumbnail) {
        const thumbPath = `thumbnails/${docId}.png`
        const { error: thumbUploadError } = await supabase.storage
          .from(bucket)
          .upload(thumbPath, thumbnail, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/png',
          })
        if (thumbUploadError) throw thumbUploadError

        const { error: assetError } = await supabase.from('document_assets').upsert({
          doc_id: docId,
          workspace_id: workspaceId,
          account_id: accountId,
          kind: 'thumbnail_png',
          bucket,
          path: thumbPath,
        })
        if (assetError) throw assetError
      }

      await fetchDocuments()
      return { docId, filePath }
    },
    [ensureWorkspaceAndAccount, fetchDocuments, folderId, supabase]
  )

  const deleteDocument = useCallback(
    async (docId: string) => {
      if (!supabase || !folderId) throw new Error('Missing Supabase client or folder id')

      // Fetch storage info for the document
      const { data: docRow, error: docError } = await supabase
        .from('documents')
        .select('file_bucket, file_path')
        .eq('id', docId)
        .maybeSingle()
      if (docError) throw docError

      // Fetch and delete related assets (thumbnails, etc.)
      const { data: assets } = await supabase
        .from('document_assets')
        .select('bucket, path')
        .eq('doc_id', docId)

      const pathsToDelete: { bucket: string; path: string }[] = []

      if (docRow?.file_bucket && docRow?.file_path) {
        pathsToDelete.push({ bucket: docRow.file_bucket, path: docRow.file_path })
      }
      assets?.forEach((a) => {
        if (a.bucket && a.path) {
          pathsToDelete.push({ bucket: a.bucket, path: a.path })
        }
      })

      // Delete all storage objects (fail-fast if any deletion fails)
      for (const item of pathsToDelete) {
        const { error: storageError } = await supabase.storage.from(item.bucket).remove([item.path])
        if (storageError) throw storageError
      }

      const { error: deleteError } = await supabase.from('documents').delete().eq('id', docId)
      if (deleteError) throw deleteError

      await fetchDocuments()
      return true
    },
    [fetchDocuments, folderId, supabase]
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

  const renameDocument = useCallback(
    async (docId: string, title: string) => {
      if (!supabase) throw new Error('Missing Supabase client')
      const trimmed = title.trim()
      if (!trimmed) throw new Error('Title cannot be empty')

      const { error } = await supabase
        .from('documents')
        .update({ title: trimmed })
        .eq('id', docId)
      if (error) throw error
      await fetchDocuments()
      return true
    },
    [fetchDocuments, supabase]
  )

  return {
    folderName,
    documents,
    isLoadingDocs,
    isMetaReady,
    insertPdfDocument,
    insertWriterDocument,
    deleteDocument,
    renameDocument,
    refreshDocuments: fetchDocuments,
  }
}

