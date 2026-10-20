import { z } from "zod";

import { json } from "@/lib/api/context";
import { corsOptions } from "@/lib/api/cors";
import { emergencyReply, localAssistantReply } from "@/lib/assistant";
import { guard, type Locale } from "@/lib/clinical/drap-guardrail";
import { triage } from "@/lib/clinical/triage";

const inputSchema = z.object({
  message: z.string().trim().min(1).max(600),
  locale: z.enum(["en", "ur"]).default("en"),
  context: z.object({
    latestReading: z.object({ systolic: z.number().int(), diastolic: z.number().int() }).nullable().optional(),
    hasMedicationReminder: z.boolean().optional(),
    screen: z.string().max(40).optional(),
  }).default({}),
}).strict();

const SYSTEM_PROMPT = `You are HeartLine, a calm bilingual health education assistant for adults in Pakistan.
Keep replies under 90 words and give one practical next step. You may explain saved blood-pressure readings as measurements only.
Never diagnose a person, name or recommend a drug, change a dose, or replace a clinician. Do not claim monitoring or contact with a caregiver.
For medicine questions, only support remembering medicine already prescribed and advise speaking to a doctor or pharmacist about changes.
Reply in the requested language. Do not use markdown tables.`;

export function OPTIONS() {
  return corsOptions();
}

async function callGroq(message: string, locale: Locale, context: unknown): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!key || !model) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_completion_tokens: 180,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Language: ${locale}\nContext: ${JSON.stringify(context)}\nQuestion: ${message}` },
      ],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() || null;
}

async function callAnthropic(message: string, locale: Locale, context: unknown): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!key || !model) return null;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 180,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Language: ${locale}\nContext: ${JSON.stringify(context)}\nQuestion: ${message}` }],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  return payload.content?.find((part) => part.type === "text")?.text?.trim() || null;
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Please enter a shorter question." }, 400);
  }

  const { message, locale, context } = parsed.data;
  const emergency = triage(message, context.latestReading);
  if (emergency.isEmergency) {
    return json({ text: emergencyReply(locale), urgent: true, provider: "local" });
  }

  try {
    const groq = await callGroq(message, locale, context);
    if (groq) {
      return json({ text: guard(groq, locale).text, urgent: false, provider: "groq" });
    }
    const anthropic = await callAnthropic(message, locale, context);
    if (anthropic) {
      return json({ text: guard(anthropic, locale).text, urgent: false, provider: "anthropic" });
    }
  } catch {
    // Provider outages fall back to the deterministic coach below.
  }

  return json(localAssistantReply(message, locale, context));
}
