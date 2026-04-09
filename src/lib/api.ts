/**
 * Authenticated fetch helper.
 * Attaches the current Supabase session token as Bearer header
 * so server-side functions can verify the caller is logged in.
 */
import { supabase } from '@/lib/supabase/client'

export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
