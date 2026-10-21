import type { BpReading } from "./clinical/bp-classification";
import { assess } from "./clinical/bp-classification";
import { guard, type Locale } from "./clinical/drap-guardrail";
import { EMERGENCY_CONTACTS, triage } from "./clinical/triage";

export interface AssistantContext {
  latestReading?: BpReading | null;
  hasMedicationReminder?: boolean;
  screen?: string;
}

export interface AssistantReply {
  text: string;
  urgent: boolean;
  provider: "local" | "gemini" | "groq" | "anthropic";
}

export function emergencyReply(locale: Locale): string {
  if (locale === "ur") {
    return `یہ ہنگامی حالت ہو سکتی ہے۔ ابھی ${EMERGENCY_CONTACTS.rescue} پر کال کریں یا قریب ترین ایمرجنسی میں جائیں۔ خود گاڑی نہ چلائیں۔`;
  }
  return `This may be an emergency. Call Rescue ${EMERGENCY_CONTACTS.rescue} now or go to the nearest emergency department. Do not drive yourself.`;
}

export function localAssistantReply(
  message: string,
  locale: Locale,
  context: AssistantContext = {},
): AssistantReply {
  const urgent = triage(message, context.latestReading);
  if (urgent.isEmergency) {
    return { text: emergencyReply(locale), urgent: true, provider: "local" };
  }

  const query = message.toLowerCase();
  let text: string;

  if (locale === "ur") {
    if (query.includes("report") || query.includes("رپورٹ")) {
      text = "رپورٹس میں آپ کی محفوظ شدہ ریڈنگز کا 14 دن کا خلاصہ ہے۔ اسے پرنٹ یا اپنے ڈاکٹر کے ساتھ محفوظ طریقے سے شیئر کیا جا سکتا ہے۔";
    } else if (query.includes("medicine") || query.includes("دوا")) {
      text = "میں دوا منتخب یا خوراک تبدیل نہیں کر سکتا۔ صرف ڈاکٹر کی تجویز کردہ دوا کے لیے یاد دہانی بنائیں، اور تبدیلی کے لیے اپنے ڈاکٹر یا فارماسسٹ سے بات کریں۔";
    } else if (query.includes("food") || query.includes("salt") || query.includes("کھانا") || query.includes("نمک")) {
      text = "آج ایک چھوٹا قدم آزمائیں: پیکٹ والے نمکین کھانے کی جگہ تازہ کھانا لیں اور میز پر اضافی نمک نہ رکھیں۔";
    } else if (context.latestReading) {
      const result = assess(context.latestReading);
      text = `آپ کی تازہ ریڈنگ ${result.systolic}/${result.diastolic} ہے۔ یہ ایک ریڈنگ ہے، تشخیص نہیں۔ پرسکون ہو کر دوبارہ درست طریقے سے ناپیں اور بار بار بلند ریڈنگز ڈاکٹر کو دکھائیں۔`;
    } else {
      text = "پہلا مفید قدم بلڈ پریشر کی ریڈنگ محفوظ کرنا ہے۔ اگر ابھی مشین دستیاب نہیں تو مختصر صحت چیک مکمل کریں۔";
    }
  } else if (query.includes("report") || query.includes("doctor")) {
    text = "Open Reports for a real 14-day summary of your saved readings. You can print it or use the existing secure clinician-sharing flow when your account is connected.";
  } else if (query.includes("medicine") || query.includes("dose") || query.includes("tablet")) {
    text = "I can help you remember medicine already prescribed to you, but I cannot choose a medicine or change a dose. Ask your doctor or pharmacist before making changes.";
  } else if (query.includes("food") || query.includes("eat") || query.includes("salt")) {
    text = "Try one small step today: choose a fresh meal instead of a packaged salty one, and leave extra table salt off the plate.";
  } else if (query.includes("walk") || query.includes("exercise") || query.includes("active")) {
    text = "If you feel well and your clinician has not limited activity, a comfortable 10-minute walk is a practical small step. Stop and seek help for chest pain, severe breathlessness, or fainting.";
  } else if (context.latestReading) {
    const result = assess(context.latestReading);
    text = `Your latest saved reading is ${result.systolic}/${result.diastolic}. That is one measurement, not a diagnosis. Repeat it calmly with good technique and show repeated high readings to a clinician.`;
  } else {
    text = "Your most useful next step is to save a blood-pressure reading. If you do not have a cuff now, complete the short health check first.";
  }

  return { text: guard(text, locale).text, urgent: false, provider: "local" };
}
