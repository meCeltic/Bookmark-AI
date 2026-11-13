"use client"

import { useActionState } from "react"
import Link from "next/link"
import { signInAction, signUpAction, type AuthState } from "@/lib/actions/auth"

interface Props {
  mode: "login" | "signup"
  next?: string
  linkError?: boolean
}

const linkClass = "text-ink underline decoration-line-strong underline-offset-4 hover:text-action hover:decoration-current"

export function AuthForm({ mode, next, linkError }: Props) {
  const action = mode === "login" ? signInAction : signUpAction
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {})
  const login = mode === "login"

  return (
    <form action={formAction} className="w-full">
      <h1 className="text-[32px] leading-tight" style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
        {login ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {login ? "Sign in to your saved pages." : "Your saved pages, on every device."}
      </p>
      {linkError ? <p role="alert" className="mt-4 text-[14px] text-danger">That link has expired. Sign in, or ask for a new one.</p> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="mt-8 space-y-4">
        <div>
          <label htmlFor="auth-email" className="meta block">Email</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required className="field mt-1.5 text-[15px]" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="auth-password" className="meta block">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={login ? "current-password" : "new-password"}
            required
            minLength={8}
            className="field mt-1.5 text-[15px]"
            placeholder={login ? "" : "At least 8 characters"}
          />
        </div>
      </div>

      {state.error ? <p role="alert" className="mt-4 text-[14px] text-danger">{state.error}</p> : null}
      {state.notice ? <p role="status" className="mt-4 text-[14px] text-ok">{state.notice}</p> : null}

      <button type="submit" disabled={pending} className="btn btn-primary mt-6 h-10 w-full text-[15px]">
        {pending ? (login ? "Signing in…" : "Creating…") : login ? "Sign in" : "Create account"}
      </button>

      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {login ? (
          <span>New here? <Link href="/signup" className={linkClass}>Create an account</Link></span>
        ) : (
          <span>Already have one? <Link href="/login" className={linkClass}>Sign in</Link></span>
        )}
        <Link href="/demo" className={linkClass}>Try the demo</Link>
      </p>
    </form>
  )
}
