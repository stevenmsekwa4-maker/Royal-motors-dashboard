import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { Logo } from '../components/ui'
import { signOutAdmin } from '../lib/auth'
import { describeError, getSupabase } from '../lib/supabase'

// Landing page for the Supabase password-reset email link.
export const Route = createFileRoute('/reset-password')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Reset password · Royal Motors Admin' }] }),
  component: ResetPassword,
})

function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let sb: ReturnType<typeof getSupabase>
    try {
      sb = getSupabase()
    } catch (err) {
      setError(describeError(err))
      setReady('invalid')
      return
    }
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady('ok')
    })
    const t = setTimeout(() => {
      void sb.auth.getSession().then(({ data: s }) => setReady(s.session ? 'ok' : 'invalid'))
    }, 1200)
    return () => {
      clearTimeout(t)
      data.subscription.unsubscribe()
    }
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setError(null)
    setBusy(true)
    const { error: err } = await getSupabase().auth.updateUser({ password })
    if (err) {
      setError(describeError(err))
      setBusy(false)
      return
    }
    await signOutAdmin()
    navigate({ to: '/', search: { reason: 'reset' }, replace: true })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-ink-900 px-6 py-12">
      <div className="rise w-full max-w-sm">
        <div className="mb-10">
          <Logo size="lg" />
        </div>
        <div className="rounded-3xl bg-paper p-7 shadow-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold-600">
            Reset password
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">New password</h1>

          {ready === 'checking' && <p className="mt-6 text-sm text-ink-500">Checking your reset link…</p>}

          {ready === 'invalid' && (
            <div className="mt-6 space-y-4">
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error ?? 'This reset link is invalid or has expired. Request a new one from the sign-in page.'}
              </p>
              <Link to="/" className="btn-gold w-full py-3">
                Back to sign in
              </Link>
            </div>
          )}

          {ready === 'ok' && (
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              {(['New password', 'Confirm password'] as const).map((label, i) => (
                <div key={label}>
                  <label htmlFor={`pw${i}`} className="label">
                    {label}
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
                    <input
                      id={`pw${i}`}
                      type="password"
                      autoComplete="new-password"
                      className="field pl-9"
                      value={i === 0 ? password : confirm}
                      onChange={(e) => (i === 0 ? setPassword : setConfirm)(e.target.value)}
                    />
                  </div>
                </div>
              ))}
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button type="submit" className="btn-gold w-full py-3" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
