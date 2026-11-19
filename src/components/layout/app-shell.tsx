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
import { TopProgress } from "./top-progress";
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
      <TopProgress />
      <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-[1] overflow-hidden">
        <div className="ambient-orb -right-40 -top-10 h-[620px] w-[760px] bg-[radial-gradient(closest-side,rgb(37_99_235/0.3),transparent)]" />
        <div className="ambient-orb -bottom-24 left-1/4 h-[560px] w-[700px] bg-[radial-gradient(closest-side,rgb(124_58_237/0.24),transparent)] [animation-delay:-8s]" />
      </div>
      <div className="flex min-h-dvh">
        {/* Barre latérale desktop */}
        <motion.aside
          data-theme="dark"
          initial={false}
          animate={{ width: collapsed ? 68 : 252 }}
          transition={{ duration: 0.35, ease }}
          className="sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-line-soft bg-[#060d26] lg:block"
        >
          <SidebarContent user={user} collapsed={collapsed} onToggle={toggle} counts={counts} />
        </motion.aside>

        {/* Barre latérale mobile */}
        <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <AnimatePresence>
            {mobileOpen && (
              <D.Portal forceMount>
                <D.Overlay asChild forceMount>
                  <motion.div className="fixed inset-0 z-50 bg-[#020617]/65 backdrop-blur-[2px] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                </D.Overlay>
                <D.Content asChild forceMount>
                  <motion.aside
                    data-theme="dark"
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                    transition={{ duration: 0.38, ease }}
                    className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[#060d26] shadow-2xl focus:outline-none lg:hidden"
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
