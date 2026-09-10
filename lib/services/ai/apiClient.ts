import { getSupabaseClient } from '@/lib/db/supabaseClient'

/**
 * Shared client for the /api/ai/* routes.
 *
 * Those routes require a valid Supabase session, so every request carries the
 * caller's access token. Without it the server has no way to tell a real user
 * from anyone who has found the URL.
 */
export async function postAI<T = any>(
  url: string,
  body: Record<string, any>
): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase is not configured. Cannot reach Lumi AI.')
  }

  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error('You need to be signed in to use Lumi AI features.')
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session expired. Sign in again to continue.')
    }
    throw new Error(payload?.error || 'AI request failed')
  }

  return payload as T
}
