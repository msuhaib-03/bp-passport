import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Every button is at least 56px tall — above the WCAG 44px minimum, because a
 * meaningful share of users are over 60, one-handed, or on a moving bus.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-[0_2px_8px_rgb(8_19_33/0.16)]",
  secondary:
    "bg-white text-ink-900 border-2 border-ink-200 hover:border-ink-400 active:bg-ink-50",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200",
  danger: "bg-[var(--color-risk-crisis)] text-white hover:brightness-110 active:brightness-95",
};

const SIZES: Record<Size, string> = {
  md: "min-h-[3.5rem] px-6 text-base",
  lg: "min-h-[4rem] px-8 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold",
        "transition-[background-color,border-color,filter] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
