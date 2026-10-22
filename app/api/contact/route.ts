import { z } from "zod";

const ContactRequest = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(20).max(3000),
  website: z.string().max(200).optional().default(""),
});

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 10_000) return Response.json({ error: "Message is too large." }, { status: 413 });

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
    } catch {
      return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
  }

  const raw = await request.json().catch(() => null);
  const parsed = ContactRequest.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Please check the highlighted fields and try again." }, { status: 400 });

  // Quietly accept bot-filled honeypots without delivering them.
  if (parsed.data.website) return Response.json({ delivered: true }, { status: 202 });

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.CONTACT_EMAIL;
  const sender = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !recipient || !sender) {
    return Response.json(
      { error: "Direct email is not configured yet. Please contact a founder through LinkedIn below." },
      { status: 503 },
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      reply_to: parsed.data.email,
      subject: `[BP Passport] ${parsed.data.subject.replace(/[\r\n]+/g, " ")}`,
      text: `Name: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\n${parsed.data.message}`,
    }),
  }).catch(() => null);

  if (!response?.ok) return Response.json({ error: "Message delivery is temporarily unavailable. Please use LinkedIn below." }, { status: 502 });
  return Response.json({ delivered: true }, { status: 201 });
}
