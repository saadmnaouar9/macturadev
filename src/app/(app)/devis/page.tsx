import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { FilePlus2 } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { quoteStatusWhere } from "@/lib/document-filters";
import { quoteDisplayStatus } from "@/lib/status";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { QuotesTable } from "@/components/documents/quotes-table";

export const metadata: Metadata = { title: "Devis" };

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, status } = parseListParams(sp, ["number", "issueDate", "expiryDate", "total"], "issueDate");
  const companyId = auth.company.id;
  const search: Prisma.QuoteWhereInput = q
    ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] }
    : {};
  const where: Prisma.QuoteWhereInput = { companyId, ...search, AND: [quoteStatusWhere(status)] };

  const [rows, total, sum, ...counts] = await Promise.all([
    db.quote.findMany({
      where,
      orderBy: [{ [sort]: dir }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, number: true, status: true, issueDate: true, expiryDate: true, total: true, reference: true, customer: { select: { id: true, name: true } }, invoice: { select: { id: true, number: true } } },
    }),
    db.quote.count({ where }),
    db.quote.aggregate({ where, _sum: { total: true } }),
    db.quote.count({ where: { companyId, ...search } }),
    ...STATUSES.map((s) => db.quote.count({ where: { companyId, ...search, AND: [quoteStatusWhere(s)] } })),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Devis"
        description="Créez, envoyez et suivez vos propositions commerciales jusqu'à leur conversion en facture."
        actions={can(auth.role, "write") && <ButtonLink href="/devis/new"><FilePlus2 className="h-4 w-4" /> Nouveau devis</ButtonLink>}
      />
      <QuotesTable
        rows={rows.map((r) => ({
          id: r.id, number: r.number, status: quoteDisplayStatus(r), rawStatus: r.status, issueDate: r.issueDate.toISOString(), expiryDate: r.expiryDate.toISOString(),
          total: Number(r.total), reference: r.reference, customer: r.customer, invoice: r.invoice,
        }))}
        total={total}
        sum={Number(sum._sum.total ?? 0n)}
        page={page}
        pageSize={PAGE_SIZE}
        hasQuery={!!q || !!status}
        counts={{ all: counts[0], ...Object.fromEntries(STATUSES.map((s, i) => [s, counts[i + 1]])) } as Record<string, number>}
        canWrite={can(auth.role, "write")}
        canDelete={can(auth.role, "delete")}
      />
    </PageContainer>
  );
}
