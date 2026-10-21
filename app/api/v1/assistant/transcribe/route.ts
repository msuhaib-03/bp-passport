import { json } from "@/lib/api/context";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "Voice transcription is not configured" }, 503);

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const locale = form?.get("locale") === "ur" ? "ur" : "en";
  if (!(audio instanceof Blob) || !audio.type.startsWith("audio/") || audio.size < 1 || audio.size > MAX_AUDIO_BYTES) {
    return json({ error: "Please record a shorter audio question" }, 400);
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: `Transcribe this spoken ${locale === "ur" ? "Urdu or mixed Urdu-English" : "English or mixed English-Urdu"} health question exactly. Return only the transcript, with no label, commentary, or answer.` },
          { inlineData: { mimeType: audio.type, data: base64 } },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 180 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return json({ error: "Voice transcription is temporarily unavailable" }, 502);
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const transcript = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!transcript) return json({ error: "No speech was detected" }, 422);
    return json({ transcript: transcript.slice(0, 600) });
  } catch {
    return json({ error: "Voice transcription is temporarily unavailable" }, 502);
  }
}
