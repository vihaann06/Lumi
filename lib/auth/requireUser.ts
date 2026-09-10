import { createClient, SupabaseClient, User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side Supabase client used only to verify bearer tokens.
 * Separate from the browser client in lib/db/supabaseClient.ts: it must not
 * persist or refresh sessions, since it is shared across all requests.
 */
let verifierClient: SupabaseClient | null = null

function getVerifierClient() {
  if (verifierClient) return verifierClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return null

  verifierClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return verifierClient
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return token || null
}

/**
 * Verifies the caller's Supabase access token.
 * Returns the authenticated user, or null if the token is missing or invalid.
 */
export async function getUserFromRequest(request: NextRequest): Promise<User | null> {
  const token = bearerToken(request)
  if (!token) return null

  const supabase = getVerifierClient()
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null

  return data.user
}

/**
 * Route guard. Returns either the authenticated user or the 401 response to
 * return from the handler:
 *
 *   const auth = await requireUser(request)
 *   if ('response' in auth) return auth.response
 *   // auth.user is available here
 */
export async function requireUser(
  request: NextRequest
): Promise<{ user: User } | { response: NextResponse }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      response: NextResponse.json(
        { error: 'Auth is not configured on the server.' },
        { status: 500 }
      ),
    }
  }

  const user = await getUserFromRequest(request)
  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized. Sign in to use Lumi AI features.' },
        { status: 401 }
      ),
    }
  }

  return { user }
}
