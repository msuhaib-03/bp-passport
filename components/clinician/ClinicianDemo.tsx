"use client";

import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Flame, Users } from "lucide-react";
import { BpTrendChart } from "./BpTrendChart";

const SAMPLE_READINGS = [
  ["2026-10-09T07:30:00Z", 154, 96], ["2026-10-11T07:45:00Z", 150, 94],
  ["2026-10-13T19:10:00Z", 147, 92], ["2026-10-15T07:20:00Z", 145, 90],
  ["2026-10-17T19:05:00Z", 141, 88], ["2026-10-19T07:40:00Z", 138, 86],
  ["2026-10-21T07:35:00Z", 136, 84],
].map(([logged_at, systolic, diastolic]) => ({ logged_at: String(logged_at), systolic: Number(systolic), diastolic: Number(diastolic) }));

const SAMPLE_PATIENTS = [
  { code: "BP-7K3M", latest: "136/84", trend: "−18", adherence: 93, streak: 12, state: "Improving" },
  { code: "BP-2R8Q", latest: "162/102", trend: "+8", adherence: 71, streak: 4, state: "Review due" },
  { code: "BP-9N4T", latest: "128/80", trend: "−6", adherence: 100, streak: 18, state: "On track" },
  { code: "BP-5C1L", latest: "146/92", trend: "−3", adherence: 86, streak: 8, state: "Monitor" },
];

export function ClinicianDemo({ onExit }: { onExit?: () => void }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {onExit && <button type="button" onClick={onExit} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-white px-4 text-sm font-bold text-ink-700"><ArrowLeft size={17} />Back to portal</button>}
        <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-extrabold text-amber-900">SAMPLE DATA · DEMO ONLY</span>
      </div>
      <section className="rounded-3xl bg-ink-900 p-6 text-white sm:p-8">
        <p className="text-xs font-bold tracking-[.14em] text-cyan-300 uppercase">BP Passport clinician workspace</p>
        <h1 className="mt-2 text-3xl font-extrabold">Good morning, Dr. Ayesha.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-200">A realistic preview using fictional records. Live patient data appears only after the patient shares it.</p>
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DemoMetric icon={Users} label="Shared patients" value="24" />
          <DemoMetric icon={Activity} label="Readings this week" value="86" />
          <DemoMetric icon={AlertTriangle} label="Needs review" value="3" tone="warning" />
          <DemoMetric icon={CheckCircle2} label="On track" value="79%" />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_.8fr]">
        <section className="card p-6"><BpTrendChart readings={SAMPLE_READINGS} title="BP-7K3M · 14-day trend" /><p className="mt-3 text-xs text-ink-500">The downward trend is sample data and is not a diagnosis.</p></section>
        <section className="card p-6">
          <div className="flex items-center gap-2"><Flame size={20} className="text-orange-500" /><h2 className="text-lg font-bold text-ink-900">Consistency leaderboard</h2></div>
          <p className="mt-1 text-xs leading-5 text-ink-500">Fictional Passport IDs ranked by logging streak. No names are shown.</p>
          <ol className="mt-4 space-y-3">{[...SAMPLE_PATIENTS].sort((a, b) => b.streak - a.streak).map((patient, index) => <li key={patient.code} className="flex items-center gap-3 rounded-xl bg-ink-50 p-3"><span className="grid size-8 place-items-center rounded-full bg-white text-sm font-extrabold text-cyan-700">{index + 1}</span><strong className="flex-1 text-sm text-ink-900">{patient.code}</strong><span className="text-sm font-bold text-orange-600">{patient.streak} days</span></li>)}</ol>
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-border p-6"><h2 className="text-lg font-bold text-ink-900">Patient review queue</h2><p className="mt-1 text-sm text-ink-500">Prioritize repeated high readings while keeping improving patients visible.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-sm"><thead className="bg-ink-50 text-ink-500"><tr><th className="px-6 py-3 text-start">Passport</th><th className="px-4 py-3 text-start">Latest BP</th><th className="px-4 py-3 text-start">Systolic change</th><th className="px-4 py-3 text-start">Adherence</th><th className="px-4 py-3 text-start">Streak</th><th className="px-4 py-3 text-start">Status</th></tr></thead><tbody className="divide-y divide-border">{SAMPLE_PATIENTS.map((patient) => <tr key={patient.code}><td className="px-6 py-4 font-bold text-ink-900">{patient.code}</td><td className="numeric px-4 py-4 font-bold">{patient.latest}</td><td className="px-4 py-4">{patient.trend} mmHg</td><td className="px-4 py-4">{patient.adherence}%</td><td className="px-4 py-4">{patient.streak} days</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${patient.state === "Review due" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>{patient.state}</span></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function DemoMetric({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone?: "warning" }) {
  return <div className={`rounded-2xl p-4 ${tone === "warning" ? "bg-red-500/20" : "bg-white/10"}`}><Icon size={19} className={tone === "warning" ? "text-red-200" : "text-cyan-300"} /><strong className="mt-3 block text-2xl">{value}</strong><span className="text-xs text-ink-200">{label}</span></div>;
}
