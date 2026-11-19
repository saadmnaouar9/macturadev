import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadLedger, LEDGER_PAGE_SIZE } from "@/lib/ledger-page";
import { PageContainer } from "@/components/ui/page-header";
import { LedgerView } from "@/components/modules/ledger-view";

export const metadata: Metadata = { title: "Caisse" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const d = await loadLedger(auth.company.id, await searchParams, "CASH");
  return (
    <PageContainer>
      <LedgerView mode="caisse" rows={d.rows} total={d.total} page={d.page} pageSize={LEDGER_PAGE_SIZE} hasQuery={d.hasQuery} balances={d.balances} month={d.month} cashflow={d.cashflow} forecast={d.forecast} canWrite={can(auth.role, "write")} canDelete={can(auth.role, "delete")} canSettings={can(auth.role, "settings")} />
    </PageContainer>
  );
}
