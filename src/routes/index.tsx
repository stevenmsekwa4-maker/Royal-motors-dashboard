import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/ui'
import { photoSrc } from '../lib/format'
import { checkAdminCached, sendAdminMagicLink, sendPasswordReset, signInAdmin } from '../lib/auth'
import { describeError } from '../lib/supabase'

type SignInSearch = { reason?: 'not-admin' | 'error' | 'reset'; message?: string }

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): SignInSearch => ({
    reason:
      s.reason === 'not-admin' || s.reason === 'error' || s.reason === 'reset'
        ? s.reason
        : undefined,
    message: typeof s.message === 'string' ? s.message.slice(0, 400) : undefined,
  }),
  component: SignIn,
})

const NOT_ADMIN =
  'This account is not an administrator. Ask the owner to set your profile role to admin.'

function SignIn() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    search.reason === 'not-admin' ? NOT_ADMIN : search.reason === 'error' ? (search.message ?? null) : null,
  )
  const [info, setInfo] = useState<string | null>(
    search.reason === 'reset' ? 'Password updated. Sign in with your new password.' : null,
  )

  // Already signed in as an admin? Go straight to the dashboard.
  useEffect(() => {
    if (search.reason) return
    let active = true
    void checkAdminCached().then((r) => {
      if (active && r.ok) navigate({ to: '/dashboard', replace: true })
    })
    return () => {
      active = false
    }
  }, [navigate, search.reason])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.includes('@') || password.length < 6) {
      setError('Enter your admin email and a password of at least 6 characters.')
      return
    }
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const result = await signInAdmin(email.trim(), password)
      if (result.ok) {
        navigate({ to: '/dashboard' })
        return
      }
      setError(result.reason === 'not-admin' ? NOT_ADMIN : (result.message ?? 'Sign-in failed.'))
    } catch (err) {
      setError(describeError(err))
    }
    setBusy(false)
  }

  const onMagicLink = async () => {
    if (!email.includes('@')) {
      setError('Enter the authorized admin email first.')
      return
    }
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      await sendAdminMagicLink(email.trim())
      setInfo('If this email belongs to an existing admin account, a secure sign-in link has been sent. Check your inbox and spam folder.')
    } catch (err) {
      setError(err instanceof Error ? err.message : describeError(err))
    }
    setBusy(false)
  }

  const onForgot = async () => {
    if (!email.includes('@')) {
      setError('Enter your admin email above, then tap “Forgot password?”.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await sendPasswordReset(email.trim())
      setInfo('If this email belongs to an account, a password reset link is on its way.')
    } catch (err) {
      setError(err instanceof Error ? err.message : describeError(err))
    }
    setBusy(false)
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Showcase panel */}
      <section className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <img
          src={photoSrc('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=85', 1400)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-ink-950/70" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo size="lg" />
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-400">
              Drive your dream
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.1] text-white">
              Your showroom,
              <br />
              <span className="gold-text">under your command.</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/70">
              Add cars, set prices, upload photos and follow up with every customer —
              all from one private console built for ROYAL MOTORS.
            </p>
          </div>
          <p className="text-xs text-white/40">© 2026 ROYAL MOTORS · Tanzania</p>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex flex-col justify-center bg-ink-900 px-6 py-12 sm:px-12 lg:bg-paper">
        <div className="absolute inset-0 overflow-hidden lg:hidden" aria-hidden="true">
          <img
            src={photoSrc('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85', 900)}
            alt=""
            className="h-72 w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/30 via-ink-900 to-ink-900" />
        </div>

        <div className="rise relative mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo size="lg" />
          </div>
          <div className="rounded-3xl bg-paper p-7 shadow-2xl lg:bg-transparent lg:p-0 lg:shadow-none">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold-600">
              Admin sign in
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink-900">
              Karibu tena
            </h2>
            <p className="mt-1.5 text-sm text-ink-500">
              Welcome back. Sign in to manage your inventory.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="field pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="field px-9"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-500/70 hover:text-ink-900"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              {info && (
                <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {info}
                </p>
              )}

              <button type="submit" className="btn-gold w-full py-3" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in to dashboard'}
              </button>
              <button
                type="button"
                onClick={() => void onMagicLink()}
                disabled={busy}
                className="block w-full rounded-xl border border-gold-500/40 py-3 text-center text-sm font-semibold text-gold-700 hover:bg-gold-50"
              >
                {busy ? 'Please wait…' : 'Email me a secure sign-in link'}
              </button>
              <button
                type="button"
                onClick={() => void onForgot()}
                disabled={busy}
                className="block w-full text-center text-sm font-semibold text-gold-700 hover:underline"
              >
                Forgot password?
              </button>
            </form>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-gold-500/25 bg-gold-50 px-3.5 py-3 text-xs leading-relaxed text-gold-700">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Private console. Only ROYAL MOTORS administrators can sign in,
                and every change is checked by the database’s security rules.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
