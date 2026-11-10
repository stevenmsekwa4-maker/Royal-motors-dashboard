import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Logo({ dark = true, size = 'md' }: { dark?: boolean; size?: 'md' | 'lg' }) {
  const big = size === 'lg'
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`grid place-items-center rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-700 text-ink-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ${big ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg'}`}
      >
        ♛
      </span>
      <span className="leading-none">
        <span
          className={`block font-display font-semibold tracking-[0.18em] ${big ? 'text-2xl' : 'text-[15px]'} ${dark ? 'text-white' : 'text-ink-900'}`}
        >
          ROYAL MOTORS
        </span>
        <span
          className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.32em] ${dark ? 'text-gold-400' : 'text-gold-600'}`}
        >
          Admin Console
        </span>
      </span>
    </div>
  )
}

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  )
}

/** Right-side drawer on desktop, bottom sheet on mobile. */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="rise absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-3xl bg-paper outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(640px,100vw)] sm:rounded-none sm:rounded-l-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-900/10 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-wide text-ink-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-900/5 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-ink-900/10 bg-white/70 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink-950/60" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="rise relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        <div className="mt-2 text-sm text-ink-600">{body}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast({
  message,
  onDone,
  tone = 'success',
}: {
  message: string | null
  onDone: () => void
  tone?: 'success' | 'error'
}) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, tone === 'error' ? 7000 : 2600)
    return () => clearTimeout(t)
  }, [message, onDone, tone])
  if (!message) return null
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rise fixed bottom-24 left-1/2 z-[70] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 px-5 py-2.5 text-sm font-semibold text-white shadow-xl lg:bottom-8 ${tone === 'error' ? 'rounded-2xl bg-red-700' : 'rounded-full bg-ink-900'}`}
    >
      <span className={`mr-2 ${tone === 'error' ? 'text-white' : 'text-gold-400'}`}>
        {tone === 'error' ? '!' : '✓'}
      </span>
      {message}
    </div>
  )
}

/** Inline error box used in editors and data screens. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold-600">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-wide text-ink-900 sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-gold-300">
      {initials}
    </span>
  )
}
