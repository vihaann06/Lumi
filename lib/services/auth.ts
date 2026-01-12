import { SupabaseClient } from '@supabase/supabase-js'

export async function getCurrentUserId(supabase: SupabaseClient | null) {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

