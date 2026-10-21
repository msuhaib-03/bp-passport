"use client";

import Image from "next/image";
import { FormEvent, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Mic,
  Printer,
  Send,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import { BpEntry } from "@/components/audit/BpEntry";
import { SharePanel } from "@/components/passport/SharePanel";
import { WhatsAppShareButton } from "@/components/passport/WhatsAppShareButton";
import { Link } from "@/lib/i18n/navigation";
import { careText, type CareLocale } from "@/lib/care-copy";
import { type CareState, todayKey } from "@/lib/care";
import { assess, summariseSeries, type BpReading } from "@/lib/clinical/bp-classification";
import { calculateHeartScore } from "@/lib/clinical/heart-score";
import { appendReading, currentStreak, type Passport } from "@/lib/storage";
import { isCloudPersistenceConfigured, syncReading } from "@/lib/supabase/persistence";

import styles from "./heartline-care.module.css";

export type CareAppView = "home" | "health" | "medicines" | "reports" | "caregiver" | "assistant";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  urgent?: boolean;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

function categoryText(category: ReturnType<typeof assess>["category"], locale: CareLocale): string {
  const labels = {
    optimal: "Optimal range",
    normal: "Normal range",
    high_normal: "High-normal range",
    grade_1: "Grade 1 range",
    grade_2: "Grade 2 range",
  } as const;
  return careText(locale, labels[category]);
}

export function CareHomeView({ locale, care, passport, setView }: { locale: CareLocale; care: CareState; passport: Passport | null; setView: (view: CareAppView) => void }) {
  const t = (text: string) => careText(locale, text);
  const latest = passport?.readings.at(-1);
  const medicineDue = care.medications.find((item) => item.active && item.checkedOn !== todayKey());
  const score = passport ? calculateHeartScore(passport.answers, latest) : null;
  const streak = currentStreak(passport?.readings ?? []);
  const hour = new Date().getHours();
  const greeting = locale === "ur" ? (hour < 12 ? "صبح بخیر" : hour < 18 ? "دوپہر بخیر" : "شام بخیر") : `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}`;
  const needsReview = latest ? assess(latest).urgency !== "routine" : false;

  return (
    <>
      <h1 className={styles.pageTitle}>{greeting}, {care.displayName || t("Patient")}.</h1>
      <p className={styles.subtle} style={{ marginTop: ".45rem" }}>{t("Let's take care of your heart today.")}</p>
      <section className={styles.heroCard}>
        <p className={styles.eyebrow} style={{ color: "#c8eee7" }}>{t("Your next step")}</p>
        <h2>{t(latest ? "Keep your BP diary current." : "Your first BP check is ready.")}</h2>
        <p>{t(latest ? "A fresh reading helps your real trend stay useful." : "It only takes a few minutes. I'll guide you calmly through each step.")}</p>
        <button className={styles.whiteButton} onClick={() => setView("health")}>{t(latest ? "Add today's reading" : "Start BP check")}<ChevronRight size={17} /></button>
      </section>

      <div className={styles.statGrid}>
        <section className={styles.card}><p className={styles.subtle}>{t("Heart Score")}</p><p className={styles.metric}>{score?.score ?? "—"}<small>/100</small></p><p className={styles.subtle}>{t("Lifestyle guide, not a diagnosis")}</p></section>
        <section className={styles.card}><p className={styles.subtle}>{t("Logging streak")}</p><p className={styles.metric}>{streak} <small>{t("days")}</small></p><p className={styles.subtle}>{t("Keep your diary current")}</p></section>
        <section className={styles.card}><p className={styles.subtle}>{t("Latest reading")}</p><p className={styles.metric}>{latest ? `${latest.systolic}/${latest.diastolic}` : "—"}</p><p className={styles.subtle}>{latest ? categoryText(assess(latest).category, locale) : t("No blood-pressure reading saved yet.")}</p></section>
      </div>

      {needsReview && <section className={styles.urgent}><strong>{t("Discuss promptly")}</strong><p>{t("A Grade 2 or crisis-range reading needs prompt clinical review. Call 1122 for severe symptoms.")}</p></section>}

      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}><div><h2>{t("Today's care tickets")}</h2><p className={styles.subtle}>{t("Simple actions, in the right order.")}</p></div><span className={styles.iconBadge}><ClipboardCheck size={20} /></span></div>
          <div className={styles.ticketList}>
            <button className={styles.ticket} onClick={() => setView("health")}><span className={styles.dot} /><span><strong>{t("Check your BP")}</strong><small>{t(latest ? "Keep your diary current" : "Due now · takes 2 minutes")}</small></span><ChevronRight size={17} style={{ marginInlineStart: "auto" }} /></button>
            {medicineDue && <button className={styles.ticket} onClick={() => setView("medicines")}><span className={styles.dot} /><span><strong>{t("Prescribed medicine reminder")}</strong><small>{medicineDue.schedule}</small></span><ChevronRight size={17} style={{ marginInlineStart: "auto" }} /></button>}
            <button className={styles.ticket} onClick={() => setView("reports")}><span className={styles.dot} style={{ background: "#6eb7a9" }} /><span><strong>{t("Review your progress")}</strong><small>{t("Your real saved readings")}</small></span><ChevronRight size={17} style={{ marginInlineStart: "auto" }} /></button>
          </div>
        </section>
        <section className={styles.card}><div className={styles.cardHead}><div><h2>{t("Heart health")}</h2><p className={styles.subtle}>{t("How your plan looks today.")}</p></div><span className={styles.iconBadge}><HeartPulse size={20} /></span></div><span className={styles.status}><Check size={14} /> {t("Your data is ready")}</span><p className={styles.metric}>{latest ? `${latest.systolic}/${latest.diastolic}` : t("Start with a reading")}</p><p className={styles.subtle}>{latest ? `${categoryText(assess(latest).category, locale)} · ${locale === "ur" ? "تشخیص نہیں" : "not a diagnosis"}` : t("No blood-pressure reading saved yet.")}</p></section>
      </div>
    </>
  );
}

export function CareHealthView({ locale, passport, setPassport }: { locale: CareLocale; passport: Passport | null; setPassport: (passport: Passport | null) => void }) {
  const t = (text: string) => careText(locale, text);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [habits, setHabits] = useState({ tookMeds: false, lowSalt: false, walked: false });

  async function save(reading: BpReading | null) {
    if (!reading) { setAdding(false); return; }
    const logged = { ...reading, ...habits, clientId: crypto.randomUUID(), at: new Date().toISOString(), takenAtTime: "random" as const };
    const updated = appendReading(logged);
    if (!updated) { setMessage(t("Create your BP Passport with the heart audit before saving readings.")); return; }
    setPassport(updated);
    setAdding(false);
    setHabits({ tookMeds: false, lowSalt: false, walked: false });
    setMessage(t("Reading saved on this device."));
    if (isCloudPersistenceConfigured()) void syncReading(logged).catch(() => setMessage(t("Saved on this device. Cloud sync will retry when your account is available.")));
  }

  return <><div className={styles.sectionHead}><h1>{t("My health")}</h1><p className={styles.subtle}>{t("Your measurements stay in the existing BP Passport diary.")}</p></div>{!passport ? <div className={styles.empty}>{t("Complete the existing heart audit to create your BP Passport before logging readings.")}<div className={styles.rowActions}><Link className={styles.primary} href="/audit">{t("Start heart audit")}</Link></div></div> : <><section className={`${styles.card} ${styles.formCard}`}><div className={styles.cardHead}><div><h2>{t("Blood-pressure diary")}</h2><p className={styles.subtle}>{passport.readings.length} {locale === "ur" ? "محفوظ ریڈنگز" : `saved reading${passport.readings.length === 1 ? "" : "s"}`}</p></div><span className={styles.iconBadge}><Activity size={20} /></span></div>{adding ? <div style={{ marginTop: "1rem" }}><p className={styles.subtle} style={{ marginBottom: "1rem" }}>{t("Sit quietly for five minutes, support your arm, and keep both feet flat.")}</p><h3>{t("Today's habits")}</h3><div className={styles.habitGrid}>{([['tookMeds', 'Took prescribed medicine'], ['lowSalt', 'Kept salt low'], ['walked', 'Walked 20+ minutes']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={habits[key]} className={`${styles.habitButton} ${habits[key] ? styles.habitActive : ""}`} onClick={() => setHabits((current) => ({ ...current, [key]: !current[key] }))}><Check size={16} />{t(label)}</button>)}</div><BpEntry onSubmit={(value) => void save(value)} /></div> : <button className={styles.primary} style={{ marginTop: "1rem" }} onClick={() => setAdding(true)}>{t("Add a BP reading")}</button>}{message && <p className={styles.note}>{message}</p>}</section><section className={styles.card} style={{ marginTop: "1rem" }}><h2>{t("Recent readings")}</h2><div className={styles.readingList}>{[...passport.readings].reverse().slice(0, 10).map((reading) => <div className={styles.reading} key={reading.clientId}><span>{new Date(reading.at).toLocaleString(locale === "ur" ? "ur-PK" : "en-PK")}</span><strong>{reading.systolic}/{reading.diastolic}</strong></div>)}</div></section></>}</>;
}

export function CareMedicinesView({ locale, care, updateCare }: { locale: CareLocale; care: CareState; updateCare: (change: Partial<CareState>) => void }) {
  const t = (text: string) => careText(locale, text);
  const [label, setLabel] = useState("");
  const [schedule, setSchedule] = useState("8:00 AM");
  function add(event: FormEvent) { event.preventDefault(); if (!label.trim()) return; updateCare({ medications: [...care.medications, { id: crypto.randomUUID(), label: label.trim(), schedule: schedule.trim(), active: true }] }); setLabel(""); }
  return <><div className={styles.sectionHead}><h1>{t("Medicines")}</h1><p className={styles.subtle}>{t("Reminders for medicine already prescribed to you. BP Passport never recommends or changes treatment.")}</p></div><form className={`${styles.card} ${styles.formCard}`} onSubmit={add}><h2>{t("Add a prescribed reminder")}</h2><label className={styles.field}>{t("Label from your prescription")}<input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder={t("e.g. Morning tablet")} /></label><label className={styles.field}>{t("When do you take it?")}<input value={schedule} maxLength={40} onChange={(event) => setSchedule(event.target.value)} /></label><button className={styles.primary} style={{ marginTop: "1rem" }}>{t("Add reminder")}</button></form><section className={styles.card} style={{ marginTop: "1rem" }}><h2>{t("Your reminders")}</h2>{care.medications.length === 0 ? <div className={styles.empty}>{t("No reminders yet.")}</div> : care.medications.map((item) => <div className={styles.checkRow} key={item.id}><div><strong>{item.label}</strong><p className={styles.subtle}>{item.schedule}{item.checkedOn === todayKey() ? (locale === "ur" ? " · آج مکمل" : " · checked today") : ""}</p></div><button className={styles.textButton} onClick={() => updateCare({ medications: care.medications.map((entry) => entry.id === item.id ? { ...entry, checkedOn: entry.checkedOn === todayKey() ? undefined : todayKey() } : entry) })}>{t(item.checkedOn === todayKey() ? "Undo" : "Mark taken")}</button></div>)}</section></>;
}

export function CareReportsView({ locale, passport }: { locale: CareLocale; passport: Passport | null }) {
  const t = (text: string) => careText(locale, text);
  const [referenceTime] = useState(() => Date.now());
  const recent = passport?.readings.filter((reading) => referenceTime - new Date(reading.at).getTime() <= 14 * 86400000) ?? [];
  const summary = summariseSeries(recent);
  const percentage = (key: "tookMeds" | "lowSalt" | "walked") => recent.length ? `${Math.round(recent.filter((item) => item[key]).length / recent.length * 100)}%` : t("Not tracked yet");
  const report = summary ? `BP Passport · 14-day report\nAverage: ${summary.meanSystolic}/${summary.meanDiastolic} mmHg\nReadings: ${summary.count}\nSystolic trend: ${summary.systolicTrend > 0 ? "+" : ""}${summary.systolicTrend} mmHg\nCategory: ${categoryText(summary.category, locale)}\n\nShared by the patient. This report is not a diagnosis.` : "BP Passport report: no readings are available yet.";
  return <><div className={styles.sectionHead}><h1>{t("Your report")}</h1><p className={styles.subtle}>{t("A real 14-day summary from this BP Passport.")}</p></div><section className={styles.card}><div className={styles.cardHead}><div><h2>{t("Blood-pressure summary")}</h2><p className={styles.subtle}>{t("Last 14 days")}</p></div><span className={styles.iconBadge}><FileText size={20} /></span></div>{summary ? <div className={styles.grid2}><div><p className={styles.subtle}>{t("Average")}</p><p className={styles.metric}>{summary.meanSystolic}/{summary.meanDiastolic}</p><p className={styles.subtle}>{categoryText(summary.category, locale)} · {summary.count}</p></div><div><p className={styles.subtle}>{t("Systolic trend")}</p><p className={styles.metric}>{summary.systolicTrend > 0 ? "+" : ""}{summary.systolicTrend} <small>mmHg</small></p><p className={styles.subtle}>{t("A trend needs several consistent readings.")}</p></div></div> : <div className={styles.empty}>{t("Add readings over time to build your report.")}</div>}<h2 style={{ marginTop: "1.25rem" }}>{t("Daily progress")}</h2><div className={styles.statGrid}><div><p className={styles.subtle}>{t("Medication")}</p><strong>{percentage("tookMeds")}</strong></div><div><p className={styles.subtle}>{t("Low salt")}</p><strong>{percentage("lowSalt")}</strong></div><div><p className={styles.subtle}>{t("Movement")}</p><strong>{percentage("walked")}</strong></div></div><div className={styles.rowActions}><button className={styles.primary} onClick={() => window.print()}><Printer size={17} /> {t("Print / save PDF")}</button><WhatsAppShareButton report={report} label={t("Share report on WhatsApp")} /><Link className={styles.secondary} href="/passport">{t("Open full Passport")}</Link></div></section><SharePanel enabled={Boolean(passport && isCloudPersistenceConfigured())} /></>;
}

export function CareCaregiverView({ locale, care, updateCare }: { locale: CareLocale; care: CareState; updateCare: (change: Partial<CareState>) => void }) {
  const t = (text: string) => careText(locale, text);
  const [draft, setDraft] = useState(care.caregiver);
  const permissions = draft.permissions;
  function toggle(key: keyof typeof permissions) { setDraft((current) => ({ ...current, permissions: { ...current.permissions, [key]: !current.permissions[key] } })); }
  return <><div className={styles.sectionHead}><h1>{t("Caregiver")}</h1><p className={styles.subtle}>{t("Choose what a trusted person may see. No messages are sent automatically.")}</p></div><section className={`${styles.card} ${styles.formCard}`}><div className={styles.cardHead}><div><h2>{t("Your care circle")}</h2><p className={styles.subtle}>{t("Saved on this device until cloud invitations are configured.")}</p></div><span className={styles.iconBadge}><Users size={20} /></span></div><div className={styles.heroImage} style={{ aspectRatio: "16 / 7", marginTop: "1rem" }}><Image src="/heartline-care-circle.png" fill sizes="(max-width: 720px) 92vw, 520px" alt="" /></div><label className={styles.field}>{t("Name")}<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className={styles.field}>{t("Relationship")}<input value={draft.relationship} onChange={(event) => setDraft({ ...draft, relationship: event.target.value })} placeholder={t("Family member, friend…")} /></label>{([['readings', 'See BP readings'], ['reminders', 'See reminder status'], ['reports', 'See reports']] as const).map(([key, label]) => <div className={styles.checkRow} key={key}><span>{t(label)}</span><button type="button" aria-label={t(label)} aria-pressed={permissions[key]} className={`${styles.toggle} ${permissions[key] ? styles.toggleOn : ""}`} onClick={() => toggle(key)} /></div>)}<button className={styles.primary} style={{ marginTop: "1rem" }} onClick={() => updateCare({ caregiver: draft })}>{t("Save permissions")}</button></section></>;
}

export function CareDoctorView({ locale, passport }: { locale: CareLocale; passport: Passport | null }) {
  const t = (text: string) => careText(locale, text);
  return <><div className={styles.sectionHead}><h1>{t("Doctor")}</h1><p className={styles.subtle}>{t("Use the existing verified-clinician portal and consent-controlled sharing.")}</p></div><div className={styles.grid2}><section className={styles.card}><span className={styles.iconBadge}><Stethoscope size={20} /></span><h2 style={{ marginTop: "1rem" }}>{t("Patient sharing")}</h2><p className={styles.subtle} style={{ marginTop: ".4rem" }}>{t("Open your Passport to share with a verified clinician by PMDC number. You can revoke access at any time.")}</p><div className={styles.rowActions}><Link href="/passport" className={styles.primary}>{t("Open my Passport")}</Link></div></section><section className={styles.card}><span className={styles.iconBadge}><UserRound size={20} /></span><h2 style={{ marginTop: "1rem" }}>{t("Clinician workspace")}</h2><p className={styles.subtle} style={{ marginTop: ".4rem" }}>{t("Clinicians sign in separately to review patients who have granted access.")}</p><div className={styles.rowActions}><Link href="/portal" className={styles.secondary}>{t("Clinician portal")}</Link></div></section></div>{!passport && <div className={styles.empty}>{t("Create a Passport first so there is a record to share.")}</div>}</>;
}

export function CareProgrammeView({ locale, passport, care }: { locale: CareLocale; passport: Passport | null; care: CareState }) {
  const t = (text: string) => careText(locale, text);
  return <><div className={styles.sectionHead}><h1>{t("Programme view")}</h1><p className={styles.subtle}>{t("Transparent device-level counts—not fictional population metrics.")}</p></div><div className={styles.grid2}><section className={styles.card}><p className={styles.subtle}>{t("Readings saved")}</p><p className={styles.metric}>{passport?.readings.length ?? 0}</p></section><section className={styles.card}><p className={styles.subtle}>{t("Care reminders")}</p><p className={styles.metric}>{care.medications.length}</p></section></div><section className={styles.card} style={{ marginTop: "1rem" }}><h2>{t("Clinical operations")}</h2><p className={styles.subtle} style={{ marginTop: ".4rem" }}>{t("The existing admin verification queue remains protected by the server-side admin token.")}</p><div className={styles.rowActions}><Link href="/admin" className={styles.primary}>{t("Open admin review")}</Link><Link href="/account" className={styles.secondary}>{t("Account & sync")}</Link></div></section></>;
}

export function CareAssistantPanel({ locale, latest, hasMedicationReminder, expanded = false }: { locale: CareLocale; latest: BpReading | null; hasMedicationReminder: boolean; expanded?: boolean }) {
  const t = (text: string) => careText(locale, text);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "welcome", role: "assistant", text: t(latest ? "I can see your latest saved BP reading. Ask what it means or what to do next." : "I'm here to help with your next heart-health step. You can type or speak.") }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; timeout: number } | null>(null);
  const provider = t(messages.length > 1 ? "Safety-screened assistant" : "Always with you");

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput(""); setBusy(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: clean }]);
    try {
      const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
      const response = await fetch(`${apiOrigin}/api/v1/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, locale, context: { latestReading: latest ? { systolic: latest.systolic, diastolic: latest.diastolic } : null, hasMedicationReminder } }) });
      const payload = await response.json() as { text?: string; urgent?: boolean; error?: string };
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: payload.text ?? payload.error ?? t("I couldn't answer just now. Please try again."), urgent: payload.urgent }]);
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: t("I couldn't reach the assistant. Your saved readings and reminders still work offline.") }]);
    } finally { setBusy(false); }
  }

  function addVoiceError(text: string) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: t(text) }]);
  }

  function stopRecorder() {
    const active = recorderRef.current;
    if (!active) return;
    window.clearTimeout(active.timeout);
    if (active.recorder.state !== "inactive") active.recorder.stop();
  }

  async function startRecorder() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      addVoiceError("Voice input is not supported by this browser. You can still type your question.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferred });
      const active = { recorder, stream, chunks: [] as Blob[], timeout: 0 };
      recorderRef.current = active;
      recorder.ondataavailable = (event) => { if (event.data.size) active.chunks.push(event.data); };
      recorder.onerror = () => { addVoiceError("Microphone access was blocked. Allow microphone access and try again."); };
      recorder.onstop = async () => {
        active.stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        setListening(false);
        const audio = new Blob(active.chunks, { type: recorder.mimeType || "audio/webm" });
        if (!audio.size) return;
        setBusy(true);
        try {
          const form = new FormData();
          form.append("audio", audio, "question.webm");
          form.append("locale", locale);
          const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
          const response = await fetch(`${apiOrigin}/api/v1/assistant/transcribe`, { method: "POST", body: form });
          const payload = await response.json() as { transcript?: string; error?: string };
          if (!response.ok || !payload.transcript) throw new Error(payload.error || "Transcription failed");
          setBusy(false);
          setInput(payload.transcript);
          await send(payload.transcript);
        } catch {
          setBusy(false);
          addVoiceError("I couldn't answer just now. Please try again.");
        }
      };
      setListening(true);
      recorder.start(250);
      active.timeout = window.setTimeout(stopRecorder, 25_000);
    } catch {
      addVoiceError("Microphone access was blocked. Allow microphone access and try again.");
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      stopRecorder();
      setListening(false);
      return;
    }
    const target = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SpeechCtor = target.SpeechRecognition ?? target.webkitSpeechRecognition;
    if (!SpeechCtor) { void startRecorder(); return; }
    const recognition = new SpeechCtor();
    recognition.lang = locale === "ur" ? "ur-PK" : "en-PK";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript ?? ""; setInput(transcript); void send(transcript); };
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => { setListening(false); if (event.error === "not-allowed" || event.error === "service-not-allowed") addVoiceError("Microphone access was blocked. Allow microphone access and try again."); else void startRecorder(); };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const quickPrompts = ["What should I do next?", "My medicines", "What should I eat?", "My report"];
  return <div style={{ display: "flex", flexDirection: "column", height: expanded ? "30rem" : "100%" }}><div className={styles.assistantHead}><span className={styles.iconBadge}><Bot size={19} /></span><div><strong>{t("BP Passport assistant")}</strong><small>{provider}</small></div></div><div className={styles.assistantMessages} aria-live="polite">{messages.map((message) => <div key={message.id} className={`${styles.message} ${message.role === "user" ? styles.messageUser : ""} ${message.urgent ? styles.messageUrgent : ""}`}>{message.text}</div>)}{busy && <div className={styles.message}>{t("Thinking…")}</div>}{listening && <div className={styles.message}>{t("Listening… tap again to stop")}</div>}</div><div className={styles.quickRow}>{quickPrompts.map((prompt) => <button className={styles.quick} key={prompt} onClick={() => void send(t(prompt))}>{t(prompt)}</button>)}</div><form className={styles.assistantForm} onSubmit={(event) => { event.preventDefault(); void send(input); }}><input aria-label={t("Ask BP Passport")} value={input} maxLength={600} onChange={(event) => setInput(event.target.value)} placeholder={t("Ask or speak…")} /><button type="button" className={styles.iconButton} aria-label={t(listening ? "Stop listening" : "Speak your question")} aria-pressed={listening} onClick={toggleVoice}><Mic size={17} /></button><button className={styles.iconButton} aria-label={t("Send")} disabled={busy}><Send size={17} /></button></form><p className={styles.assistantMeta}>{t("Education only · emergencies screened first · configured AI providers receive the question and latest reading · call 1122 for urgent symptoms")}</p></div>;
}
