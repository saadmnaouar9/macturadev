import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getShellData } from "@/lib/notifications";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const [{ counts, notifications }, jar] = await Promise.all([getShellData(auth.company.id, auth.notificationsSeenAt), cookies()]);
  return (
    <AppShell
      user={{ name: auth.user.name, email: auth.user.email, role: auth.role, companyName: auth.company.name }}
      counts={counts}
      notifications={notifications}
      initialCollapsed={jar.get("sidebar_collapsed")?.value === "1"}
      canWrite={can(auth.role, "write")}
    >
      {children}
    </AppShell>
  );
}
