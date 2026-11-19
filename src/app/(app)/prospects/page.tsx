import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer } from "@/components/ui/page-header";
import { formatMAD } from "@/lib/money";
import { ProspectsView } from "@/components/modules/views";
import { PROSPECT_STATUS } from "@/lib/status";

export const metadata: Metadata = { title: "Prospects" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, status } = parseListParams(sp, ["name", "value", "createdAt", "nextActionDate"], "createdAt");
  const companyId = auth.company.id;
  const where: Prisma.ProspectWhereInput = {
    companyId,
    ...(status in PROSPECT_STATUS ? { status: status as never } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
  };
  const [rows, total, groups] = await Promise.all([
    db.prospect.findMany({ where, orderBy: { [sort]: dir }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.prospect.count({ where }),
    db.prospect.groupBy({ by: ["status"], where: { companyId }, _count: true, _sum: { value: true } }),
  ]);
  const g = (s: string) => groups.find((x) => x.status === s);
  const count = (s: string) => g(s)?._count ?? 0;
  const open = groups.filter((x) => x.status !== "WON" && x.status !== "LOST");
  const openValue = open.reduce((s, x) => s + (x._sum.value ?? 0n), 0n);
  const won = count("WON"), lost = count("LOST");
  const dueCount = await db.prospect.count({ where: { companyId, status: { notIn: ["WON", "LOST"] }, nextActionDate: { lte: new Date() } } });
  return (
    <PageContainer>
      <ProspectsView
        rows={rows.map((r) => ({ ...r, value: Number(r.value), contact: [r.contactName, r.email ?? r.phone].filter(Boolean).join(" · "), nextActionDate: r.nextActionDate?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), updatedAt: undefined }))}
        stats={{
          openValue: Number(openValue), openCount: open.reduce((s, x) => s + x._count, 0), wonValue: Number(g("WON")?._sum.value ?? 0n), wonCount: won,
          conversionBp: won + lost ? Math.round((won / (won + lost)) * 10000) : null, dueCount,
          pipeline: Object.keys(PROSPECT_STATUS).map((s) => ({ status: s, count: count(s), value: Number(g(s)?._sum.value ?? 0n) })),
        }}
        total={total} page={page} pageSize={PAGE_SIZE} hasQuery={!!q || !!status}
        canWrite={can(auth.role, "write")} canDelete={can(auth.role, "delete")}
        filters={[{ param: "status", layoutId: "prospect-status", options: [{ value: "", label: "Tous", count: groups.reduce((s, x) => s + x._count, 0) }, ...Object.entries(PROSPECT_STATUS).map(([v, s]) => ({ value: v, label: s.label, count: count(v) }))] }]}
        summary={[
          { label: "Pipeline ouvert", value: formatMAD(openValue), sub: `${open.reduce((s, x) => s + x._count, 0)} opportunités` },
          { label: "Affaires gagnées", value: formatMAD(g("WON")?._sum.value ?? 0n), sub: `${won} prospect${won > 1 ? "s" : ""}`, tone: "good" },
          { label: "Taux de conversion", value: won + lost ? `${((won / (won + lost)) * 100).toFixed(0)} %` : "—", sub: "gagnés / clôturés" },
          { label: "À relancer", value: String(dueCount), sub: "relances échues", tone: "warn" },
        ]}
      />
    </PageContainer>
  );
}
