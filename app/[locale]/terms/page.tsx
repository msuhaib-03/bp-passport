import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms for using BP Passport health education, blood-pressure tracking, clinician sharing, and pilot services.",
};

const ENGLISH: LegalSection[] = [
  { heading: "1. Agreement", paragraphs: ["By using BP Passport, you agree to these terms and the privacy policy. If you do not agree, do not use the service. These terms apply to patients, clinicians, pilot staff, and visitors."] },
  { heading: "2. Education, not medical advice", paragraphs: ["BP Passport provides education, screening support, tracking, and patient-controlled sharing. It does not diagnose a condition, prescribe medicine, replace professional judgement, or provide emergency care. Never stop, start, or change treatment because of the app alone. For severe symptoms, call Rescue 1122 or attend the nearest emergency department."] },
  { heading: "3. Your responsibilities", paragraphs: ["You are responsible for entering accurate information, using a suitable and correctly positioned blood-pressure device, protecting your account and device, and confirming important decisions with a qualified professional."], bullets: ["Do not share another person’s record without authority.", "Do not use the service to impersonate a patient, clinician, or staff member.", "Do not probe, disrupt, scrape, reverse engineer, or bypass access controls.", "Do not submit unlawful, abusive, or malicious material."] },
  { heading: "4. Accounts and clinician access", paragraphs: ["You must use an email address you control and keep credentials confidential. Clinicians may access only records intentionally shared with their signed-in profile. During the pilot, PMDC verification may not be integrated and pending profiles may have restricted, patient-authorized access. This pilot status is not a representation that BP Passport has independently verified clinical registration."] },
  { heading: "5. Patient-controlled sharing", paragraphs: ["Share links and permissions are time-limited and should be treated as confidential. Patients may revoke access. Recipients must use shared information only for the intended care purpose and comply with professional, ethical, and legal duties."] },
  { heading: "6. AI and voice", paragraphs: ["AI responses and transcripts can be incomplete or incorrect. Verify guidance with a qualified clinician. Do not submit content you are not authorised to share. The microphone is optional and depends on browser permission and configured services."] },
  { heading: "7. Availability and changes", paragraphs: ["This is a developing pilot. Features may be unavailable, changed, suspended, or discontinued, and data sync may fail. We may update the service and these terms for safety, security, legal, or product reasons. We will revise the effective date for material updates."] },
  { heading: "8. Intellectual property", paragraphs: ["BP Passport branding, interface, copy, and original software are owned by or licensed to the BP Passport team unless stated otherwise. Open-source components remain under their respective licences. These terms give you a limited, revocable right to use the service for its intended purpose."] },
  { heading: "9. Disclaimers and liability", paragraphs: ["The service is provided on an “as available” basis. To the extent permitted by applicable law, BP Passport is not liable for indirect or consequential loss, missed diagnosis, treatment decisions, device errors, or outages. Nothing in these terms excludes rights or liability that cannot lawfully be excluded."] },
  { heading: "10. Governing context and contact", paragraphs: ["The product team operates from Karachi, Sindh, Pakistan. Applicable Pakistani law governs these terms, subject to any mandatory rights that apply to you. Questions can be sent through the contact page or to the founders through the verified LinkedIn profiles shown there."] },
];

const URDU: LegalSection[] = [
  { heading: "1۔ معاہدہ", paragraphs: ["بی پی پاسپورٹ استعمال کرکے آپ ان شرائط اور رازداری کی پالیسی سے اتفاق کرتے ہیں۔ اتفاق نہ ہو تو سروس استعمال نہ کریں۔"] },
  { heading: "2۔ تعلیم، طبی مشورہ نہیں", paragraphs: ["بی پی پاسپورٹ تعلیم، اسکریننگ سپورٹ، ٹریکنگ اور مریض کی اجازت سے شیئرنگ فراہم کرتا ہے۔ یہ تشخیص، نسخہ، ڈاکٹر کے فیصلے یا ہنگامی نگہداشت کا متبادل نہیں۔ ایپ کی بنیاد پر دوا شروع، بند یا تبدیل نہ کریں۔ شدید علامات میں ریسکیو 1122 پر کال کریں۔"] },
  { heading: "3۔ آپ کی ذمہ داریاں", paragraphs: ["درست معلومات درج کرنا، مناسب بلڈ پریشر آلہ صحیح طرح استعمال کرنا، اکاؤنٹ اور آلہ محفوظ رکھنا، اور اہم فیصلے مستند ماہر سے تصدیق کرنا آپ کی ذمہ داری ہے۔"], bullets: ["اختیار کے بغیر کسی دوسرے کا ریکارڈ شیئر نہ کریں۔", "مریض، ڈاکٹر یا عملے کی نقالی نہ کریں۔", "رسائی کنٹرول توڑنے، خلل یا غیر مجاز scraping کی کوشش نہ کریں۔", "غیر قانونی، بدسلوکی یا نقصان دہ مواد جمع نہ کریں۔"] },
  { heading: "4۔ اکاؤنٹ اور ڈاکٹر رسائی", paragraphs: ["ایسی ای میل استعمال کریں جو آپ کے کنٹرول میں ہو اور اسناد محفوظ رکھیں۔ ڈاکٹر صرف ارادی طور پر شیئر کیے گئے ریکارڈ دیکھ سکتا ہے۔ پائلٹ کے دوران PMDC انضمام نہ ہونے کی وجہ سے زیرِ التوا پروفائل کو محدود، مریض کی اجازت والی رسائی مل سکتی ہے؛ یہ آزادانہ رجسٹریشن تصدیق نہیں۔"] },
  { heading: "5۔ مریض کے اختیار والی شیئرنگ", paragraphs: ["شیئر لنک اور اجازت محدود مدت کے لیے اور خفیہ ہیں۔ مریض رسائی منسوخ کر سکتا ہے۔ وصول کنندہ معلومات صرف مطلوبہ نگہداشت کے مقصد اور پیشہ ورانہ و قانونی ذمہ داری کے مطابق استعمال کرے۔"] },
  { heading: "6۔ اے آئی اور آواز", paragraphs: ["اے آئی جواب یا تحریری متن غلط یا نامکمل ہو سکتا ہے۔ رہنمائی مستند ڈاکٹر سے تصدیق کریں اور ایسا مواد نہ بھیجیں جسے شیئر کرنے کا اختیار نہ ہو۔"] },
  { heading: "7۔ دستیابی اور تبدیلی", paragraphs: ["یہ ترقی پذیر پائلٹ ہے۔ فیچر بدل، معطل یا بند ہو سکتے ہیں اور ڈیٹا sync ناکام ہو سکتا ہے۔ اہم تبدیلی پر مؤثر تاریخ بدل دی جائے گی۔"] },
  { heading: "8۔ ملکیت", paragraphs: ["بی پی پاسپورٹ برانڈ، انٹرفیس، تحریر اور اصل سافٹ ویئر ٹیم کی ملکیت یا لائسنس کے تحت ہیں۔ اوپن سورس حصے اپنے لائسنس کے تابع رہتے ہیں۔"] },
  { heading: "9۔ ذمہ داری کی حد", paragraphs: ["سروس دستیابی کی بنیاد پر فراہم ہوتی ہے۔ قابلِ اطلاق قانون کی حد تک بالواسطہ نقصان، تشخیص چھوٹنے، علاج کے فیصلے، آلے کی خرابی یا بندش کی ذمہ داری قبول نہیں کی جاتی۔ لازمی قانونی حقوق ختم نہیں ہوتے۔"] },
  { heading: "10۔ قانون اور رابطہ", paragraphs: ["پروڈکٹ ٹیم کراچی، سندھ، پاکستان سے کام کرتی ہے۔ لازمی صارف حقوق کے تابع پاکستانی قانون لاگو ہوگا۔ سوال رابطہ صفحہ یا وہاں درج تصدیق شدہ LinkedIn پروفائل کے ذریعے بھیجیں۔"] },
];

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ur = locale === "ur";
  return <LegalPage locale={locale} eyebrow={ur ? "قانونی" : "Legal"} title={ur ? "شرائطِ استعمال" : "Terms of service"} intro={ur ? "بی پی پاسپورٹ استعمال کرنے سے پہلے یہ شرائط پڑھیں۔ طبی فیصلے ہمیشہ مستند ماہر کے ساتھ کریں۔" : "Please read these terms before using BP Passport. Always make medical decisions with a qualified professional."} sections={ur ? URDU : ENGLISH} />;
}
