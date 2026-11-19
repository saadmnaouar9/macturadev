"use client";

import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({
  children,
  className,
  align = "start",
  sideOffset = 6,
  onOpenAutoFocus,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end" | "center";
  sideOffset?: number;
  onOpenAutoFocus?: (e: Event) => void;
}) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn("pop z-50 rounded-xl bg-popover shadow-[var(--shadow-ring),var(--shadow-lg)] focus:outline-none", className)}
      >
        {children}
      </P.Content>
    </P.Portal>
  );
}
