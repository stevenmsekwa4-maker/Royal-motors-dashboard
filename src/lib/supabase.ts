/**
 * Browser Supabase client. It uses only the public anon key. Every read and
 * write is checked by Row Level Security in the database (see
 * the existing live RLS policies). The service role key is never used in this app.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const PHOTO_BUCKET = 'car-photos'

// Keep the admin dashboard pointed at the exact same Supabase project and
// public publishable key as the customer website. This key is intentionally
// public; database access is still restricted by the existing RLS policies.
// Never replace this with a service_role or secret key.
const url = 'https://mlzedoeetcwevbtnhrnp.supabase.co'
const anonKey = 'sb_publishable_vaRWxPq6AjwDC862W-xL5g_C3v686hs'

export const SUPABASE_URL = url?.replace(/\/+$/, '') ?? ''

export class ConfigError extends Error {}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('Supabase is only used in the browser in this app.')
  }
  if (!url || !anonKey) {
    throw new ConfigError(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Netlify environment variables and redeploy.',
    )
  }
  client ??= createClient(SUPABASE_URL, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}

interface DbErrorLike {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
  status?: number
}

const SETUP_HINT = 'Review the existing Supabase RLS and Storage policies; do not run setup.sql blindly.'

/** Turn Supabase/PostgREST/network errors into a clear message for admins. */
export function describeError(err: unknown): string {
  if (err instanceof ConfigError) return err.message
  const e = (err ?? {}) as DbErrorLike
  const msg = e.message ?? String(err)
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Can’t reach Supabase. Check your internet connection and try again.'
  }
  switch (e.code) {
    case '42501':
      return `The database refused this action (permission denied). Make sure your account’s profile role is 'admin' and the security setup has been applied. ${SETUP_HINT}`
    case '42703':
    case 'PGRST204':
      return `The database is missing a column the dashboard needs (${msg}). ${SETUP_HINT}`
    case 'PGRST205':
      return `A database table is missing (${msg}).`
    case 'PGRST116':
      return 'No matching record was found, or you don’t have permission to change it.'
    case 'PGRST301':
    case 'PGRST303':
      return 'Your session has expired. Sign in again.'
    case '23503':
      return 'This record is linked to another record and can’t be changed this way.'
    case '22P02':
    case '23514':
      return `The database rejected a value: ${msg}`
  }
  if (/bucket not found/i.test(msg)) {
    return `The car-photos storage bucket doesn’t exist yet. ${SETUP_HINT}`
  }
  if (/row-level security|unauthorized|403/i.test(msg)) {
    return `Upload blocked by storage security rules. Make sure your account is an admin. ${SETUP_HINT}`
  }
  return msg || 'Something went wrong talking to Supabase.'
}
