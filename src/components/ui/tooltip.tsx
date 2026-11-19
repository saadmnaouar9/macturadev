"use client";

import * as T from "@radix-ui/react-tooltip";

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} className="pop z-[60] rounded-md bg-[#1b2a5c] px-2 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-white/15">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
