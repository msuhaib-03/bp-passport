"use client";

type TrendReading = {
  systolic: number;
  diastolic: number;
  logged_at: string;
};

export function BpTrendChart({ readings, title = "Blood-pressure trend" }: { readings: TrendReading[]; title?: string }) {
  const ordered = [...readings].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  if (ordered.length < 2) return <div className="rounded-xl bg-ink-50 p-5 text-sm text-ink-500">At least two readings are needed for a trend chart.</div>;

  const width = 720;
  const height = 270;
  const left = 48;
  const right = 18;
  const top = 20;
  const bottom = 42;
  const min = 50;
  const max = 210;
  const x = (index: number) => left + (index / Math.max(1, ordered.length - 1)) * (width - left - right);
  const y = (value: number) => top + ((max - value) / (max - min)) * (height - top - bottom);
  const points = (key: "systolic" | "diastolic") => ordered.map((reading, index) => `${x(index)},${y(reading[key])}`).join(" ");

  return (
    <figure aria-label={title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption className="font-bold text-ink-900">{title}</figcaption>
        <div className="flex gap-4 text-xs font-semibold text-ink-600"><span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-[#078679]" />Systolic</span><span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-[#ef7b45]" />Diastolic</span></div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: systolic and diastolic readings over time`} className="h-auto w-full overflow-visible rounded-xl bg-white">
        {[80, 120, 160, 200].map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#dce8e3" strokeDasharray="4 5" /><text x={left - 8} y={y(tick) + 4} textAnchor="end" fill="#657a74" fontSize="12">{tick}</text></g>)}
        <polyline points={points("systolic")} fill="none" stroke="#078679" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points("diastolic")} fill="none" stroke="#ef7b45" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {ordered.map((reading, index) => <g key={`${reading.logged_at}-${index}`}><circle cx={x(index)} cy={y(reading.systolic)} r="4" fill="#078679"><title>{new Date(reading.logged_at).toLocaleDateString()}: {reading.systolic}/{reading.diastolic}</title></circle><circle cx={x(index)} cy={y(reading.diastolic)} r="4" fill="#ef7b45" /></g>)}
        <text x={left} y={height - 13} fill="#657a74" fontSize="12">{new Date(ordered[0]!.logged_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>
        <text x={width - right} y={height - 13} textAnchor="end" fill="#657a74" fontSize="12">{new Date(ordered.at(-1)!.logged_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>
      </svg>
    </figure>
  );
}
