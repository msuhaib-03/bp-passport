"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { useRouter } from "@/lib/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ConfirmationLanding({ destination }: { destination: "care" | "portal" }) {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    let active = true;
    async function finish() {
      const client = getSupabaseBrowserClient();
      if (!client) {
        if (active) setMessage("Account service is not configured.");
        return;
      }
      const session = await client.auth.getSession();
      if (session.data.session) await client.auth.signOut({ scope: "local" });
      if (active) router.replace(`/account?confirmed=1&next=${destination}`);
    }
    void finish();
    return () => { active = false; };
  }, [destination, router]);

  return <section className="card p-8 text-center"><CheckCircle2 size={44} className="mx-auto text-cyan-600" /><h1 className="mt-5 text-2xl font-bold text-ink-900">Email confirmation</h1><p className="mt-3 text-ink-600" role="status">{message}</p></section>;
}
