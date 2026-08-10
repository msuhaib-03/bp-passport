"use client";

import { useTranslations } from "next-intl";

import { BP_CATEGORIES, type BpCategory } from "@/lib/clinical/bp-classification";
import { CATEGORY_VISUAL, scalePosition } from "@/lib/clinical/presentation";

/**
 * Where this reading sits on the clinical scale.
 *
 * This component is the reason the product is legible to someone who cannot
 * read the label. Position on a left-to-right scale is a pre-attentive signal:
 * you understand "far along the bad end" before you have read a single word.
 *
 * Four redundant encodings, so no single channel is load-bearing:
 *   colour · label · marker position · the numeric readout above it
 *
 * The scale is piecewise-linear (see `scalePosition`) so every category gets
 * equal width. A true-linear axis would compress optimal → high-normal into a
 * sliver, which is exactly the range where a user most needs to see movement.
 */
export function RiskScale({
  systolic,
  category,
}: {
  systolic: number;
  category: BpCategory;
}) {
  const t = useTranslations("scale");
  const position = scalePosition(systolic);

  return (
    <div>
      <p className="text-sm font-bold text-ink-500">{t("title")}</p>

      <div className="mt-4">
        {/* Segments */}
        <div className="flex h-3 gap-1 overflow-hidden rounded-full">
          {BP_CATEGORIES.map((cat) => (
            <div
              key={cat}
              className="flex-1 rounded-full transition-opacity"
              style={{
                background: CATEGORY_VISUAL[cat].accent,
                // The active band is full strength; the rest recede. Dimming
                // rather than hiding keeps the whole scale readable as context.
                opacity: cat === category ? 1 : 0.28,
              }}
            />
          ))}
        </div>

        {/* Marker. `inset-inline-start` so it mirrors correctly in Urdu. */}
        <div className="relative mt-1.5 h-6">
          <div
            className="absolute top-0 -translate-x-1/2 rtl:translate-x-1/2"
            style={{ insetInlineStart: `${position * 100}%` }}
          >
            <div
              className="size-3.5 rotate-45 rounded-[3px] border-2 border-white shadow-[0_1px_4px_rgb(8_19_33/0.3)]"
              style={{ background: CATEGORY_VISUAL[category].accent }}
              aria-hidden
            />
          </div>
        </div>

        {/* Labels */}
        <div className="flex gap-1">
          {BP_CATEGORIES.map((cat) => (
            <p
              key={cat}
              className={[
                "flex-1 text-center text-[0.6875rem] leading-tight",
                cat === category ? "font-bold text-ink-900" : "text-ink-400",
              ].join(" ")}
            >
              {t(cat)}
            </p>
          ))}
        </div>
      </div>

      <p className="sr-only">
        {t("yourReading")}: {systolic} — {t(category)}
      </p>
    </div>
  );
}
