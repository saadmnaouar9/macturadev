"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "./ui/tooltip";
import { ConfirmProvider } from "./ui/confirm";
import { THEME_EVENT } from "./layout/theme-toggle";

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    const on = (e: Event) => setTheme((e as CustomEvent).detail === "light" ? "light" : "dark");
    window.addEventListener(THEME_EVENT, on);
    return () => window.removeEventListener(THEME_EVENT, on);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <ConfirmProvider>
          {children}
          <Toaster
            theme={theme}
            position="bottom-right"
            gap={10}
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-xl !border-0 !bg-surface !text-ink !shadow-[var(--shadow-ring),var(--shadow-lg)] !font-sans !text-[13px] !gap-3 !px-4 !py-3",
                description: "!text-muted",
                title: "!font-medium",
              },
            }}
          />
        </ConfirmProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
