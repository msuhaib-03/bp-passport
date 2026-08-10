# BP Passport

A free, bilingual, QR-first blood-pressure screening and longitudinal tracking platform for Pakistan.

Scan a QR code at a kiosk, complete a 60-second Heart Audit in English or Urdu, see what your reading means, and keep a record your doctor can actually act on. No download, no account, no cost.

---

## Why this exists

| | |
|---|---|
| **32.5M** | Pakistani adults live with hypertension — roughly 1 in 3 |
| **11%** | have it controlled |
| **26.3%** | have never had their blood pressure measured, not once |
| **1 : 1,300** | national doctor-to-patient ratio, which makes clinic-based monitoring structurally impossible |

Where home BP logging has been paired with structured physician review, control rates transformed — Kaiser Permanente moved 44% → 90% over twelve years, the US Veterans Affairs system 46% → 76% over ten. Pakistan has never tried it. The clinician link is not a feature of this product; it is the mechanism.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 → redirects to /en
```

```bash
npm test             # 106 tests
npm run test:clinical # 68 — clinical logic, incl. all 243 lifestyle combinations
npm run test:db      # 38 — migrations + RLS, against real Postgres via PGlite
npm run check        # typecheck + full suite
npm run build        # production build
```

No environment variables are required to run the MVP — the browser is the system of record (see [Data](#data)). Copy `.env.example` to `.env.local` when you wire up the database.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript strict | One codebase serves the patient PWA `/`, and will serve `/portal` and `/admin` as route groups — not three apps for a two-person team |
| Styling | **Tailwind CSS v4** with a CSS-first design system | Tokens live in `app/globals.css`; the clinical palette is defined once |
| i18n | **next-intl** (`en`, `ur`) with true RTL | Locale is a route segment; `dir` is set on `<html>`; layout uses logical properties throughout |
| Clinical logic | Pure TypeScript in `lib/clinical/` | Zero dependencies, fully unit-tested, portable to a server or a worker unchanged |
| Persistence | `sessionStorage` + `localStorage` behind `lib/storage.ts` | MVP works offline with no signup; swapping in Supabase touches one file |
| Tests | **Vitest** | The clinical suite is the executable form of the PHL sign-off contract |

Production audit is clean (`npm audit --omit=dev` → 0 vulnerabilities).

---

## Clinical core

Everything clinically consequential lives in `lib/clinical/` and is deliberately free of UI concerns, so a reviewer can audit it without reading React.

### `bp-classification.ts`

ISH 2020 office-BP categories — the framework the Pakistan Hypertension League endorses. Every threshold is a named constant.

| Category | SBP | | DBP |
|---|---|---|---|
| Optimal | < 120 | and | < 80 |
| Normal | 120–129 | and/or | 80–84 |
| High normal | 130–139 | and/or | 85–89 |
| Grade 1 | 140–159 | and/or | 90–99 |
| Grade 2 | ≥ 160 | and/or | ≥ 100 |

Three details that matter:

- **"and/or" logic is implemented properly.** A reading of 135/95 is Grade 1 on the diastolic value alone. Classifying on systolic would under-triage that patient.
- **Urgency is modelled separately from category.** A reading can be Grade 2 without being a hypertensive crisis, and the app must respond to each differently. Crisis threshold is ≥180/≥120.
- **Implausible readings throw rather than classify.** `80/120` is the classic transposition error; accepting it would write a fabricated crisis into a patient's permanent record.

### `heart-score.ts`

A 5–100 composite over five modifiable lifestyle factors plus a contribution from the current reading. It answers the question a screening subject actually asks — *what should I change first?* — which a BP category alone cannot.

It is deliberately **not** called a risk score. Framingham, QRISK and the WHO/ISH charts are validated instruments predicting events over years; claiming equivalence would be false and a DRAP Class B exposure. Clinical severity is always communicated through `bp-classification.ts`.

Weights are evidence-informed but **not yet clinically validated** — this is the artefact requiring PHL sign-off before public launch. All of them sit in two exported tables so a reviewer can audit the model on one screen, and the test suite pins all 3⁵ = 243 lifestyle combinations against six BP categories so no weight can change quietly.

### `triage.ts`

Deterministic emergency detection that runs **before** any language model. A model that is 99% reliable at recognising crushing chest pain is unacceptable when the 1% is a myocardial infarction, so red-flag detection is keyword-and-threshold based, and when it fires the model is never called.

Matches all three registers Pakistani users actually type in — English, Urdu script, and Roman Urdu (`seenay mein dard`). Biased toward false positives on purpose: sending a well patient to a clinic is a cost; missing a stroke is not.

### `drap-guardrail.ts`

Under DRAP Medical Devices Rules 2017, software that diagnoses or recommends therapy is Class B SaMD — ISO 13485 and a review measured in months. Software that educates and refers is Class A. This module keeps the product on the Class A side, and it fails closed: any violation discards the copy entirely and returns a safe fallback.

The line it enforces: **describe the reading, never label the person.**

| Blocked | Allowed |
|---|---|
| "You have hypertension." | "This reading is in the Grade 1 range." |
| "Start taking amlodipine." | "Hypertension affects 32.5 million Pakistani adults." |
| "Increase your dose." | "Please show these readings to your doctor." |

It applies to hand-written template copy as much as to model output — a developer writing "you have stage 1 hypertension" in a template is exactly as much of a breach as a model generating it.

---

## Design system

The palette comes from the brand mark: a navy shield holding a heart that runs cyan on one side and coral on the other. That gradient *is* the risk scale, so the product's colour language and its clinical language are the same thing.

Three constraints shaped every choice:

**Colour-vision safety.** The clinical scale runs **cyan → amber → coral**, never green → red. Red/green deficiency affects roughly 8% of men. Cyan against orange is the most robust pair across protanopia, deuteranopia and tritanopia. Colour is never the only signal — every risk state carries four redundant encodings: colour, a localised text label, a distinct glyph, and a position on the scale component.

**Age and literacy range.** Body text is 17px, not 16. Minimum tap target is 56px, not the WCAG 44px, because many users are over 60, one-handed, or on a moving bus. Nothing depends on hover. Zoom is never disabled.

**Health anxiety.** Saturated red appears in exactly one component — the hypertensive-crisis card. An app that shouts at a Grade 1 reading trains users to ignore the shout that matters.

### Notable UX decisions

- **BP entry uses steppers, not a slider.** Blood pressure needs single-mmHg precision across a ~200-unit range; on a phone that is about two pixels per unit, which is unusable for anyone with a tremor — more common in exactly this population. Double-tap steps by 5.
- **Fields are labelled "Upper number" / "Lower number".** People read the machine display; almost nobody knows which clinical term maps to which line.
- **Numbers stay LTR in Urdu.** `direction: ltr` on `.numeric`, because a mirrored `148/94` becomes `94/148` — clinically dangerous.
- **Results lead with the reading, not the score.** Users came for their blood pressure, not a proprietary metric.
- **"Start with this" is the payoff.** The two or three habits costing the most points, each with a concrete, culturally specific action — skip the salt shaker, cut achar to twice a week, pair the walk with after-dinner. A score with no lever attached is a grade, and grades do not change behaviour.
- **The streak has a 48-hour grace window.** Strict streaks punish one missed day and cause users to quit entirely.

---

## Structure

```
app/
  [locale]/
    layout.tsx          html lang/dir, Urdu fonts loaded only for /ur
    page.tsx            campaign landing — the screen a QR code opens
    audit/              7-step Heart Audit
    results/            score, category, levers
    passport/           dashboard, logging, 14-day mean ± SD
  manifest.ts           PWA manifest
  globals.css           design system tokens
components/
  brand/Logo.tsx        inline SVG mark — paints with the first byte of HTML
  audit/                AuditFlow, BpEntry
  result/               ResultView, RiskScale, EmergencyCard
  passport/             PassportView
  ui/                   Button, LocaleSwitch
lib/
  clinical/             bp-classification · heart-score · triage · drap-guardrail · presentation
  i18n/                 routing · request · navigation
  storage.ts            sessionStorage/localStorage behind a narrow interface
messages/               en.json · ur.json
tests/clinical.test.ts  68 tests — the clinical contract, executable
proxy.ts                locale negotiation (Next 16 convention)
```

---

## Data

The MVP stores everything on the device. No account, no server round-trip — which is what makes a 60-second kiosk scan possible at all.

- **`sessionStorage`** holds the in-progress audit, so an abandoned attempt does not linger on a shared kiosk device.
- **`localStorage`** holds the saved Passport, and only after an explicit user action.
- The BP reading is **never** put in a URL. A query string ends up in browser history, server logs and analytics; health data does not belong there.
- Passport IDs (`PE-XXXX`) exclude `I`, `O`, `0` and `1` — indistinguishable when read aloud at a clinic desk.

### The server-side schema — built, not yet wired

`db/migrations/` holds the full PostgreSQL schema: nine tables, row-level security forced on every one, an append-only audit log, a consent ledger, and a consented + k-anonymised research schema. See **[db/README.md](db/README.md)**.

It is verified rather than asserted: `npm run test:db` applies the migrations to a real Postgres 18 (PGlite/WASM) and proves the behaviour — that one patient cannot read another's readings, that a clinician's access dies the instant a share is revoked or expires, that an unverified PMDC registration gets nothing, that the audit log survives `DELETE`, and that research cells below k = 5 are suppressed.

Two corrections carried forward from the architecture documents:

- **Phone numbers are not hashed with bare SHA-256.** A Pakistani mobile has roughly 10⁹ possible values, so an unpeppered digest is exhaustible in seconds and is not anonymisation. HMAC-SHA256 with a server-side pepper, computed in the app so the database never holds the secret.
- **Consent is a first-class append-only table.** The documents described a pharma-affiliated research dataset built from patient readings with no consent model at all. `has_consent()` returns false when no record exists — absence of consent is refusal, never assent.

Switching the app over touches one file, `lib/storage.ts`, because everything is behind that interface.

---

## Roadmap

| Horizon | Scope |
|---|---|
| **H1 — now** | Landing · Heart Audit · results · Passport dashboard · bilingual · offline-capable |
| **H2** | Clinician Portal (`/portal`) with PMDC gate, share tokens, 14-day charts ± SD against ISH bands; phone OTP; Postgres + RLS |
| **H3** | Bluetooth cuff sync · diagnostic lab booking · corporate analytics |
| **H4** | Multi-tenant SaaS · HL7 FHIR · regional expansion |

### The AI layer, when it lands

The strategy documents ban LLMs on clinical-safety grounds. Right instinct, wrong conclusion — safety comes from architecture, not abstinence. Three tiers, in order:

1. **Deterministic first.** `triage.ts` runs before any model call. Red flags return an emergency card and the model is never invoked.
2. **Retrieval-constrained generation.** The coach answers only from a clinically approved content set retrieved via `pgvector`. No match above threshold → canned fallback plus handoff to the human Heart Line.
3. **Output guardrail.** `drap-guardrail.ts` runs on model output, not just on the request payload. Any hit → response dropped, logged, fallback served.

Numbers are never generated. The 14-day mean ± SD is computed in SQL and passed in; the model only phrases it. That removes the numeric hallucination surface entirely.

---

## Open items before public launch

- [ ] **PHL sign-off on the Heart Score weights** — a hard launch gate, long lead time, not a technical task
- [ ] **DRAP Class A written confirmation** — the classification inquiry, filed
- [ ] Independent penetration test
- [ ] Source citations attached to every epidemiological figure with year and study
- [ ] Patient consent flow and data-ownership statement, written before any data leaves the device

---

## Licence

Proprietary. © PharmEvo (Pvt.) Ltd.
