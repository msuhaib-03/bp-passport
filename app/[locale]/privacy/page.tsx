import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How BP Passport handles accounts, blood-pressure records, clinician sharing, optional analytics, and your privacy choices.",
};

const ENGLISH: LegalSection[] = [
  {
    heading: "1. What this policy covers",
    paragraphs: ["This policy explains how BP Passport handles information when you use the public website, health check, patient workspace, clinician-sharing tools, AI assistant, or contact form. BP Passport is designed for users in Pakistan and follows a local-first approach wherever possible."],
  },
  {
    heading: "2. Information we handle",
    paragraphs: ["The information handled depends on which features you choose to use."],
    bullets: [
      "Health-check answers and blood-pressure readings needed to produce your on-screen guidance and history.",
      "Email address and authentication data when you choose to create an account.",
      "Clinician profile and patient-share information when a clinician or patient uses the sharing workflow.",
      "The text or voice transcript you intentionally send to the assistant.",
      "Name, email, subject, and message when you contact the product team. Do not include medical records in the contact form.",
      "Anonymous page path and a random browser identifier only when you opt in to analytics.",
    ],
  },
  {
    heading: "3. Local storage, accounts, and hosting",
    paragraphs: ["Core passport data can be kept in your browser. If cloud features are configured and you sign in, account and permitted records are stored through Supabase and its PostgreSQL service. Your hosting provider may process routine security logs such as IP address, timestamp, and user agent. Essential browser storage is required for sessions, preferences, offline use, and security."],
  },
  {
    heading: "4. Clinician sharing",
    paragraphs: ["A patient must intentionally create a time-limited share before a clinician can access that patient’s record. Shares can expire or be revoked. Pilot clinician access may include pending profiles while PMDC verification is unavailable; this status is shown in the product and must be replaced with verified-only access before a regulated production launch."],
  },
  {
    heading: "5. AI and voice features",
    paragraphs: ["Assistant prompts and voice transcripts may be sent to the AI provider configured by the deployment, such as Google Gemini. Emergency rules run before generative responses, but AI can still be wrong. Do not use the assistant for emergencies or as a replacement for a clinician. Voice recording starts only after you choose the microphone control and grant browser permission."],
  },
  {
    heading: "6. Optional analytics and cookies",
    paragraphs: ["We do not start non-essential analytics until you choose “Allow anonymous analytics.” When configured, BP Passport sends PostHog only the page path, product name, and a random browser identifier. It does not send form contents, health-check answers, readings, email addresses, query strings, or session recordings. You can clear the choice and anonymous identifier from your browser storage at any time. Essential storage continues to support sign-in, language, security, and offline features."],
  },
  {
    heading: "7. Why we use information",
    paragraphs: ["We use information to provide the feature you requested, secure accounts, calculate and display guidance, sync records when enabled, honour patient-controlled shares, respond to contact requests, diagnose service problems, and understand aggregate usage when you have opted in. We do not sell personal or health information."],
  },
  {
    heading: "8. Retention and your choices",
    paragraphs: ["On-device information remains until you remove it, clear site data, or use an available delete control. Cloud retention depends on the configured service and programme policy. You may revoke active shares, sign out, decline analytics, clear local site data, or contact the team to request access, correction, or deletion where applicable. Some security and audit records may be retained when legally or operationally required."],
  },
  {
    heading: "9. Security, children, and emergencies",
    paragraphs: ["We use access controls, expiring share links, row-level database policies, encrypted transport, and session revocation controls. No online service can promise absolute security. BP Passport is not directed to children under 18 without responsible adult or clinical supervision. For severe symptoms, call Rescue 1122 or go to the nearest emergency department."],
  },
  {
    heading: "10. Contact and changes",
    paragraphs: ["For privacy questions, use the contact page or the verified LinkedIn profiles listed there. The BP Passport product team is based in Karachi, Sindh, Pakistan. We may update this policy as services and legal requirements change; the effective date above will be revised when changes are material."],
  },
];

const URDU: LegalSection[] = [
  { heading: "1۔ یہ پالیسی کہاں لاگو ہوتی ہے", paragraphs: ["یہ پالیسی بتاتی ہے کہ بی پی پاسپورٹ عوامی ویب سائٹ، صحت چیک، مریض کی جگہ، ڈاکٹر شیئرنگ، اے آئی اسسٹنٹ اور رابطہ فارم استعمال کرتے وقت معلومات کو کیسے سنبھالتا ہے۔ جہاں ممکن ہو، ڈیٹا پہلے آپ کے اپنے آلے پر رکھا جاتا ہے۔"] },
  { heading: "2۔ ہم کون سی معلومات سنبھالتے ہیں", paragraphs: ["معلومات کا انحصار آپ کے منتخب کردہ فیچرز پر ہے۔"], bullets: ["صحت چیک کے جوابات اور بلڈ پریشر ریڈنگز۔", "اکاؤنٹ بنانے پر ای میل اور تصدیقی معلومات۔", "آپ کی اجازت سے ڈاکٹر پروفائل اور محدود مریض شیئر۔", "آپ کی جانب سے بھیجا گیا اسسٹنٹ متن یا آواز کا تحریری متن۔", "رابطہ فارم میں نام، ای میل، موضوع اور پیغام—اس میں طبی ریکارڈ شامل نہ کریں۔", "صرف رضامندی پر گمنام صفحہ راستہ اور بے ترتیب براؤزر شناخت۔"] },
  { heading: "3۔ مقامی اسٹوریج اور کلاؤڈ", paragraphs: ["بنیادی پاسپورٹ ڈیٹا براؤزر میں محفوظ رہ سکتا ہے۔ کلاؤڈ فعال ہونے اور سائن اِن کرنے پر مجاز ریکارڈ Supabase اور PostgreSQL میں محفوظ ہو سکتے ہیں۔ ضروری اسٹوریج سیشن، زبان، آف لائن استعمال اور سکیورٹی کے لیے استعمال ہوتی ہے۔"] },
  { heading: "4۔ ڈاکٹر کے ساتھ شیئرنگ", paragraphs: ["مریض کی واضح اجازت اور وقت کی حد کے بغیر ڈاکٹر ریکارڈ نہیں دیکھ سکتا۔ شیئر منسوخ یا ختم ہو سکتا ہے۔ PMDC انضمام دستیاب نہ ہونے کے دوران پائلٹ میں زیرِ التوا ڈاکٹر پروفائل شامل ہو سکتے ہیں؛ باقاعدہ اجرا سے پہلے تصدیق لازم ہوگی۔"] },
  { heading: "5۔ اے آئی اور آواز", paragraphs: ["اسسٹنٹ سوال یا آواز کا متن ترتیب دیے گئے اے آئی فراہم کنندہ، مثلاً Google Gemini، کو بھیجا جا سکتا ہے۔ اے آئی غلط ہو سکتی ہے اور ڈاکٹر یا ہنگامی خدمت کا متبادل نہیں۔ مائیک صرف آپ کی اجازت سے چلتا ہے۔"] },
  { heading: "6۔ اختیاری تجزیات", paragraphs: ["گمنام تجزیات آپ کی اجازت کے بغیر شروع نہیں ہوتے۔ فعال ہونے پر PostHog کو صرف صفحہ راستہ، پروڈکٹ نام اور بے ترتیب شناخت ملتی ہے؛ طبی جواب، ریڈنگ، ای میل، فارم متن، query string یا session recording نہیں بھیجی جاتی۔"] },
  { heading: "7۔ استعمال اور فروخت", paragraphs: ["معلومات مطلوبہ فیچر فراہم کرنے، اکاؤنٹ محفوظ رکھنے، رہنمائی دکھانے، مجاز شیئرنگ، رابطے کا جواب اور رضامندی پر مجموعی استعمال سمجھنے کے لیے استعمال ہوتی ہیں۔ ہم ذاتی یا طبی معلومات فروخت نہیں کرتے۔"] },
  { heading: "8۔ آپ کے اختیارات", paragraphs: ["آپ شیئر منسوخ، سائن آؤٹ، تجزیات سے انکار، مقامی ڈیٹا صاف، اور قابلِ اطلاق صورت میں رسائی، تصحیح یا حذف کی درخواست کر سکتے ہیں۔ قانونی یا سکیورٹی ضرورت کے تحت کچھ آڈٹ ریکارڈ رکھے جا سکتے ہیں۔"] },
  { heading: "9۔ سکیورٹی اور ہنگامی حالت", paragraphs: ["ہم رسائی کنٹرول، وقت کی حد والے شیئر، ڈیٹابیس پالیسیاں، محفوظ ترسیل اور سیشن منسوخی استعمال کرتے ہیں، مگر مکمل حفاظت کی ضمانت نہیں دی جا سکتی۔ شدید علامات میں ریسکیو 1122 یا قریبی ایمرجنسی سے فوراً رابطہ کریں۔"] },
  { heading: "10۔ رابطہ اور تبدیلیاں", paragraphs: ["رازداری سے متعلق سوال کے لیے رابطہ صفحہ یا وہاں درج تصدیق شدہ LinkedIn پروفائل استعمال کریں۔ ہماری پروڈکٹ ٹیم کراچی، سندھ، پاکستان میں ہے۔ اہم تبدیلی پر اوپر دی گئی تاریخ بدل دی جائے گی۔"] },
];

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ur = locale === "ur";
  return <LegalPage locale={locale} eyebrow={ur ? "قانونی" : "Legal"} title={ur ? "رازداری کی پالیسی" : "Privacy policy"} intro={ur ? "آپ کا صحت کا ڈیٹا حساس ہے۔ یہ صفحہ سادہ زبان میں بتاتا ہے کہ کیا سنبھالا جاتا ہے، کیوں، اور اختیار کس کے پاس ہے۔" : "Health information is sensitive. This page explains, in plain language, what is handled, why, and the choices you control."} sections={ur ? URDU : ENGLISH} />;
}
