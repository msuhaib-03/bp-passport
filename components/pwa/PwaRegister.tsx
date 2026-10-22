"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Download, Share, WifiOff, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const isUrdu = useLocale() === "ur";
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const platformTimer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      setShowIosHelp(ios && !standalone);
    }, 0);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }).then((registration) => {
        void registration.update();
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      });
    }
    const showOnline = () => setOnline(true);
    const showOffline = () => setOnline(false);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const installed = () => {
      setInstallPrompt(null);
      setShowIosHelp(false);
    };
    window.addEventListener("online", showOnline);
    window.addEventListener("offline", showOffline);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.clearTimeout(platformTimer);
      window.removeEventListener("online", showOnline);
      window.removeEventListener("offline", showOffline);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <>
      {!online && <div role="status" className="fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-xl"><WifiOff size={17} />{isUrdu ? "آف لائن موڈ: محفوظ پاسپورٹ کی خصوصیات دستیاب رہیں گی۔" : "Offline mode: saved Passport features remain available."}</div>}
      {(installPrompt || showIosHelp) && !dismissed && (
        <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-2 rounded-xl border border-border bg-white p-2 shadow-xl sm:inset-x-auto sm:bottom-4 sm:start-4">
          {installPrompt ? (
            <button type="button" onClick={() => void install()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-bold text-white">
              <Download size={17} />{isUrdu ? "بی پی پاسپورٹ انسٹال کریں" : "Install BP Passport"}
            </button>
          ) : (
            <p className="flex flex-1 items-center gap-2 px-2 text-xs font-semibold leading-5 text-ink-700">
              <Share size={18} className="shrink-0 text-cyan-600" />
              {isUrdu ? "شیئر دبائیں، پھر ہوم اسکرین میں شامل کریں منتخب کریں۔" : "Tap Share, then Add to Home Screen."}
            </p>
          )}
          <button type="button" onClick={() => setDismissed(true)} className="grid size-11 shrink-0 place-items-center rounded-lg text-ink-500" aria-label={isUrdu ? "انسٹال تجویز بند کریں" : "Dismiss install suggestion"}><X size={18} /></button>
        </div>
      )}
    </>
  );
}
