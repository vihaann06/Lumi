import { Sparkles } from 'lucide-react'

export default function HomeHeader({
  isAuthed,
  profileInitial,
  isProfileMenuOpen,
  onToggleProfileMenu,
  onSignOut,
  onSignIn,
}) {
  return (
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
            onClick={onToggleProfileMenu}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold"
          >
            {profileInitial}
          </button>
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
              <button
                type="button"
                onClick={onSignOut}
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
          onClick={onSignIn}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
        >
          Sign in
        </button>
      )}
    </div>
  )
}

