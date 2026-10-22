"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import { useRouter } from "@/lib/i18n/navigation";

type Fields = { name: string; email: string; subject: string; message: string; website: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const INITIAL_FIELDS: Fields = { name: "", email: "", subject: "", message: "", website: "" };

export function ContactForm({ locale }: { locale: string }) {
  const ur = locale === "ur";
  const router = useRouter();
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const labels = ur ? {
    name: "نام", email: "ای میل", subject: "موضوع", message: "پیغام",
    nameHint: "آپ کا پورا نام", subjectHint: "ہم کس بارے میں مدد کر سکتے ہیں؟",
    messageHint: "براہِ کرم طبی یا ذاتی صحت کی معلومات شامل نہ کریں۔",
    send: "پیغام بھیجیں", sending: "بھیجا جا رہا ہے…",
    required: "یہ خانہ ضروری ہے۔", invalidEmail: "درست ای میل درج کریں۔",
    tooShort: "براہِ کرم کم از کم 20 حروف لکھیں۔",
    delivery: "پیغام اس وقت نہیں بھیجا جا سکا۔ نیچے موجود LinkedIn روابط سے رابطہ کریں۔",
  } : {
    name: "Name", email: "Email", subject: "Subject", message: "Message",
    nameHint: "Your full name", subjectHint: "How can we help?",
    messageHint: "Please do not include medical or personal health information.",
    send: "Send message", sending: "Sending…",
    required: "This field is required.", invalidEmail: "Enter a valid email address.",
    tooShort: "Please write at least 20 characters.",
    delivery: "Your message could not be delivered. Please use one of the LinkedIn contacts below.",
  };

  function update(field: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const next: FieldErrors = {};
    if (!fields.name.trim()) next.name = labels.required;
    if (!fields.email.trim()) next.email = labels.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) next.email = labels.invalidEmail;
    if (!fields.subject.trim()) next.subject = labels.required;
    if (!fields.message.trim()) next.message = labels.required;
    else if (fields.message.trim().length < 20) next.message = labels.tooShort;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    if (!validate()) return;
    setBusy(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || labels.delivery);
      router.push("/thank-you");
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : labels.delivery);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl border border-[#d6e7e1] bg-white p-5 shadow-[0_15px_45px_rgb(6_56_58/0.08)] sm:p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={labels.name} error={errors.name}>
          <input value={fields.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" maxLength={80} placeholder={labels.nameHint} aria-invalid={Boolean(errors.name)} className={inputClass(errors.name)} />
        </Field>
        <Field label={labels.email} error={errors.email}>
          <input value={fields.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" inputMode="email" type="email" maxLength={160} aria-invalid={Boolean(errors.email)} className={inputClass(errors.email)} />
        </Field>
      </div>
      <div className="mt-5">
        <Field label={labels.subject} error={errors.subject}>
          <input value={fields.subject} onChange={(event) => update("subject", event.target.value)} maxLength={120} placeholder={labels.subjectHint} aria-invalid={Boolean(errors.subject)} className={inputClass(errors.subject)} />
        </Field>
      </div>
      <div className="mt-5">
        <Field label={labels.message} error={errors.message} hint={labels.messageHint}>
          <textarea value={fields.message} onChange={(event) => update("message", event.target.value)} rows={6} maxLength={3000} aria-invalid={Boolean(errors.message)} className={`${inputClass(errors.message)} py-3`} />
        </Field>
      </div>
      <label className="absolute -start-[9999px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(event) => update("website", event.target.value)} /></label>
      <button type="submit" disabled={busy} className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#078679] px-6 font-extrabold text-white shadow-lg shadow-[#078679]/15 disabled:cursor-wait disabled:opacity-65 sm:w-auto">
        {busy ? <LoaderCircle size={19} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
        {busy ? labels.sending : labels.send}
      </button>
      {serverError && <p className="mt-4 rounded-xl bg-[#fce6e2] p-3 text-sm text-[#7a2113]" role="alert">{serverError}</p>}
    </form>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[#214b48]">
      {label}
      <span className="mt-2 block">{children}</span>
      {hint && <span className="mt-2 block text-xs font-normal leading-5 text-[#6d817d]">{hint}</span>}
      {error && <span className="mt-2 block text-xs font-semibold text-[#8a2e20]" role="alert">{error}</span>}
    </label>
  );
}

function inputClass(error?: string) {
  return `min-h-14 w-full rounded-xl border bg-white px-4 text-base text-[#07383a] outline-none transition focus:border-[#078679] focus:ring-2 focus:ring-[#c7eee7] ${error ? "border-[#cf4430]" : "border-[#bcd3cd]"}`;
}
