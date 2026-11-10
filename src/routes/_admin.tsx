import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { AdminShell } from '../components/AdminShell'
import { Logo } from '../components/ui'
import { checkAdminCached, clearAdminCache, signOutAdmin } from '../lib/auth'
import { InventoryProvider, useInventory } from '../lib/store'
import { getSupabase } from '../lib/supabase'

// Pathless layout for every signed-in screen. It runs only in the browser
// (the Supabase session lives there) and lets in only users whose
// public.profiles.role is 'admin'. The database enforces the same rule with
// RLS, so this guard is the user-facing layer, not the only one.
export const Route = createFileRoute('/_admin')({
  ssr: false,
  beforeLoad: async () => {
    const result = await checkAdminCached()
    if (result.ok) return { admin: result.admin }
    if (result.reason === 'not-admin') {
      await signOutAdmin()
      throw redirect({ to: '/', search: { reason: 'not-admin' } })
    }
    if (result.reason === 'error') {
      throw redirect({ to: '/', search: { reason: 'error', message: result.message } })
    }
    throw redirect({ to: '/' })
  },
  pendingComponent: AdminPending,
  component: AdminLayout,
})

function AdminLayout() {
  const { admin } = Route.useRouteContext()
  const navigate = useNavigate()

  // Leave the dashboard as soon as the session ends (sign-out in another
  // tab, or an expired refresh token).
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearAdminCache()
        navigate({ to: '/', replace: true })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  return (
    <InventoryProvider>
      <AdminShell admin={admin}>
        <DataGate>
          <Outlet />
        </DataGate>
      </AdminShell>
    </InventoryProvider>
  )
}

function DataGate({ children }: { children: React.ReactNode }) {
  const { status, error, reload } = useInventory()
  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-24 text-sm text-ink-500" role="status">
        <span className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-500" />
        Loading from Supabase…
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="card mx-auto mt-6 max-w-xl p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-bold text-ink-900">Couldn’t load your data from Supabase</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{error}</p>
        <p className="mt-2 text-xs text-ink-500">
          Nothing is shown until the connection works, so you never edit stale or sample data.
        </p>
        <button type="button" className="btn-gold mt-5" onClick={() => void reload()}>
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    )
  }
  return <>{children}</>
}

function AdminPending() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink-900">
      <div className="flex flex-col items-center gap-5">
        <Logo size="lg" />
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-400" />
      </div>
    </div>
  )
}
