import { ensureAnonymousSession, getSupabaseBrowserClient } from "./browser";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getAccessToken(options?: {
  allowAnonymous?: boolean;
}): Promise<string | null> {
  if (options?.allowAnonymous !== false) {
    return (await ensureAnonymousSession())?.accessToken ?? null;
  }
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || data.session.user.is_anonymous) return null;
  return data.session.access_token;
}

export async function apiJson<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
    allowAnonymous?: boolean;
  } = {},
): Promise<T> {
  const accessToken = await getAccessToken({ allowAnonymous: options.allowAnonymous });
  if (!accessToken) {
    throw new ApiError(
      options.allowAnonymous === false
        ? "Sign in with your account to continue."
        : "Cloud accounts are not configured.",
      401,
    );
  }

  const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}
