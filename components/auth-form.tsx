"use client"

import { useActionState } from "react"
import Link from "next/link"
import { signInAction, signUpAction, type AuthState } from "@/lib/actions/auth"

interface Props {
  mode: "login" | "signup"
  next?: string
  linkError?: boolean
}

export function AuthForm({ mode, next, linkError }: Props) {
  const action = mode === "login" ? signInAction : signUpAction
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {})

  return (
    <form action={formAction} className="w-full max-w-[360px]">
      <h1 className="font-display text-[30px] font-medium leading-tight">{mode === "login" ? "Sign in" : "Create your account"}</h1>
      {linkError ? <p className="mt-3 text-[13.5px] text-danger">That link has expired. Sign in, or ask for a new one.</p> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="mt-8 block">
        <span className="meta">Email</span>
        <input name="email" type="email" autoComplete="email" required className="rule-input mt-1 text-[15px]" placeholder="you@example.com" />
      </label>
      <label className="mt-5 block">
        <span className="meta">Password</span>
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} className="rule-input mt-1 text-[15px]" placeholder={mode === "signup" ? "at least 8 characters" : ""} />
      </label>

      {state.error ? <p className="mt-3 text-[13.5px] text-danger">{state.error}</p> : null}
      {state.notice ? <p className="mt-3 text-[13.5px] text-ok">{state.notice}</p> : null}

      <button type="submit" disabled={pending} className="btn btn-primary mt-7 h-11 w-full text-[15px]">
        {pending ? (mode === "login" ? "Signing in…" : "Creating…") : mode === "login" ? "Sign in" : "Create account"}
      </button>

      <p className="mt-6 text-[13.5px] text-ink-2">
        {mode === "login" ? (
          <>New here? <Link href="/signup" className="underline underline-offset-2 hover:text-accent">Create an account</Link></>
        ) : (
          <>Already have one? <Link href="/login" className="underline underline-offset-2 hover:text-accent">Sign in</Link></>
        )}
        <span className="mx-2 text-ink-3">·</span>
        <Link href="/demo" className="underline underline-offset-2 hover:text-accent">Just try the demo</Link>
      </p>
    </form>
  )
}
