"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import type { Role } from "@prisma/client";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";
import { BreadcrumbProvider } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import type { NotificationItem } from "./notifications";

export interface ShellUser {
  name: string;
  email: string;
  role: Role;
  companyName: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

export function AppShell({
  user,
  counts,
  notifications,
  initialCollapsed,
  canWrite,
  children,
}: {
  user: ShellUser;
  counts: { overdue: number; pendingQuotes: number; lateTasks: number };
  notifications: NotificationItem[];
  initialCollapsed: boolean;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `sidebar_collapsed=${!c ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  return (
    <BreadcrumbProvider>
      <div className="flex min-h-dvh">
        {/* Barre latérale desktop */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 68 : 252 }}
          transition={{ duration: 0.35, ease }}
          className="sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-black/[0.05] bg-[#f3f3f7] lg:block"
        >
          <SidebarContent user={user} collapsed={collapsed} onToggle={toggle} counts={counts} />
        </motion.aside>

        {/* Barre latérale mobile */}
        <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <AnimatePresence>
            {mobileOpen && (
              <D.Portal forceMount>
                <D.Overlay asChild forceMount>
                  <motion.div className="fixed inset-0 z-50 bg-[#0e1124]/30 backdrop-blur-[2px] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                </D.Overlay>
                <D.Content asChild forceMount>
                  <motion.aside
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                    transition={{ duration: 0.38, ease }}
                    className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[#f3f3f7] shadow-2xl focus:outline-none lg:hidden"
                  >
                    <D.Title className="sr-only">Navigation</D.Title>
                    <D.Description className="sr-only">Menu principal de Mactura</D.Description>
                    <SidebarContent user={user} collapsed={false} counts={counts} onNavigate={() => setMobileOpen(false)} mobile />
                  </motion.aside>
                </D.Content>
              </D.Portal>
            )}
          </AnimatePresence>
        </D.Root>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMenu={() => setMobileOpen(true)} onOpenSearch={() => setPaletteOpen(true)} notifications={notifications} canWrite={canWrite} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} canWrite={canWrite} />
    </BreadcrumbProvider>
  );
}
