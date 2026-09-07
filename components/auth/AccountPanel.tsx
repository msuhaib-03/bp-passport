"use client";

import { FormEvent, useEffect, useState } from "react";
import { LogIn, LogOut, UserPlus } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AccountPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("Cloud accounts are not configured yet.");
      setBusy(false);
      return;
    }

    const current = await client.auth.getUser();
    const result = mode === "login"
      ? await client.auth.signInWithPassword({ email, password })
      : current.data.user?.is_anonymous
        ? await client.auth.updateUser({ email, password })
        : await client.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "register") {
      setMessage("Account created. Check your email if confirmation is required, then use your passport.");
    } else {
      setMessage("You are signed in. Your passport can now follow you across devices.");
    }
    setBusy(false);
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    await client.auth.signOut();
    setMessage("Signed out. This device can still use offline mode.");
  }

  if (userEmail) {
    return (
      <section className="card p-6">
        <p className="text-sm font-semibold text-ink-500">Signed in</p>
        <p className="mt-1 text-lg font-bold text-ink-900">{userEmail}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-5 inline-flex min-h-14 items-center gap-2 rounded-xl border border-border-strong px-5 font-semibold text-ink-700 hover:bg-ink-50"
        >
          <LogOut size={18} aria-hidden />
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`min-h-12 flex-1 rounded-lg px-3 font-semibold ${mode === "login" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"}`}
        >
          <LogIn size={17} className="me-2 inline" aria-hidden />
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`min-h-12 flex-1 rounded-lg px-3 font-semibold ${mode === "register" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"}`}
        >
          <UserPlus size={17} className="me-2 inline" aria-hidden />
          Register
        </button>
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-ink-700">
          Email address
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 min-h-14 w-full rounded-xl border border-border-strong bg-white px-4 text-base text-ink-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
        <label className="block text-sm font-semibold text-ink-700">
          Password
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 min-h-14 w-full rounded-xl border border-border-strong bg-white px-4 text-base text-ink-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
        <button
          disabled={busy}
          className="brand-gradient min-h-14 w-full rounded-xl px-5 font-bold text-white disabled:opacity-60"
        >
          {busy ? "Working..." : mode === "login" ? "Sign in to my passport" : "Create my account"}
        </button>
      </form>
      {message && <p className="mt-4 text-sm leading-relaxed text-ink-600" role="status">{message}</p>}
    </section>
  );
}
