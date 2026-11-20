import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Clock } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { formatMAD } from "@/lib/money";
import { formatDate, initials } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs, ListState, Pagination, Row, SearchInput, Table, Td, Th, THead } from "@/components/data/list-state";

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
  return (
    <PageContainer>
      <PageHeader title="Journal d'activité" description="Piste d'audit : chaque création, modification, paiement et annulation est tracé avec son auteur." />
      <ListState>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
            <FilterTabs param="group" layoutId="journal-group" options={[{ value: "", label: "Tout", count: all }, ...Object.entries(GROUPS).map(([v, g]) => ({ value: v, label: g.label }))]} />
            <SearchInput placeholder="Rechercher dans le journal…" />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Clock} title="Aucune activité" description="Aucun événement ne correspond à ces critères." />
          ) : (
            <>
              <Table>
                <THead>
                  <Th>Date</Th>
                  <Th>Événement</Th>
                  <Th className="hidden md:table-cell">Utilisateur</Th>
                  <Th align="right" className="hidden sm:table-cell">Montant</Th>
                </THead>
                <tbody>
                  {rows.map((a, i) => {
                    const href = hrefFor(a.type, a.entityType, a.entityId);
                    return (
                      <Row key={a.id} index={i} href={href ?? undefined}>
                        <Td className="whitespace-nowrap text-[13px] text-ink-soft">
                          {formatDate(a.createdAt)}
                          <span className="ml-2 text-xs text-faint">{a.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })}</span>
                        </Td>
                        <Td>
                          <span className="text-[13px] text-ink">{href ? <Link prefetch={false} href={href} className="hover:text-brand-700">{a.message}</Link> : a.message}</span>
                          <span className="block font-mono text-[11px] text-faint">{a.type}</span>
                        </Td>
                        <Td className="hidden md:table-cell">
                          {a.user ? (
                            <span className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-50 text-[10px] font-semibold text-accent-600">{initials(a.user.name)}</span>
                              {a.user.name}
                            </span>
                          ) : <span className="text-faint">Système</span>}
                        </Td>
                        <Td align="right" className="hidden text-[13px] tabular text-ink-soft sm:table-cell">{a.amount ? formatMAD(a.amount) : "—"}</Td>
                      </Row>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE * 2} total={total} />
            </>
          )}
        </Card>
      </ListState>
    </PageContainer>
  );
}
