import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getReports, parsePeriod } from "@/lib/reports";
import { toDateInput, todayUTC } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page-header";
import { ReportsView } from "@/components/modules/reports-view";

export const metadata: Metadata = { title: "Rapports" };

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const period = parsePeriod(sp.from, sp.to);
  const data = await getReports(auth.company.id, period);
  return (
    <PageContainer className="max-w-[1400px]">
      <ReportsView data={data} from={period.fromStr} to={period.toStr} today={toDateInput(todayUTC())} />
    </PageContainer>
  );
}
