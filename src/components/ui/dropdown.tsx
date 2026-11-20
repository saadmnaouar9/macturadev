"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownTrigger = M.Trigger;

export function DropdownContent({ children, align = "end", className, sideOffset = 6 }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string; sideOffset?: number }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "pop z-50 min-w-[200px] overflow-hidden rounded-xl bg-popover p-1 shadow-[var(--shadow-ring),var(--shadow-lg)] focus:outline-none",
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

const itemCls =
  "group flex w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-soft outline-none transition-colors data-[highlighted]:bg-subtle data-[highlighted]:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-faint data-[highlighted]:[&_svg]:text-ink-soft";

export function DropdownItem({
  children,
  onSelect,
  href,
  danger,
  disabled,
  shortcut,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) {
  const cls = cn(itemCls, danger && "text-rose-600 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-700 [&_svg]:text-rose-500 data-[highlighted]:[&_svg]:text-rose-600");
  const content = (
    <>
      {children}
      {shortcut && <span className="ml-auto pl-4 text-[11px] tracking-wide text-faint">{shortcut}</span>}
    </>
  );
  if (href) {
    return (
      <M.Item asChild disabled={disabled} className={cls}>
        <Link href={href}>{content}</Link>
      </M.Item>
    );
  }
  return (
    <M.Item disabled={disabled} onSelect={onSelect} className={cls}>
      {content}
    </M.Item>
  );
}

export function DropdownSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line-soft" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <M.Label className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-faint">{children}</M.Label>;
}
