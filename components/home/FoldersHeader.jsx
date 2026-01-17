import { FolderPlus } from 'lucide-react'

export default function FoldersHeader({ isAuthed, onOpenCreate }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-800">Folders</p>
        <p className="text-xs text-slate-500">Select a folder to open</p>
      </div>
      {isAuthed ? (
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <FolderPlus className="h-4 w-4" />
          Create folder
        </button>
      ) : null}
    </div>
  )
}

