'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Folder, FolderPlus, Loader2, Sparkles, X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabaseClient'

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

  const handleOpenFolder = (folderId) => {
    router.push(`/folders/${encodeURIComponent(folderId)}`)
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
      {/* Control panel */}
      <div className="w-full md:w-1/3 border-r border-slate-200 bg-white/70 backdrop-blur-sm p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
                Lumi
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">Home</h1>
            </div>
          </div>
          {isAuthed ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold"
              >
                {profileInitial}
              </button>
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut()
                      setAuthUser(null)
                      setFolders([])
                      setIsProfileMenuOpen(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/auth')}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
            >
              Sign in
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Folders</p>
            <p className="text-xs text-slate-500">Select a folder to open</p>
          </div>
          {isAuthed ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <FolderPlus className="h-4 w-4" />
              Create folder
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {!isAuthed ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 space-y-3">
              <p>Sign in to view and manage your folders.</p>
              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
              >
                Go to sign in
              </button>
            </div>
          ) : isLoadingFolders ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading folders...
            </div>
          ) : folders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-3">
              <Folder className="h-5 w-5 text-slate-400" />
              You have no folders yet. Create your first folder to get started.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleOpenFolder(folder.id)}
                  className="group w-full text-left px-4 py-3 hover:bg-indigo-50/40 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Folder className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {folder.name}
                      </p>
                      {folder.description ? (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {folder.description}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-slate-400 mt-2">
                        Created {new Date(folder.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side placeholder */}
      <div className="w-full md:w-2/3 p-6 overflow-y-auto">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
          Select a folder from the left to open it.
        </div>
      </div>

      {/* Create folder modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-slate-900">Create folder</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateFolder}>
              <input
                ref={createInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
              {error ? (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setError(null)
                    setNewFolderName('')
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !isAuthed}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 shadow-sm hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

