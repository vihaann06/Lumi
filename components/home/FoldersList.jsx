import { Folder, Loader2 } from 'lucide-react'

import { MoreHorizontal } from 'lucide-react'

export default function FoldersList({
  isAuthed,
  isLoadingFolders,
  folders,
  onOpenFolder,
  onSignIn,
  onRenameFolder,
  onDeleteFolder,
  deletingId,
}) {
  if (!isAuthed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 space-y-3">
        <p>Sign in to view and manage your folders.</p>
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
        >
          Go to sign in
        </button>
      </div>
    )
  }

  if (isLoadingFolders) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading folders...
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-3">
        <Folder className="h-5 w-5 text-slate-400" />
        You have no folders yet. Create your first folder to get started.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="group w-full text-left px-4 py-3 hover:bg-indigo-50/40 transition flex items-start gap-3"
        >
          <button
            onClick={() => onOpenFolder(folder.id)}
            className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0"
          >
            <Folder className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0" onClick={() => onOpenFolder(folder.id)}>
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
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRenameFolder?.(folder)
              }}
              className="hidden group-hover:inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white"
              title="Rename or delete"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRenameFolder?.(folder)
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteFolder?.(folder)
                }}
                disabled={deletingId === folder.id}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingId === folder.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

