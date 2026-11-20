"use client";

import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: BaseProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[#0b0a22]/70 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </D.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
              <D.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "pointer-events-auto relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-popover shadow-[var(--shadow-ring),var(--shadow-lg)] focus:outline-none sm:max-w-lg sm:rounded-lg",
                    className,
                  )}
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15, ease: "easeIn" } }}
                  transition={{ duration: 0.32, ease }}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-4">
                    <div>
                      <D.Title className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</D.Title>
                      {description ? (
                        <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description>
                      ) : (
                        <D.Description className="sr-only">{typeof title === "string" ? title : "Boîte de dialogue"}</D.Description>
                      )}
                    </div>
                    <D.Close className="-mr-2 rounded-md p-1.5 text-faint transition-colors hover:bg-subtle hover:text-ink" aria-label="Fermer">
                      <X className="h-4 w-4" />
                    </D.Close>
                  </div>
                  <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
                  {footer && <div className="flex flex-col-reverse gap-2 border-t border-line-soft bg-canvas/60 px-6 py-3.5 sm:flex-row sm:justify-end">{footer}</div>}
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

export function Drawer({ open, onOpenChange, title, description, children, footer, className }: BaseProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[#0b0a22]/70 backdrop-blur-[1px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-popover shadow-[var(--shadow-lg)] focus:outline-none sm:w-[480px] sm:rounded-l-2xl",
                  className,
                )}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                transition={{ duration: 0.42, ease }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
                  <div>
                    <D.Title className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</D.Title>
                    {description ? (
                      <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description>
                    ) : (
                      <D.Description className="sr-only">{typeof title === "string" ? title : "Panneau"}</D.Description>
                    )}
                  </div>
                  <D.Close className="-mr-2 rounded-md p-1.5 text-faint transition-colors hover:bg-subtle hover:text-ink" aria-label="Fermer">
                    <X className="h-4 w-4" />
                  </D.Close>
                </div>
                <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex gap-2 border-t border-line-soft bg-canvas/60 px-6 py-4 [&>*]:flex-1 sm:[&>*]:flex-none sm:justify-end">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
