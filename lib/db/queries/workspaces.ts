import { SupabaseClient } from '@supabase/supabase-js'

export async function ensureWorkspaceForUser(
  supabase: SupabaseClient | null,
  userId: string | null
) {
  if (!supabase || !userId) return null

  // Try existing workspace
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (existing?.id) {
    return existing.id as string
  }

  const { data: created, error } = await supabase
    .from('workspaces')
    .insert({ owner_user_id: userId, name: 'My Workspace' })
    .select('id')
    .single()

  if (error || !created?.id) return null
  return created.id as string
}

