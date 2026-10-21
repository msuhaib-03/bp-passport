"use client";

import { MessageCircle } from "lucide-react";

export function WhatsAppShareButton({ report, label = "Share report on WhatsApp", className = "" }: { report: string; label?: string; className?: string }) {
  function share() {
    const url = `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return <button type="button" onClick={share} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 font-bold text-white hover:bg-[#1fad54] ${className}`}><MessageCircle size={18} />{label}</button>;
}
