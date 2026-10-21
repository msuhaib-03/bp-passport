"use client";

import { FormEvent, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { KeyRound, LogIn, LogOut, Mail, UserPlus } from "lucide-react";

import { Link, useRouter } from "@/lib/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "login" | "register" | "recover" | "update-password";
const AUTH_RETURN_KEY = "bpp.auth.return.v1";

export function AccountPanel({ locale, destination = "care", confirmed = false }: { locale: string; destination?: "care" | "portal"; confirmed?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [configured] = useState(() => Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ));
  const [message, setMessage] = useState(confirmed ? "Email confirmed. Sign in to continue." : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const returnPath = readReturnPath(locale);
    const oauthReturn = new URLSearchParams(window.location.search).get("oauth") === "1";

    void client.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setIsAnonymous(data.session?.user.is_anonymous ?? false);
      setEmailConfirmed(Boolean(data.session?.user.email_confirmed_at));
      if (returnPath && data.session?.user.email_confirmed_at && !data.session.user.is_anonymous) {
        followReturnPath(returnPath);
      } else if (oauthReturn && data.session?.user.email_confirmed_at && !data.session.user.is_anonymous) {
        router.replace(destination === "portal" ? "/portal" : "/care");
      }
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user.email ?? null);
      setIsAnonymous(session?.user.is_anonymous ?? false);
      setEmailConfirmed(Boolean(session?.user.email_confirmed_at));
      if (event === "PASSWORD_RECOVERY") setMode("update-password");
      else if (event === "SIGNED_IN" && returnPath && session?.user.email_confirmed_at && !session.user.is_anonymous) {
        followReturnPath(returnPath);
      } else if (event === "SIGNED_IN" && oauthReturn && session?.user.email_confirmed_at && !session.user.is_anonymous) {
        router.replace(destination === "portal" ? "/portal" : "/care");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [destination, locale, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Cloud accounts are not configured on this deployment.");
      setBusy(false);
      return;
    }

    try {
      const returnPath = readReturnPath(locale);
      if (mode === "recover") {
        const result = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: passwordResetReturnUrl(locale),
        });
        if (result.error) throw result.error;
        setMessage("Check your email for a secure password-reset link.");
        return;
      }

      if (mode === "update-password") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        if (returnPath) {
          followReturnPath(returnPath);
          return;
        }
        setMessage("Your password has been updated.");
        return;
      }

      if (mode === "login") {
        const result = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw result.error;
        if (returnPath) {
          followReturnPath(returnPath);
          return;
        }
        router.push(destination === "portal" ? "/portal" : "/care");
        return;
      }

      if (password !== confirmPassword) throw new Error("Passwords do not match.");
      const current = await client.auth.getSession();
      const redirectTo = confirmationReturnUrl(locale, destination);
      const result = current.data.session?.user.is_anonymous
        ? await client.auth.updateUser(
            { email: email.trim(), password },
            { emailRedirectTo: redirectTo },
          )
        : await client.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: redirectTo },
          });
      if (result.error) throw result.error;
      const afterRegistration = await client.auth.getSession();
      const registrationConfirmed = Boolean(
        afterRegistration.data.session?.user.email_confirmed_at
          && !afterRegistration.data.session.user.is_anonymous,
      );
      if (registrationConfirmed && returnPath) {
        followReturnPath(returnPath);
        return;
      }
      setMessage(
        registrationConfirmed
          ? "Account created. Your existing device passport stays linked to this account."
          : "Account created. Check your email to confirm it, then sign in.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setError("");
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: accountReturnUrl(locale, destination) },
    });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
    }
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setError("");
    setMessage("");
    const session = await client.auth.getSession();
    let revocationFailed = false;
    if (session.data.session?.access_token) {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.data.session.access_token}` },
      }).catch(() => null);
      revocationFailed = !response?.ok;
    }
    const result = await client.auth.signOut({ scope: "global" });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMessage(revocationFailed
      ? "Signed out globally. Immediate API revocation was unavailable, so this access token will remain valid only until its normal expiry."
      : "Signed out everywhere. This session is immediately blocked from the API; the local Passport stays on this device.");
  }

  async function resendConfirmation() {
    const client = getSupabaseBrowserClient();
    if (!client || !userEmail) return;
    setBusy(true);
    setError("");
    const result = await client.auth.resend({
      type: "signup",
      email: userEmail,
      options: { emailRedirectTo: confirmationReturnUrl(locale, destination) },
    });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setMessage("A new confirmation email has been sent.");
  }

  if (!configured) {
    return (
      <section className="card p-6">
        <p className="font-bold text-ink-900">Cloud accounts need setup</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Add the public Supabase URL and publishable key to this deployment. The
          health audit and on-device passport still work offline.
        </p>
      </section>
    );
  }

  if (userEmail && !isAnonymous && !emailConfirmed && mode !== "update-password") {
    return (
      <section className="card p-6">
        <p className="font-bold text-ink-900">Confirm your email address</p>
        <p className="mt-2 break-all text-sm text-ink-600">We sent a confirmation link to {userEmail}. Confirm it before using account recovery or the clinician portal.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={resendConfirmation} className="brand-gradient min-h-14 rounded-xl px-5 font-bold text-white disabled:opacity-60">Resend email</button>
          <button type="button" disabled={busy} onClick={signOut} className="min-h-14 rounded-xl border border-border-strong px-5 font-bold text-ink-700 disabled:opacity-60">Sign out</button>
        </div>
        {message && <p className="mt-4 text-sm text-ink-600" role="status">{message}</p>}
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
      </section>
    );
  }

  if (userEmail && !isAnonymous && emailConfirmed && mode !== "update-password") {
    const primaryDestination = destination === "portal" ? "/portal" : "/passport";
    const primaryLabel = destination === "portal" ? "Open clinician portal" : "Open my passport";
    return (
      <section className="card p-6">
        <p className="text-sm font-semibold text-ink-500">Signed in</p>
        <p className="mt-1 break-all text-lg font-bold text-ink-900">{userEmail}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Your passport can now be fetched on another device after you sign in there.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href={primaryDestination}
            className="brand-gradient inline-flex min-h-14 items-center justify-center rounded-xl px-5 font-bold text-white"
          >
            {primaryLabel}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={signOut}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border-strong px-5 font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
          >
            <LogOut size={18} aria-hidden />
            Sign out
          </button>
        </div>
        {destination === "care" && <Link href="/care" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-600">Go to patient care dashboard</Link>}
        {message && <p className="mt-4 text-sm text-ink-600" role="status">{message}</p>}
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="card p-6">
      {mode !== "update-password" && (
        <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
          <ModeButton active={mode === "login"} onClick={() => switchMode("login")} icon={LogIn}>
            Sign in
          </ModeButton>
          <ModeButton active={mode === "register"} onClick={() => switchMode("register")} icon={UserPlus}>
            Register
          </ModeButton>
        </div>
      )}

      {mode !== "recover" && mode !== "update-password" && (
        <>
          <button type="button" disabled={busy} onClick={() => void signInWithGoogle()} className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-border-strong bg-white px-5 font-bold text-ink-800 hover:bg-ink-50 disabled:opacity-60"><span className="grid size-7 place-items-center rounded-full bg-white text-lg font-black text-[#4285f4] shadow-sm">G</span>Continue with Google</button>
          <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-ink-400"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
        </>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode !== "update-password" && (
          <label className="block text-sm font-semibold text-ink-700">
            Email address
            <input
              required
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 min-h-14 w-full rounded-xl border border-border-strong bg-white px-4 text-base text-ink-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        )}

        {mode !== "recover" && (
          <label className="block text-sm font-semibold text-ink-700">
            {mode === "update-password" ? "New password" : "Password"}
            <input
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 min-h-14 w-full rounded-xl border border-border-strong bg-white px-4 text-base text-ink-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        )}

        {(mode === "register" || mode === "update-password") && (
          <label className="block text-sm font-semibold text-ink-700">
            Confirm password
            <input
              required
              minLength={8}
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 min-h-14 w-full rounded-xl border border-border-strong bg-white px-4 text-base text-ink-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        )}

        <button
          disabled={busy}
          className="brand-gradient min-h-14 w-full rounded-xl px-5 font-bold text-white disabled:opacity-60"
        >
          {busy ? "Working…" : submitLabel(mode)}
        </button>
      </form>

      {mode === "login" && (
        <button type="button" onClick={() => switchMode("recover")} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-600">
          <KeyRound size={16} aria-hidden /> Forgot password?
        </button>
      )}
      {mode === "recover" && (
        <button type="button" onClick={() => switchMode("login")} className="mt-4 text-sm font-semibold text-cyan-600">
          Back to sign in
        </button>
      )}

      {mode === "register" && (
        <p className="mt-4 flex gap-2 text-xs leading-relaxed text-ink-500">
          <Mail size={16} className="mt-0.5 shrink-0" aria-hidden />
          If you already made a passport anonymously on this device, registration
          upgrades that same identity so its records stay attached.
        </p>
      )}
      {message && <p className="mt-4 text-sm leading-relaxed text-ink-600" role="status">{message}</p>}
      {error && <p className="mt-4 text-sm leading-relaxed text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
    </section>
  );
}

function ModeButton({ active, onClick, icon: Icon, children }: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-lg px-3 font-semibold ${active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"}`}
    >
      <Icon size={17} className="me-2 inline" aria-hidden />
      {children}
    </button>
  );
}

function submitLabel(mode: Mode) {
  if (mode === "login") return "Sign in to my passport";
  if (mode === "register") return "Create my account";
  if (mode === "recover") return "Email me a reset link";
  return "Update password";
}

function accountReturnUrl(locale: string, destination: "care" | "portal" = "care") {
  const url = new URL(`/${locale}/account`, window.location.origin);
  url.searchParams.set("oauth", "1");
  url.searchParams.set("next", destination);
  return url.toString();
}

function confirmationReturnUrl(locale: string, destination: "care" | "portal") {
  const url = new URL(`/${locale}/auth/confirmed`, window.location.origin);
  url.searchParams.set("next", destination);
  return url.toString();
}

function passwordResetReturnUrl(locale: string) {
  return new URL(`/${locale}/account`, window.location.origin).toString();
}

function readReturnPath(locale: string): string | null {
  try {
    const value = window.sessionStorage.getItem(AUTH_RETURN_KEY);
    return value && new RegExp(`^/${locale}/portal/[A-Za-z0-9_-]{36,43}$`).test(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

function followReturnPath(path: string) {
  try { window.sessionStorage.removeItem(AUTH_RETURN_KEY); } catch { /* storage may be blocked */ }
  window.location.assign(path);
}
