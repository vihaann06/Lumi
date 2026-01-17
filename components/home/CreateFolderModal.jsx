import { FolderPlus, Loader2, X } from 'lucide-react'

export default function CreateFolderModal({
  isOpen,
  onClose,
  onSubmit,
  newFolderName,
  onNameChange,
  isCreating,
  isAuthed,
  error,
  createInputRef,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-900">Create folder</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            ref={createInputRef}
            type="text"
            value={newFolderName}
            onChange={(e) => onNameChange(e.target.value)}
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
              onClick={onClose}
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
  )
}

