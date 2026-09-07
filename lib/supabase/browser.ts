import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  client ??= createClient(url, anonKey);
  return client;
}

export async function ensureAnonymousSession(): Promise<{
  client: SupabaseClient;
  userId: string;
  accessToken: string;
} | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user) {
    return {
      client: supabase,
      userId: existing.data.session.user.id,
      accessToken: existing.data.session.access_token,
    };
  }

  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.user || !signedIn.data.session) return null;
  return {
    client: supabase,
    userId: signedIn.data.user.id,
    accessToken: signedIn.data.session.access_token,
  };
}
