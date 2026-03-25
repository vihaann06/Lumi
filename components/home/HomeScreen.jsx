'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/db/supabaseClient'
import HomeHeader from './HomeHeader'
import FoldersHeader from './FoldersHeader'
import FoldersList from './FoldersList'
import CreateFolderModal from './CreateFolderModal'
import FolderPrompt from './FolderPrompt'
import RenameFolderModal from './RenameFolderModal'

export default function HomeScreen() {
  const supabase = getSupabaseClient()
  const router = useRouter()

  const [authUser, setAuthUser] = useState(null)
  const [folders, setFolders] = useState([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [error, setError] = useState(null)
  const [workspaceIdCache, setWorkspaceIdCache] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const hasSupabase = Boolean(supabase)
  const isAuthed = Boolean(authUser)
  const createInputRef = useRef(null)

  const profileInitial = useMemo(() => {
    return (
      authUser?.user_metadata?.first_name?.[0]?.toUpperCase() ||
      authUser?.email?.[0]?.toUpperCase() ||
      'U'
    )
  }, [authUser])

  const fetchFolders = async () => {
    if (!supabase || !authUser) return
    setIsLoadingFolders(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('folders')
      .select('id, name, description, created_at')
      .order('created_at', { ascending: false })
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setFolders(data || [])
    }
    setIsLoadingFolders(false)
  }

  const handleCreateFolder = async (e) => {
    e.preventDefault()
    if (!supabase) return
    if (!authUser) {
      setError('Please sign in to create a folder.')
      return
    }
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty.')
      return
    }

    setIsCreating(true)
    setError(null)

    // Ensure legacy workspace exists (FK constraint)
    let workspaceId = workspaceIdCache
    if (!workspaceId) {
      const { data: existingWorkspace, error: fetchWsError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_user_id', authUser.id)
        .maybeSingle()

      if (fetchWsError) {
        setError(fetchWsError.message)
        setIsCreating(false)
        return
      }

      if (existingWorkspace?.id) {
        workspaceId = existingWorkspace.id
      } else {
        const { data: newWorkspace, error: createWsError } = await supabase
          .from('workspaces')
          .insert({ owner_user_id: authUser.id, name: 'My Workspace' })
          .select('id')
          .single()

        if (createWsError) {
          setError(createWsError.message)
          setIsCreating(false)
          return
        }
        workspaceId = newWorkspace.id
      }

      setWorkspaceIdCache(workspaceId)
    }

    const { error: insertError } = await supabase.from('folders').insert({
      name: newFolderName.trim(),
      account_id: authUser.id,
      created_by: authUser.id,
      workspace_id: workspaceId,
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      setNewFolderName('')
      setIsModalOpen(false)
      fetchFolders()
      createInputRef.current?.focus()
    }
    setIsCreating(false)
  }

  const handleSignIn = () => {
    router.push('/auth')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setAuthUser(null)
    setFolders([])
    setIsProfileMenuOpen(false)
  }

  const handleOpenFolder = (folderId) => {
    router.push(`/folders/${encodeURIComponent(folderId)}`)
  }

  const handleStartRename = (folder) => {
    setRenameTarget(folder)
    setRenameModalOpen(true)
  }

  const handleConfirmRename = async (name) => {
    if (!supabase || !authUser || !renameTarget) return
    const trimmed = name.trim()
    if (!trimmed) return
    setIsRenaming(true)
    const { error: updateError } = await supabase
      .from('folders')
      .update({ name: trimmed })
      .eq('id', renameTarget.id)
      .eq('account_id', authUser.id)
    setIsRenaming(false)
    setRenameModalOpen(false)
    setRenameTarget(null)
    if (updateError) {
      setError(updateError.message)
    } else {
      fetchFolders()
    }
  }

  const handleDeleteFolder = async (folder) => {
    if (!supabase || !authUser) return
    const confirmed = window.confirm(`Delete "${folder.name}"?`)
    if (!confirmed) return
    setDeletingId(folder.id)
    const { error: deleteError } = await supabase
      .from('folders')
      .delete()
      .eq('id', folder.id)
      .eq('account_id', authUser.id)
    setDeletingId(null)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      fetchFolders()
    }
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null)
      }
    )
    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    fetchFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])

  return (
    <div className="h-screen bg-slate-50 flex">
      {/* Control panel (sidebar) */}
      <div className="w-full md:w-1/3 border-r border-slate-200 bg-white flex flex-col gap-6 p-6">
        <HomeHeader
          isAuthed={isAuthed}
          profileInitial={profileInitial}
          isProfileMenuOpen={isProfileMenuOpen}
          onToggleProfileMenu={() => setIsProfileMenuOpen((prev) => !prev)}
          onSignOut={handleSignOut}
          onSignIn={handleSignIn}
        />

        <FoldersHeader isAuthed={isAuthed} onOpenCreate={() => setIsModalOpen(true)} />

        <div className="flex-1 overflow-y-auto pr-2">
          <FoldersList
            isAuthed={isAuthed}
            isLoadingFolders={isLoadingFolders}
            folders={folders}
            onOpenFolder={handleOpenFolder}
            onSignIn={handleSignIn}
            onRenameFolder={handleStartRename}
            onDeleteFolder={handleDeleteFolder}
            deletingId={deletingId}
          />
        </div>
      </div>

      {/* Right side content area */}
      <div className="flex-1 bg-slate-50">
        <FolderPrompt />
      </div>

      {/* Create folder modal */}
      <CreateFolderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setError(null)
          setNewFolderName('')
        }}
        onSubmit={handleCreateFolder}
        newFolderName={newFolderName}
        onNameChange={setNewFolderName}
        isCreating={isCreating}
        isAuthed={isAuthed}
        error={error}
        createInputRef={createInputRef}
      />
      <RenameFolderModal
        isOpen={renameModalOpen}
        initialName={renameTarget?.name || ''}
        onClose={() => {
          setRenameModalOpen(false)
          setRenameTarget(null)
        }}
        onConfirm={handleConfirmRename}
        isSaving={isRenaming}
      />
    </div>
  )
}

