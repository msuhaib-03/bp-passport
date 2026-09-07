import { NextResponse } from "next/server";

function allowedOrigin(): string | null {
  return process.env.WEB_ORIGIN ?? null;
}

export function corsHeaders(): HeadersInit {
  const origin = allowedOrigin();
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

export function withCors(response: NextResponse): NextResponse {
  const headers = corsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function corsOptions(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
