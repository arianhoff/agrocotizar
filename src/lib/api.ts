/**
 * Authenticated fetch helper.
 * Attaches the current Supabase session token as Bearer header
 * so server-side functions can verify the caller is logged in.
 */
import { supabase } from '@/lib/supabase/client'

function jwtExpiresIn(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 - Date.now()
  } catch {
    return 0
  }
}

export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  let { data: { session } } = await supabase.auth.getSession()

  // Refresh if token is missing or expiring within 2 minutes
  if (!session?.access_token || jwtExpiresIn(session.access_token) < 120_000) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }

  const token = session?.access_token

  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
