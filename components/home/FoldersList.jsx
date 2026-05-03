import { Folder, Loader2 } from 'lucide-react'

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
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Folder className="h-7 w-7" />
        </div>
        <p className="text-base font-medium text-slate-900">Sign in to see your folders</p>
        <p className="mt-2 text-sm text-slate-500">
          Your workspaces and provenance links live here after you sign in.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
        >
          Go to sign in
        </button>
      </div>
    )
  }

  if (isLoadingFolders) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm">Loading folders…</p>
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 p-10 text-center">
        <Folder className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-4 text-base font-medium text-slate-800">No folders yet</p>
        <p className="mt-2 text-sm text-slate-500">
          Create a folder to start collecting sources and writing synthesis in one place.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <button
            type="button"
            onClick={() => onOpenFolder(folder.id)}
            className="flex flex-1 flex-col text-left"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Folder className="h-6 w-6" />
            </span>
            <p className="mt-4 text-lg font-semibold text-slate-900 line-clamp-2">{folder.name}</p>
            {folder.description ? (
              <p className="mt-2 flex-1 text-sm text-slate-500 line-clamp-3">{folder.description}</p>
            ) : (
              <p className="mt-2 flex-1 text-sm text-slate-400">No description</p>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Created {new Date(folder.created_at).toLocaleDateString()}
            </p>
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenFolder(folder.id)
              }}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 sm:flex-none sm:px-4"
            >
              Open
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRenameFolder?.(folder)
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
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
              className="inline-flex items-center justify-center rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              {deletingId === folder.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
