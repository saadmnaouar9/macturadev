"use client";

import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "./ui/tooltip";
import { ConfirmProvider } from "./ui/confirm";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <ConfirmProvider>
          {children}
          <Toaster
            theme="dark"
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
