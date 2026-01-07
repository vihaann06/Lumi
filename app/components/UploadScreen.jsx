'use client'

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Upload, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function UploadScreen() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [authUser, setAuthUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      // Convert file to base64 and store in sessionStorage for persistence
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        sessionStorage.setItem('pdfFile', base64);
        sessionStorage.setItem('pdfFileName', file.name);
        
        // Create blob URL for immediate use
        const fileUrl = URL.createObjectURL(file);
        router.push(`/reader?fileUrl=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(file.name)}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthUser(null);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
    });

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const profileInitial =
    authUser?.user_metadata?.first_name?.[0]?.toUpperCase() ||
    authUser?.email?.[0]?.toUpperCase() ||
    'U';

  return (
    <div className="relative h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="absolute top-6 right-6">
        {authUser ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 bg-white/80 text-slate-700 font-semibold shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-colors"
            >
              {profileInitial}
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white/90 backdrop-blur shadow-lg shadow-slate-200/60">
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 truncate">
                  {authUser.email}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-b-xl"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/auth"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>

      <div className="w-full max-w-lg">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-light text-slate-900 mb-3 tracking-tight">Lumi</h1>
          <p className="text-slate-500 text-lg font-light">Upload a PDF to begin</p>
        </div>
        
        <label className="group flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-white/50 backdrop-blur-sm hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-300 shadow-sm hover:shadow-md">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-5 transition-colors duration-300">
              <Upload className="w-7 h-7 text-slate-400 group-hover:text-indigo-500 transition-colors duration-300" />
            </div>
            <p className="mb-2 text-base text-slate-700 font-medium">
              <span className="text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-slate-400">PDF files only</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="application/pdf"
            onChange={handleFileUpload}
          />
        </label>
      </div>
    </div>
  );
}
