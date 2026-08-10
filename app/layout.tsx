import type { ReactNode } from "react";
import "./globals.css";

/**
 * Root layout.
 *
 * Deliberately thin: `lang` and `dir` cannot be known here because the locale
 * lives in the route segment, so the locale layout owns <html>. This file exists
 * only to satisfy the App Router's root requirement and to import global CSS
 * once.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
