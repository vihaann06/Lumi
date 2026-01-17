import { Folder, Loader2 } from 'lucide-react'

export default function FoldersList({
  isAuthed,
  isLoadingFolders,
  folders,
  onOpenFolder,
  onSignIn,
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
        <button
          key={folder.id}
          onClick={() => onOpenFolder(folder.id)}
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
  )
}

