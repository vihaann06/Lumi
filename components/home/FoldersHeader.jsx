import { FolderPlus } from 'lucide-react'

export default function FoldersHeader({ isAuthed, onOpenCreate }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Your folders</h2>
        <p className="mt-1 text-sm text-slate-500">Open a card to jump in, or create something new.</p>
      </div>
      {isAuthed ? (
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100"
        >
          <FolderPlus className="h-4 w-4" />
          Create folder
        </button>
      ) : null}
    </div>
  )
}

