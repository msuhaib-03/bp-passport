/**
 * Brand mark, drawn inline.
 *
 * Inline rather than an <img> for three reasons: it paints with the first byte
 * of HTML (no second request on a 3G connection), it inherits colour so the mark
 * works on both light and navy surfaces, and it stays crisp at every size.
 *
 * The mark is a simplified reading of the full logo vector — shield, dual-tone
 * heart, QR block, medical cross — tuned to stay legible down to 24px, where the
 * full logo's QR detail turns to mud.
 */

interface LogoProps {
  /** Rendered height in pixels. Width follows the aspect ratio. */
  size?: number;
  className?: string;
  /** Hide from assistive tech when adjacent text already names the brand. */
  decorative?: boolean;
}

export function LogoMark({ size = 40, className, decorative = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 132"
      height={size}
      width={(size * 120) / 132}
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : "BP Passport"}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient id="lm-heart" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="48%" stopColor="#38bdf8" />
          <stop offset="52%" stopColor="#fb7350" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="lm-cross" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6ee7f2" />
          <stop offset="100%" stopColor="#12a3b8" />
        </linearGradient>
      </defs>

      {/* Shield: cyan on the left half, white on the right — carried over from
          the logo, where the split echoes the heart's two-tone treatment. */}
      <path
        d="M60 3 C44 3 27 8 11 17 C4 21 1 25 1 33 L1 71 C1 88 6 101 17 112 C27 122 42 130 60 138 C78 130 93 122 103 112 C114 101 119 88 119 71 L119 33 C119 25 116 21 109 17 C93 8 76 3 60 3 Z"
        fill="#22c3d6"
      />
      <path
        d="M60 3 C76 3 93 8 109 17 C116 21 119 25 119 33 L119 71 C119 88 114 101 103 112 C93 122 78 130 60 138 Z"
        fill="#ffffff"
      />
      <path
        d="M60 3 C44 3 27 8 11 17 C4 21 1 25 1 33 L1 71 C1 88 6 101 17 112 C27 122 42 130 60 138 C78 130 93 122 103 112 C114 101 119 88 119 71 L119 33 C119 25 116 21 109 17 C93 8 76 3 60 3 Z"
        fill="none"
        stroke="#081321"
        strokeWidth="3"
      />
      {/* Inner field */}
      <path
        d="M60 12 C46 12 31 17 18 24 C12 27 9 30 9 37 L9 69 C9 84 13 95 22 104 C31 112 44 119 60 126 C76 119 89 112 98 104 C107 95 111 84 111 69 L111 37 C111 30 108 27 102 24 C89 17 74 12 60 12 Z"
        fill="#0c1c30"
      />

      {/* Heart outline in the brand gradient */}
      <path
        d="M60 92 C60 92 26 70 26 48 C26 36 35 28 46 28 C53 28 58 32 60 37 C62 32 67 28 74 28 C85 28 94 36 94 48 C94 70 60 92 60 92 Z"
        fill="none"
        stroke="url(#lm-heart)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* QR corner finders — three squares read as "scannable" even at 24px,
          where a full QR matrix would be indistinguishable noise. */}
      <g fill="#ffffff">
        <rect x="42" y="42" width="12" height="12" rx="2.5" />
        <rect x="66" y="42" width="12" height="12" rx="2.5" />
        <rect x="42" y="62" width="12" height="12" rx="2.5" />
        <rect x="68" y="64" width="5" height="5" rx="1.2" />
        <rect x="76" y="64" width="5" height="5" rx="1.2" />
        <rect x="68" y="72" width="5" height="5" rx="1.2" />
      </g>

      {/* ECG trace — the "living measurement" cue */}
      <path
        d="M20 82 h8 l3 -5 l4 14 l4 -18 l4 9 h9"
        fill="none"
        stroke="url(#lm-heart)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Medical cross badge */}
      <circle cx="92" cy="95" r="18" fill="#0c1c30" stroke="#081321" strokeWidth="1.5" />
      <circle cx="92" cy="95" r="15" fill="none" stroke="url(#lm-cross)" strokeWidth="3" />
      <path
        d="M89 85 h6 v7 h7 v6 h-7 v7 h-6 v-7 h-7 v-6 h7 Z"
        fill="url(#lm-cross)"
      />
    </svg>
  );
}

/** Mark plus wordmark. Used on the landing hero and the closing card. */
export function LogoLockup({
  size = 44,
  className,
  wordmarkClassName,
}: LogoProps & { wordmarkClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark size={size} decorative />
      <span
        className={`font-bold tracking-tight ${wordmarkClassName ?? ""}`}
        style={{ fontSize: size * 0.52 }}
      >
        <span className="text-pink-500">BP</span>{" "}
        <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
          PASSPORT
        </span>
      </span>
    </span>
  );
}
