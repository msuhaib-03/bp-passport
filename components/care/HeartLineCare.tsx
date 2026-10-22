"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Fingerprint,
  HeartPulse,
  Home,
  LockKeyhole,
  LogIn,
  LogOut,
  Mic,
  Pill,
  Printer,
  QrCode,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import { BpEntry } from "@/components/audit/BpEntry";
import { SharePanel } from "@/components/passport/SharePanel";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import {
  CareAssistantPanel,
  CareCaregiverView,
  CareHealthView,
  CareHomeView,
  CareMedicinesView,
  CareReportsView,
} from "@/components/care/CareViews";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { careText, type CareLocale } from "@/lib/care-copy";
import {
  type CareAssessment,
  type CareState,
  emptyCareState,
  readCareState,
  saveCareState,
  todayKey,
} from "@/lib/care";
import { assess, summariseSeries, type BpReading } from "@/lib/clinical/bp-classification";
import { appendReading, readPassport, type Passport } from "@/lib/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isCloudPersistenceConfigured, syncReading } from "@/lib/supabase/persistence";

import styles from "./heartline-care.module.css";

type IntroScreen = "welcome" | "access" | "profile" | "assessment" | "snapshot" | "dashboard";
type AppView = "home" | "health" | "medicines" | "reports" | "caregiver" | "assistant";

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

const ASSESSMENT: Array<{
  key: keyof Omit<CareAssessment, "completedAt">;
  question: string;
  options: Array<{ value: "no" | "sometimes" | "yes" | "not_sure" | "low" | "medium" | "high"; label: string }>;
}> = [
  { key: "bpFrequency", question: "How often do you check your blood pressure?", options: [{ value: "no", label: "Never" }, { value: "sometimes", label: "Sometimes" }, { value: "yes", label: "Regularly" }] },
  { key: "toldHighBp", question: "Has a doctor ever told you your blood pressure is high?", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "not_sure", label: "Not sure" }] },
  { key: "diabetes", question: "Have you been told you have diabetes?", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "not_sure", label: "Not sure" }] },
  { key: "tobacco", question: "How often do you smoke or use tobacco?", options: [{ value: "no", label: "Never" }, { value: "sometimes", label: "Sometimes" }, { value: "yes", label: "Regularly" }] },
  { key: "activity", question: "On how many days are you physically active?", options: [{ value: "low", label: "Less than once a week" }, { value: "medium", label: "1–2 days a week" }, { value: "high", label: "Most days" }] },
  { key: "freshMeals", question: "How often do you choose fresh, lower-salt meals?", options: [{ value: "low", label: "Rarely" }, { value: "medium", label: "Sometimes" }, { value: "high", label: "Most days" }] },
  { key: "familyHistory", question: "Has a close family member had early heart disease or stroke?", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "not_sure", label: "Not sure" }] },
  { key: "sleep", question: "How has your sleep felt recently?", options: [{ value: "high", label: "Mostly restful" }, { value: "medium", label: "Mixed" }, { value: "low", label: "Often interrupted" }] },
  { key: "missedMedicine", question: "If medicine has been prescribed, how often is it missed?", options: [{ value: "no", label: "Never / not prescribed" }, { value: "sometimes", label: "Sometimes" }, { value: "yes", label: "Often" }] },
  { key: "redFlags", question: "Recently, have you had chest pain, severe breathlessness, fainting, or sudden weakness?", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "not_sure", label: "Not sure" }] },
];

const NAV: Array<{ id: AppView; label: string; icon: typeof Home }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "health", label: "My health", icon: HeartPulse },
  { id: "medicines", label: "Medicines", icon: Pill },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "caregiver", label: "Caregiver", icon: Users },
];

function Brand() {
  return (
    <span className={styles.brand}>
      <Image src="/heartline-logo.png" width={48} height={48} alt="BP Passport heart-and-pulse logo" priority />
      <span>
        BP Passport
      </span>
    </span>
  );
}

function displayCategory(category: ReturnType<typeof assess>["category"], locale: CareLocale = "en"): string {
  return careText(locale, ({ optimal: "Optimal range", normal: "Normal range", high_normal: "High-normal range", grade_1: "Grade 1 range", grade_2: "Grade 2 range" })[category]);
}

export function BpPassportCare() {
  const locale = useLocale() === "ur" ? "ur" : "en";
  const t = (text: string) => careText(locale, text);
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState<IntroScreen>("welcome");
  const [view, setView] = useState<AppView>("home");
  const [passport, setPassport] = useState<Passport | null>(null);
  const [care, setCare] = useState<CareState>(() => emptyCareState());
  const [question, setQuestion] = useState(0);
  const [showEmergency, setShowEmergency] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedPassport = readPassport();
      const savedCare = readCareState(savedPassport);
      setPassport(savedPassport);
      setCare(savedCare);
      if (savedCare.onboardingComplete) setIntro("dashboard");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateCare(change: Partial<CareState>) {
    setCare((current) => {
      const next = { ...current, ...change };
      saveCareState(next);
      return next;
    });
  }

  function finishAssessment(answer: CareAssessment[keyof CareAssessment]) {
    const item = ASSESSMENT[question]!;
    const nextAssessment = { ...care.assessment, [item.key]: answer };
    if (item.key === "redFlags") setShowEmergency(answer !== "no");
    if (question < ASSESSMENT.length - 1) {
      updateCare({ assessment: nextAssessment });
      setQuestion((current) => current + 1);
      return;
    }
    updateCare({
      assessment: { ...nextAssessment, completedAt: new Date().toISOString() },
      onboardingComplete: true,
    });
    setIntro("snapshot");
  }

  if (!ready) return <main className={styles.shell} />;

  if (intro !== "dashboard") {
    if (intro === "welcome") {
      return (
        <main className={styles.shell}>
          <section className={styles.welcome}>
            <div className={styles.welcomeTop}>
              <Brand />
              <div className={styles.welcomeActions}>
                <Link href="/account?mode=login" className={styles.accountLink}><LogIn size={16} />{t("Sign in")}</Link>
                <LocaleSwitch />
              </div>
            </div>
            <div className={styles.hero}>
              <p className={styles.eyebrow}>{t("Your everyday heart companion")}</p>
              <h1 className={styles.display}>{t("Your heart. Your health. One clear next step.")}</h1>
              <p className={styles.lede}>{t("BP Passport helps you understand your health, save real readings, and take one small action at a time.")}</p>
              <div className={styles.heroImage}>
                <Image src="/heartline-bp-guidance.png" fill sizes="(max-width: 600px) 92vw, 520px" alt="A man calmly checking his blood pressure at home" priority />
              </div>
              <div className={styles.journey}>
                <div className={styles.journeyItem}><strong>{t("1. Understand")}</strong>{t("One short health check.")}</div>
                <div className={styles.journeyItem}><strong>{t("2. Guide")}</strong>{t("BP Passport shows the next step.")}</div>
              </div>
              <button className={styles.primary} onClick={() => setIntro("access")}>{t("Start your health check")} <ArrowRight size={18} /></button>
              <button className={styles.secondary} onClick={() => { setIntro("dashboard"); setView("assistant"); }}><Bot size={18} /> {t("Ask BP Passport first")}</button>
              <div className={styles.accountActions}>
                <Link href="/account?mode=register" className={styles.accountPrimary}><UserRound size={17} />{t("Create account")}</Link>
                <Link href="/account?mode=login" className={styles.accountSecondary}><LogIn size={17} />{t("Sign in")}</Link>
              </div>
            </div>
          </section>
        </main>
      );
    }

    if (intro === "access") {
      return (
        <main className={styles.shell}>
          <section className={styles.flow}>
            <div className={styles.flowHeader}><button className={styles.textButton} onClick={() => setIntro("welcome")}><ArrowLeft size={16} /> {t("Back")}</button><LocaleSwitch /></div>
            <div className={styles.flowBody}>
              <Brand />
              <p className={styles.eyebrow} style={{ marginTop: "2rem" }}>{t("Secure access")}</p>
              <h1 className={styles.flowTitle}>{t("Choose a simple way in.")}</h1>
              <p className={styles.flowText}>{t("Use a clinic QR, your existing Patient ID, or the clearly labelled biometric demonstration.")}</p>
              <div className={styles.choiceGrid}>
                {([
                  ["qr", "Scan QR", QrCode],
                  ["patient_id", "Patient ID", LockKeyhole],
                  ["biometric_demo", "Biometric demo", Fingerprint],
                ] as const).map(([id, label, Icon]) => (
                  <button key={id} className={`${styles.choice} ${care.accessMethod === id ? styles.choiceActive : ""}`} onClick={() => updateCare({ accessMethod: id })}><Icon size={21} />{t(label)}</button>
                ))}
              </div>
              {care.accessMethod === "patient_id" && (
                <label className={styles.field}>{t("Patient ID")}<input defaultValue={passport?.id ?? ""} placeholder="PE-XXXX" /></label>
              )}
              {care.accessMethod === "qr" && <p className={styles.note}><QrCode size={16} />{t("Clinic campaign codes in QR links are kept with the existing Passport. Camera scanning can be connected to a clinic device later.")}</p>}
              {care.accessMethod === "biometric_demo" && <p className={styles.note}><Fingerprint size={16} />{t("Demonstration only. No fingerprint or face data is captured or stored.")}</p>}
              <div className={styles.flowActions}><button disabled={!care.accessMethod} className={styles.primary} onClick={() => setIntro("profile")}>{t("Continue")} <ArrowRight size={18} /></button></div>
              <p className={styles.note}><ShieldCheck size={16} />{t("Your care profile works locally on this device. Sign in later to use the existing encrypted cloud sync and clinician sharing.")}</p>
            </div>
          </section>
        </main>
      );
    }

    if (intro === "profile") {
      return (
        <main className={styles.shell}>
          <section className={styles.flow}>
            <div className={styles.flowHeader}><button className={styles.textButton} onClick={() => setIntro("access")}><ArrowLeft size={16} /> {t("Back")}</button><LocaleSwitch /></div>
            <div className={styles.progress}><span style={{ width: "50%" }} /></div>
            <div className={styles.flowBody} style={{ paddingTop: "3rem" }}>
              <p className={styles.eyebrow}>{t("Your profile")}</p>
              <h1 className={styles.flowTitle}>{t("A little about you.")}</h1>
              <p className={styles.flowText}>{t("This personalises your dashboard. Only your name is required.")}</p>
              <label className={styles.field}>{t("What should we call you?")}<input value={care.displayName} maxLength={50} autoComplete="name" onChange={(event) => setCare((current) => ({ ...current, displayName: event.target.value }))} placeholder={t("Your first name")} /></label>
              <div className={styles.fieldRow}>
                <label className={styles.field}>{t("Age")}<input type="number" min={18} max={110} value={care.age ?? ""} onChange={(event) => setCare((current) => ({ ...current, age: event.target.value ? Number(event.target.value) : undefined }))} /></label>
                <label className={styles.field}>{t("Gender")}<select value={care.gender ?? "prefer_not_to_say"} onChange={(event) => setCare((current) => ({ ...current, gender: event.target.value as CareState["gender"] }))}><option value="prefer_not_to_say">{t("Prefer not to say")}</option><option value="woman">{t("Woman")}</option><option value="man">{t("Man")}</option><option value="other">{t("Other")}</option></select></label>
              </div>
              <div className={styles.flowActions}><button disabled={!care.displayName.trim()} className={styles.primary} onClick={() => { updateCare({ displayName: care.displayName.trim() }); setIntro("assessment"); }}>{t("Start the 10 questions")} <ArrowRight size={18} /></button></div>
            </div>
          </section>
        </main>
      );
    }

    if (intro === "assessment") {
      const item = ASSESSMENT[question]!;
      return (
        <main className={styles.shell}>
          <section className={styles.flow}>
            <div className={styles.flowHeader}><button className={styles.textButton} onClick={() => question ? setQuestion(question - 1) : setIntro("profile")}><ArrowLeft size={16} /> {t("Back")}</button><span className={styles.subtle}>{question + 1} / {ASSESSMENT.length}</span></div>
            <div className={styles.progress}><span style={{ width: `${((question + 1) / ASSESSMENT.length) * 100}%` }} /></div>
            <p className={styles.questionCount}>{t("Health check")}</p>
            <h1 className={styles.flowTitle}>{t(item.question)}</h1>
            <p className={styles.flowText}>{t("Choose the closest answer. This is education and planning support, not a diagnosis.")}</p>
            <div className={styles.answerList}>
              {item.options.map((option) => <button key={option.value} className={styles.answer} onClick={() => finishAssessment(option.value)}>{t(option.label)}<ChevronRight size={18} style={{ float: "right" }} /></button>)}
            </div>
            {showEmergency && <div className={styles.urgent}><strong>{t("Get urgent help now.")}</strong><p>{t("Call Rescue 1122 or go to the nearest emergency department. Do not drive yourself. This check cannot assess an emergency.")}</p></div>}
          </section>
        </main>
      );
    }

    if (intro === "snapshot") {
      const focusCount = Object.entries(care.assessment).filter(([key, value]) => key !== "completedAt" && ["yes", "low", "sometimes", "not_sure"].includes(String(value))).length;
      return (
        <main className={styles.shell}>
          <section className={styles.flow}>
            <div className={styles.flowHeader}><Brand /><LocaleSwitch /></div>
            <div className={styles.flowBody} style={{ paddingTop: "3rem" }}>
              <p className={styles.eyebrow}>{t("Your health snapshot")}</p>
              <h1 className={styles.flowTitle}>{t("Your starting point is ready.")}</h1>
              <p className={styles.flowText}>{locale === "ur" ? `اس مختصر چیک میں ${focusCount} پہلو سامنے آئے جن پر بات یا کام کیا جا سکتا ہے۔ یہ تشخیص نہیں۔` : `This short check found ${focusCount} area${focusCount === 1 ? "" : "s"} worth discussing or working on. It is not a diagnosis.`}</p>
              <section className={styles.heroCard}>
                <p className={styles.eyebrow} style={{ color: "#c8eee7" }}>{t("Recommended next step")}</p>
                <h2>{t("Save a blood-pressure reading.")}</h2>
                <p>{t("A real measurement gives your dashboard a useful baseline. If you do not have a cuff now, you can add one later.")}</p>
              </section>
              {showEmergency && <div className={styles.urgent}><strong>{t("Do not wait for the dashboard.")}</strong><p>{t("For current chest pain, severe breathlessness, fainting, or sudden weakness, call Rescue 1122 or go to emergency care now.")}</p></div>}
              <div className={styles.flowActions}><button className={styles.primary} onClick={() => setIntro("dashboard")}>{t("Open my dashboard")} <ArrowRight size={18} /></button></div>
              <button className={styles.secondary} onClick={() => { setQuestion(0); setIntro("assessment"); }}>{t("Review my answers")}</button>
            </div>
          </section>
        </main>
      );
    }
  }

  return (
    <Dashboard
      locale={locale}
      care={care}
      passport={passport}
      view={view}
      setView={setView}
      setPassport={setPassport}
      updateCare={updateCare}
    />
  );
}

function Dashboard({
  locale,
  care,
  passport,
  view,
  setView,
  setPassport,
  updateCare,
}: {
  locale: "en" | "ur";
  care: CareState;
  passport: Passport | null;
  view: AppView;
  setView: (view: AppView) => void;
  setPassport: (passport: Passport | null) => void;
  updateCare: (change: Partial<CareState>) => void;
}) {
  const latest = passport?.readings.at(-1) ?? null;
  const t = (text: string) => careText(locale, text);
  const [signedIn, setSignedIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session && !data.session.user.is_anonymous));
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session && !session.user.is_anonymous));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function logout() {
    const client = getSupabaseBrowserClient();
    if (!client || loggingOut) return;
    setLoggingOut(true);
    try {
      const { data } = await client.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null);
      }
      await client.auth.signOut({ scope: "global" });
      router.replace("/account");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className={`${styles.shell} ${styles.app}`}>
      <aside className={styles.sidebar}>
        <Brand />
        <p className={styles.navLabel}>{t("My care")}</p>
        <nav className={styles.nav} aria-label="Care sections">
          {NAV.map(({ id, label, icon: Icon }) => <button key={id} className={`${styles.navButton} ${view === id ? styles.navActive : ""}`} onClick={() => setView(id)}><Icon size={18} />{t(label)}</button>)}
        </nav>
        <div className={styles.profile}>
          <strong>{care.displayName || t("Patient")}</strong><br />{passport?.id ?? t("Local care profile")}
          {signedIn ? (
            <button type="button" className={styles.sessionButton} onClick={() => void logout()} disabled={loggingOut}>
              <LogOut size={16} />{loggingOut ? t("Signing out…") : t("Sign out everywhere")}
            </button>
          ) : (
            <Link href="/account" className={styles.sessionButton}><LogIn size={16} />{t("Sign in")}</Link>
          )}
        </div>
      </aside>

      <section className={styles.main}>
        <div className={styles.mainInner}>
          <div className={styles.pageHeader}>
            <div><p className={styles.eyebrow}>{new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p></div>
            <div className={styles.headerActions}>
              <Link href="/" className={styles.headerLogout} aria-label={t("Back")}><Home size={18} /></Link>
              <LocaleSwitch />
              {signedIn ? <button type="button" className={styles.headerLogout} onClick={() => void logout()} disabled={loggingOut} aria-label={t("Sign out everywhere")}><LogOut size={18} /></button> : <Link href="/account?mode=login" className={styles.headerAccount}><LogIn size={17} />{t("Sign in")}</Link>}
            </div>
          </div>
          {view === "home" && <CareHomeView locale={locale} care={care} passport={passport} setView={setView} />}
          {view === "health" && <CareHealthView locale={locale} passport={passport} setPassport={setPassport} />}
          {view === "medicines" && <CareMedicinesView locale={locale} care={care} updateCare={updateCare} />}
          {view === "reports" && <CareReportsView locale={locale} passport={passport} />}
          {view === "caregiver" && <CareCaregiverView locale={locale} care={care} updateCare={updateCare} />}
          {view === "assistant" && <div className={styles.sectionHead}><h1>{t("BP Passport assistant")}</h1><p className={styles.subtle}>{t("Ask by text or voice. Emergency messages are screened before any AI provider is called.")}</p><div className={styles.card} style={{ marginTop: "1rem", minHeight: "32rem" }}><CareAssistantPanel locale={locale} latest={latest} hasMedicationReminder={care.medications.some((item) => item.active)} expanded /></div></div>}
        </div>
      </section>

      <aside className={styles.assistant}><CareAssistantPanel locale={locale} latest={latest} hasMedicationReminder={care.medications.some((item) => item.active)} /></aside>
      <nav className={styles.mobileNav} aria-label="Mobile care sections">
        {([
          ["home", "Home", Home], ["health", "Health", HeartPulse], ["medicines", "Meds", Pill], ["reports", "Reports", FileText], ["assistant", "Ask", Bot],
        ] as const).map(([id, label, Icon]) => <button key={id} className={`${styles.navButton} ${view === id ? styles.navActive : ""}`} onClick={() => setView(id)}><Icon size={17} />{t(label)}</button>)}
      </nav>
    </main>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars -- superseded during the care-dashboard migration; retained temporarily for safe visual comparison */
function HomeView({ care, passport, setView }: { care: CareState; passport: Passport | null; setView: (view: AppView) => void }) {
  const latest = passport?.readings.at(-1);
  const medicineDue = care.medications.find((item) => item.active && item.checkedOn !== todayKey());
  return (
    <>
      <h1 className={styles.pageTitle}>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {care.displayName || "there"}.</h1>
      <p className={styles.subtle} style={{ marginTop: ".45rem" }}>Let&apos;s take care of your heart today.</p>
      <section className={styles.heroCard}><p className={styles.eyebrow} style={{ color: "#c8eee7" }}>Your next step</p><h2>{latest ? "Keep your BP diary current." : "Your first BP check is ready."}</h2><p>{latest ? "A fresh reading helps your real trend stay useful." : "It only takes a few minutes. I’ll guide you calmly through each step."}</p><button className={styles.whiteButton} onClick={() => setView("health")}>{latest ? "Add today’s reading" : "Start BP check"}<ArrowRight size={17} /></button></section>
      <div className={styles.grid2}>
        <section className={styles.card}><div className={styles.cardHead}><div><h2>Today&apos;s care tickets</h2><p className={styles.subtle}>Simple actions, in the right order.</p></div><span className={styles.iconBadge}><ClipboardCheck size={20} /></span></div><div className={styles.ticketList}><button className={styles.ticket} onClick={() => setView("health")}><span className={styles.dot} /><span><strong>Check your BP</strong><small>{latest ? "Keep your diary current" : "Due now · takes 2 minutes"}</small></span><ChevronRight size={17} style={{ marginInlineStart: "auto" }} /></button>{medicineDue && <button className={styles.ticket} onClick={() => setView("medicines")}><span className={styles.dot} /><span><strong>Prescribed medicine reminder</strong><small>{medicineDue.schedule}</small></span><ChevronRight size={17} style={{ marginInlineStart: "auto" }} /></button>}<button className={styles.ticket} onClick={() => setView("reports")}><span className={styles.dot} style={{ background: "#6eb7a9" }} /><span><strong>Review your progress</strong><small>Your real saved readings</small></span><ChevronRight size={17} style={{ marginInlineStart: "auto" }} /></button></div></section>
        <section className={styles.card}><div className={styles.cardHead}><div><h2>Heart health</h2><p className={styles.subtle}>How your plan looks today.</p></div><span className={styles.iconBadge}><HeartPulse size={20} /></span></div><span className={styles.status}><Check size={14} /> Your data is ready</span><p className={styles.metric}>{latest ? `${latest.systolic}/${latest.diastolic}` : "Start with a reading"}</p><p className={styles.subtle}>{latest ? `${displayCategory(assess(latest).category)} · not a diagnosis` : "No blood-pressure reading saved yet."}</p></section>
      </div>
    </>
  );
}

function HealthView({ passport, setPassport }: { passport: Passport | null; setPassport: (passport: Passport | null) => void }) {
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  async function save(reading: BpReading | null) {
    if (!reading) { setAdding(false); return; }
    const logged = { ...reading, clientId: crypto.randomUUID(), at: new Date().toISOString(), takenAtTime: "random" as const };
    const updated = appendReading(logged);
    if (!updated) { setMessage("Create your BP Passport with the heart audit before saving readings."); return; }
    setPassport(updated);
    setAdding(false);
    setMessage("Reading saved on this device.");
    if (isCloudPersistenceConfigured()) void syncReading(logged).catch(() => setMessage("Saved on this device. Cloud sync will retry when your account is available."));
  }
  return <><div className={styles.sectionHead}><h1>My health</h1><p className={styles.subtle}>Your measurements stay in the existing BP Passport diary.</p></div>{!passport ? <div className={styles.empty}>Complete the existing heart audit to create your BP Passport before logging readings.<div className={styles.rowActions}><Link className={styles.primary} href="/audit">Start heart audit</Link></div></div> : <><section className={`${styles.card} ${styles.formCard}`}><div className={styles.cardHead}><div><h2>Blood-pressure diary</h2><p className={styles.subtle}>{passport.readings.length} saved reading{passport.readings.length === 1 ? "" : "s"}</p></div><span className={styles.iconBadge}><Activity size={20} /></span></div>{adding ? <div style={{ marginTop: "1rem" }}><p className={styles.subtle} style={{ marginBottom: "1rem" }}>Sit quietly for five minutes, support your arm, and keep both feet flat.</p><BpEntry onSubmit={(value) => void save(value)} /></div> : <button className={styles.primary} style={{ marginTop: "1rem" }} onClick={() => setAdding(true)}>Add a BP reading</button>}{message && <p className={styles.note}>{message}</p>}</section><section className={styles.card} style={{ marginTop: "1rem" }}><h2>Recent readings</h2><div className={styles.readingList}>{[...passport.readings].reverse().slice(0, 10).map((reading) => <div className={styles.reading} key={reading.clientId}><span>{new Date(reading.at).toLocaleString()}</span><strong>{reading.systolic}/{reading.diastolic}</strong></div>)}</div></section></>}</>;
}

function MedicinesView({ care, updateCare }: { care: CareState; updateCare: (change: Partial<CareState>) => void }) {
  const [label, setLabel] = useState("");
  const [schedule, setSchedule] = useState("8:00 AM");
  function add(event: FormEvent) { event.preventDefault(); if (!label.trim()) return; updateCare({ medications: [...care.medications, { id: crypto.randomUUID(), label: label.trim(), schedule: schedule.trim(), active: true }] }); setLabel(""); }
  return <><div className={styles.sectionHead}><h1>Medicines</h1><p className={styles.subtle}>Reminders for medicine already prescribed to you. BP Passport never recommends or changes treatment.</p></div><form className={`${styles.card} ${styles.formCard}`} onSubmit={add}><h2>Add a prescribed reminder</h2><label className={styles.field}>Label from your prescription<input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Morning tablet" /></label><label className={styles.field}>When do you take it?<input value={schedule} maxLength={40} onChange={(event) => setSchedule(event.target.value)} /></label><button className={styles.primary} style={{ marginTop: "1rem" }}>Add reminder</button></form><section className={styles.card} style={{ marginTop: "1rem" }}><h2>Your reminders</h2>{care.medications.length === 0 ? <div className={styles.empty}>No reminders yet.</div> : care.medications.map((item) => <div className={styles.checkRow} key={item.id}><div><strong>{item.label}</strong><p className={styles.subtle}>{item.schedule}{item.checkedOn === todayKey() ? " · checked today" : ""}</p></div><button className={styles.textButton} onClick={() => updateCare({ medications: care.medications.map((entry) => entry.id === item.id ? { ...entry, checkedOn: entry.checkedOn === todayKey() ? undefined : todayKey() } : entry) })}>{item.checkedOn === todayKey() ? "Undo" : "Mark taken"}</button></div>)}</section></>;
}

function ReportsView({ passport }: { passport: Passport | null }) {
  const [referenceTime] = useState(() => Date.now());
  const recent = passport?.readings.filter((reading) => referenceTime - new Date(reading.at).getTime() <= 14 * 86400000) ?? [];
  const summary = summariseSeries(recent);
  return <><div className={styles.sectionHead}><h1>Your report</h1><p className={styles.subtle}>A real 14-day summary from this BP Passport.</p></div><section className={styles.card}><div className={styles.cardHead}><div><h2>Blood-pressure summary</h2><p className={styles.subtle}>Last 14 days</p></div><span className={styles.iconBadge}><FileText size={20} /></span></div>{summary ? <div className={styles.grid2}><div><p className={styles.subtle}>Average</p><p className={styles.metric}>{summary.meanSystolic}/{summary.meanDiastolic}</p><p className={styles.subtle}>{displayCategory(summary.category)} · {summary.count} readings</p></div><div><p className={styles.subtle}>Systolic trend</p><p className={styles.metric}>{summary.systolicTrend > 0 ? "+" : ""}{summary.systolicTrend} <small>mmHg</small></p><p className={styles.subtle}>A trend needs several consistent readings.</p></div></div> : <div className={styles.empty}>Add readings over time to build your report.</div>}<div className={styles.rowActions}><button className={styles.primary} onClick={() => window.print()}><Printer size={17} /> Print / save PDF</button><Link className={styles.secondary} href="/passport">Open full Passport</Link></div></section><SharePanel enabled={Boolean(passport && isCloudPersistenceConfigured())} /></>;
}

function CaregiverView({ care, updateCare }: { care: CareState; updateCare: (change: Partial<CareState>) => void }) {
  const [draft, setDraft] = useState(care.caregiver);
  const permissions = draft.permissions;
  function toggle(key: keyof typeof permissions) { setDraft((current) => ({ ...current, permissions: { ...current.permissions, [key]: !current.permissions[key] } })); }
  return <><div className={styles.sectionHead}><h1>Caregiver</h1><p className={styles.subtle}>Choose what a trusted person may see. No messages are sent automatically.</p></div><section className={`${styles.card} ${styles.formCard}`}><div className={styles.cardHead}><div><h2>Your care circle</h2><p className={styles.subtle}>Saved on this device until cloud invitations are configured.</p></div><span className={styles.iconBadge}><Users size={20} /></span></div><div className={styles.heroImage} style={{ aspectRatio: "16 / 7", marginTop: "1rem" }}><Image src="/heartline-care-circle.png" fill sizes="(max-width: 720px) 92vw, 520px" alt="A family member helping with a care plan" /></div><label className={styles.field}>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className={styles.field}>Relationship<input value={draft.relationship} onChange={(event) => setDraft({ ...draft, relationship: event.target.value })} placeholder="Family member, friend…" /></label>{([['readings', 'See BP readings'], ['reminders', 'See reminder status'], ['reports', 'See reports']] as const).map(([key, label]) => <div className={styles.checkRow} key={key}><span>{label}</span><button type="button" aria-label={`Toggle ${label}`} aria-pressed={permissions[key]} className={`${styles.toggle} ${permissions[key] ? styles.toggleOn : ""}`} onClick={() => toggle(key)} /></div>)}<button className={styles.primary} style={{ marginTop: "1rem" }} onClick={() => updateCare({ caregiver: draft })}>Save permissions</button></section></>;
}

function DoctorView({ passport }: { passport: Passport | null }) {
  return <><div className={styles.sectionHead}><h1>Doctor</h1><p className={styles.subtle}>Use the existing verified-clinician portal and consent-controlled sharing.</p></div><div className={styles.grid2}><section className={styles.card}><span className={styles.iconBadge}><Stethoscope size={20} /></span><h2 style={{ marginTop: "1rem" }}>Patient sharing</h2><p className={styles.subtle} style={{ marginTop: ".4rem" }}>Open your Passport to share with a verified clinician by PMDC number. You can revoke access at any time.</p><div className={styles.rowActions}><Link href="/passport" className={styles.primary}>Open my Passport</Link></div></section><section className={styles.card}><span className={styles.iconBadge}><UserRound size={20} /></span><h2 style={{ marginTop: "1rem" }}>Clinician workspace</h2><p className={styles.subtle} style={{ marginTop: ".4rem" }}>Clinicians sign in separately to review patients who have granted access.</p><div className={styles.rowActions}><Link href="/portal" className={styles.secondary}>Clinician portal</Link></div></section></div>{!passport && <div className={styles.empty}>Create a Passport first so there is a record to share.</div>}</>;
}

function ProgrammeView({ passport, care }: { passport: Passport | null; care: CareState }) {
  return <><div className={styles.sectionHead}><h1>Programme view</h1><p className={styles.subtle}>Transparent device-level counts—not fictional population metrics.</p></div><div className={styles.grid2}><section className={styles.card}><p className={styles.subtle}>Readings saved</p><p className={styles.metric}>{passport?.readings.length ?? 0}</p></section><section className={styles.card}><p className={styles.subtle}>Care reminders</p><p className={styles.metric}>{care.medications.length}</p></section></div><section className={styles.card} style={{ marginTop: "1rem" }}><h2>Clinical operations</h2><p className={styles.subtle} style={{ marginTop: ".4rem" }}>The existing admin verification queue remains protected by the server-side admin token.</p><div className={styles.rowActions}><Link href="/admin" className={styles.primary}>Open admin review</Link><Link href="/account" className={styles.secondary}>Account & sync</Link></div></section></>;
}

function AssistantPanel({ locale, latest, hasMedicationReminder, expanded = false }: { locale: "en" | "ur"; latest: BpReading | null; hasMedicationReminder: boolean; expanded?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "welcome", role: "assistant", text: latest ? "I can see your latest saved BP reading. Ask what it means or what to do next." : "I’m here to help with your next heart-health step. You can type or speak." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const provider = useMemo(() => messages.length > 1 ? "Safety-screened assistant" : "Always with you", [messages.length]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput(""); setBusy(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: clean }]);
    try {
      const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
      const response = await fetch(`${apiOrigin}/api/v1/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, locale, context: { latestReading: latest ? { systolic: latest.systolic, diastolic: latest.diastolic } : null, hasMedicationReminder } }) });
      const payload = await response.json() as { text?: string; urgent?: boolean; error?: string };
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: payload.text ?? payload.error ?? "I couldn’t answer just now. Please try again.", urgent: payload.urgent }]);
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: "I couldn’t reach the assistant. Your saved readings and reminders still work offline." }]);
    } finally { setBusy(false); }
  }

  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SpeechCtor = (window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as typeof window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechCtor) { setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: "Voice input is not supported by this browser. You can still type your question." }]); return; }
    const recognition = new SpeechCtor(); recognition.lang = locale === "ur" ? "ur-PK" : "en-PK"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript ?? ""; setInput(transcript); void send(transcript); };
    recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false); recognitionRef.current = recognition; setListening(true); recognition.start();
  }

  return <div style={{ display: "flex", flexDirection: "column", height: expanded ? "30rem" : "100%" }}><div className={styles.assistantHead}><span className={styles.iconBadge}><Bot size={19} /></span><div><strong>BP Passport assistant</strong><small>{provider}</small></div></div><div className={styles.assistantMessages} aria-live="polite">{messages.map((message) => <div key={message.id} className={`${styles.message} ${message.role === "user" ? styles.messageUser : ""} ${message.urgent ? styles.messageUrgent : ""}`}>{message.text}</div>)}{busy && <div className={styles.message}>Thinking…</div>}</div><div className={styles.quickRow}>{["What should I do next?", "My medicines", "What should I eat?", "My report"].map((prompt) => <button className={styles.quick} key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div><form className={styles.assistantForm} onSubmit={(event) => { event.preventDefault(); void send(input); }}><input aria-label="Ask BP Passport" value={input} maxLength={600} onChange={(event) => setInput(event.target.value)} placeholder="Ask or speak…" /><button type="button" className={styles.iconButton} aria-label={listening ? "Stop listening" : "Speak your question"} aria-pressed={listening} onClick={toggleVoice}><Mic size={17} /></button><button className={styles.iconButton} aria-label="Send" disabled={busy}><Send size={17} /></button></form><p className={styles.assistantMeta}>Education only · emergencies screened first · configured AI providers receive the question and latest reading · call 1122 for urgent symptoms</p></div>;
}
