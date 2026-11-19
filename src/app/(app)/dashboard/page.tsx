import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getDashboard, type Period } from "@/lib/dashboard";
import { can } from "@/lib/permissions";
import { PageContainer } from "@/components/ui/page-header";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const period: Period = sp.period === "30d" || sp.period === "ytd" ? sp.period : "12m";
  const data = await getDashboard(auth.company.id, period);
  return (
    <PageContainer>
      <DashboardView data={data} firstName={auth.user.name.split(" ")[0]} canWrite={can(auth.role, "write")} welcome={sp.welcome === "1"} forbidden={sp.forbidden === "1"} />
    </PageContainer>
  );
}
