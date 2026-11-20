"use client";

import { useState, useTransition } from "react";
import Link from "@/components/ui/fast-link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCheck, CircleDollarSign, Clock, FileCheck2, Inbox } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatRelative } from "@/lib/utils";
import { markNotificationsSeen } from "@/app/(app)/actions";

export interface NotificationItem {
  id: string;
  kind: "overdue" | "expiring" | "payment" | "accepted" | "activity";
  title: string;
  description: string;
  href: string;
  date: string;
  unread: boolean;
}

const ICONS = {
  overdue: { icon: AlertTriangle, cls: "bg-rose-50 text-rose-600" },
  expiring: { icon: Clock, cls: "bg-amber-50 text-amber-600" },
  payment: { icon: CircleDollarSign, cls: "bg-emerald-50 text-emerald-600" },
  accepted: { icon: FileCheck2, cls: "bg-brand-50 text-brand-600" },
  activity: { icon: Inbox, cls: "bg-subtle text-muted" },
};

export function Notifications({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [, start] = useTransition();
  const unread = seen ? 0 : items.filter((i) => i.unread).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink data-[state=open]:bg-subtle data-[state=open]:text-ink" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
          <Bell className="h-[18px] w-[18px]" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-canvas"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => {
                setSeen(true);
                start(() => markNotificationsSeen());
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
            </button>
          )}
        </div>
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell className="mx-auto h-6 w-6 text-faint" />
              <p className="mt-2 text-sm font-medium text-ink">Vous êtes à jour</p>
              <p className="text-xs text-muted">Aucune notification pour le moment.</p>
            </div>
          ) : (
            items.map((n, i) => {
              const I = ICONS[n.kind];
              return (
                <motion.div key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025, duration: 0.25 }}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex gap-3 border-b border-line-soft px-4 py-3 transition-colors last:border-0 hover:bg-subtle/70">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", I.cls)}>
                      <I.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">{n.title}</span>
                        {n.unread && !seen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">{n.description}</span>
                      <span className="mt-1 block text-[11px] text-faint">{formatRelative(n.date)}</span>
                    </span>
                  </Link>
                </motion.div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
