import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Clock } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs, ListState, Pagination, SearchInput } from "@/components/data/list-state";
import { JournalFeed, type JournalRow } from "@/components/modules/journal-feed";

export const metadata: Metadata = { title: "Journal d'activité" };

const GROUPS: Record<string, { label: string; prefixes: string[] }> = {
  sales: { label: "Ventes", prefixes: ["invoice.", "quote.", "customer.", "contract."] },
  payments: { label: "Paiements", prefixes: ["payment.", "purchase.paid", "purchase.payment_voided"] },
  purchases: { label: "Achats", prefixes: ["purchase.created", "purchase.updated", "purchase.cancelled", "supplier."] },
  cash: { label: "Trésorerie", prefixes: ["cash."] },
  org: { label: "Organisation", prefixes: ["project.", "task.", "employee.", "prospect.", "product.", "company."] },
};

function hrefFor(type: string, entityType: string, entityId: string) {
  if (entityType === "invoice") return `/factures/${entityId}`;
  if (entityType === "quote") return `/devis/${entityId}`;
  if (entityType === "customer") return `/clients/${entityId}`;
  if (entityType === "purchase") return `/achats`;
  const map: Record<string, string> = { supplier: "/fournisseurs", prospect: "/prospects", project: "/projets", task: "/taches", contract: "/contrats", employee: "/employes", cash: "/caisse", product: "/produits", company: "/parametres" };
  return map[entityType] ?? null as unknown as string;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, page, get } = parseListParams(sp, [], "createdAt");
  const group = get("group") ?? "";
  const companyId = auth.company.id;
  const groupWhere: Prisma.ActivityWhereInput = GROUPS[group] ? { OR: GROUPS[group].prefixes.map((p) => ({ type: { startsWith: p } })) } : {};
  const where: Prisma.ActivityWhereInput = { companyId, ...(q ? { message: { contains: q, mode: "insensitive" } } : {}), AND: [groupWhere] };
  const [rows, total, all] = await Promise.all([
    db.activity.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE * 2, take: PAGE_SIZE * 2, include: { user: { select: { name: true } } } }),
    db.activity.count({ where }),
    db.activity.count({ where: { companyId } }),
  ]);
  const feed: JournalRow[] = rows.map((a) => ({
    id: a.id,
    createdAt: a.createdAt.toISOString(),
    message: a.message,
    type: a.type,
    userName: a.user?.name ?? null,
    amount: a.amount ? Number(a.amount) : null,
    href: hrefFor(a.type, a.entityType, a.entityId) ?? null,
  }));
  return (
    <PageContainer>
      <PageHeader title="Journal d'activité" description="Piste d'audit : chaque création, modification, paiement et annulation est tracé avec son auteur." />
      <ListState>
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <FilterTabs param="group" layoutId="journal-group" options={[{ value: "", label: "Tout", count: all }, ...Object.entries(GROUPS).map(([v, g]) => ({ value: v, label: g.label }))]} />
          <SearchInput placeholder="Rechercher dans le journal…" className="xl:w-72" />
        </div>
        {rows.length === 0 ? (
          <Card><EmptyState icon={Clock} title="Aucune activité" description="Aucun événement ne correspond à ces critères." /></Card>
        ) : (
          <>
            <JournalFeed rows={feed} total={total} />
            <Card className="mt-6 overflow-hidden"><Pagination page={page} pageSize={PAGE_SIZE * 2} total={total} /></Card>
          </>
        )}
      </ListState>
    </PageContainer>
  );
}
