import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  CarFront,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react'
import { Logo } from './ui'
import { signOutAdmin, type AdminSession } from '../lib/auth'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/cars', label: 'Cars', icon: CarFront },
  { to: '/customers', label: 'Customers', icon: Users },
] as const

export const CUSTOMER_SITE_URL = 'https://royal-motor.netlify.app/'

export function AdminShell({ admin, children }: { admin: AdminSession; children: ReactNode }) {
  const navigate = useNavigate()
  const signOut = async () => {
    await signOutAdmin()
    navigate({ to: '/', replace: true })
  }
  const initials =
    admin.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'RM'

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-ink-900 px-5 py-6 lg:flex">
        <Logo />
        <nav className="mt-10 space-y-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
              activeProps={{
                className:
                  '!bg-gradient-to-r !from-gold-500/20 !to-transparent !text-gold-300 shadow-[inset_2px_0_0_var(--color-gold-400)]',
              }}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <a
            href={CUSTOMER_SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/70 hover:border-gold-500/40 hover:text-gold-300"
          >
            View customer website
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500/20 text-sm font-bold text-gold-300">
              {admin.name === 'Admin' ? 'RM' : initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{admin.name}</p>
              <p className="truncate text-xs text-white/45">{admin.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink-900/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg p-2 text-white/60 hover:text-white"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-white/10 bg-ink-900 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-white/50"
            activeProps={{ className: '!text-gold-400' }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
