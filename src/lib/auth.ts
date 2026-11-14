import type { User } from '@supabase/supabase-js'
import { ConfigError, describeError, getSupabase } from './supabase'

export interface AdminSession {
  user: User
  email: string
  name: string
}

export type AdminCheck =
  | { ok: true; admin: AdminSession }
  | { ok: false; reason: 'signed-out' | 'not-admin' | 'error'; message?: string }

/** Verify the current session belongs to a user whose profile role is 'admin'. */
export async function checkAdmin(): Promise<AdminCheck> {
  try {
    const sb = getSupabase()
    // getUser() validates the token with Supabase instead of trusting local storage.
    const { data, error } = await sb.auth.getUser()
    if (error || !data.user) {
      const { data: s } = await sb.auth.getSession()
      if (!s.session) return { ok: false, reason: 'signed-out' }
      if (error && /fetch/i.test(error.message)) {
        return { ok: false, reason: 'error', message: describeError(error) }
      }
      return { ok: false, reason: 'signed-out' }
    }
    const user = data.user
    const { data: profile, error: pErr } = await sb
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()
    if (pErr) {
      return {
        ok: false,
        reason: 'error',
        message: `Couldn’t check your admin role: ${describeError(pErr)}`,
      }
    }
    if (profile?.role !== 'admin') return { ok: false, reason: 'not-admin' }
    return {
      ok: true,
      admin: {
        user,
        email: user.email ?? '',
        name: (profile.full_name as string | null)?.trim() || 'Admin',
      },
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof ConfigError ? err.message : describeError(err),
    }
  }
}

export async function signInAdmin(email: string, password: string): Promise<AdminCheck> {
  const sb = getSupabase()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) {
    return {
      ok: false,
      reason: 'error',
      message: /invalid login credentials/i.test(error.message)
        ? 'Incorrect email or password.'
        : /email not confirmed/i.test(error.message)
          ? 'This email address hasn’t been confirmed yet. Check your inbox.'
          : describeError(error),
    }
  }
  clearAdminCache()
  const check = await checkAdminCached()
  if (!check.ok) await sb.auth.signOut()
  return check
}

/** Send a one-time, passwordless sign-in link to an existing admin only. */
export async function sendAdminMagicLink(email: string) {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  })
  if (error) throw new Error(describeError(error))
}

export async function signOutAdmin() {
  clearAdminCache()
  try {
    await getSupabase().auth.signOut()
  } catch {
    // Local session is cleared even if the network call fails.
  }
}

export async function sendPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new Error(describeError(error))
}

// Cache a successful check briefly so moving between admin screens doesn't
// re-query Supabase every time. The database still checks every request.
let cached: { userId: string; at: number; result: AdminCheck } | null = null
const CACHE_MS = 2 * 60_000

export async function checkAdminCached(): Promise<AdminCheck> {
  try {
    const { data } = await getSupabase().auth.getSession()
    const uid = data.session?.user.id
    if (cached && uid && cached.userId === uid && Date.now() - cached.at < CACHE_MS) {
      return cached.result
    }
  } catch {
    // Fall through to the full check, which reports the error.
  }
  const result = await checkAdmin()
  cached = result.ok ? { userId: result.admin.user.id, at: Date.now(), result } : null
  return result
}

export function clearAdminCache() {
  cached = null
}
