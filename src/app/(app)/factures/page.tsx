import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { FilePlus2 } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { invoiceStatusWhere } from "@/lib/document-filters";
import { invoiceDisplayStatus, issuedWhere } from "@/lib/status";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { InvoicesTable } from "@/components/documents/invoices-table";

export const metadata: Metadata = { title: "Factures" };

const TABS = ["DRAFT", "ISSUED", "SENT", "OUTSTANDING", "UNPAID", "PARTIAL", "OVERDUE", "PAID", "CANCELLED"] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, status } = parseListParams(sp, ["number", "issueDate", "dueDate", "total"], "issueDate");
  const companyId = auth.company.id;
  const search: Prisma.InvoiceWhereInput = q
    ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] }
    : {};
  const where: Prisma.InvoiceWhereInput = { companyId, ...search, AND: [invoiceStatusWhere(status)] };

  const [rows, total, agg, ...counts] = await Promise.all([
    db.invoice.findMany({
      where,
      // Les brouillons (sans numéro) apparaissent en tête lors du tri par numéro décroissant
      orderBy: [sort === "number" ? { number: { sort: dir, nulls: dir === "desc" ? "first" : "last" } } : { [sort]: dir }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, number: true, status: true, paymentStatus: true, issueDate: true, dueDate: true, total: true, amountPaid: true, reference: true, customer: { select: { id: true, name: true } }, quote: { select: { number: true } } },
    }),
    db.invoice.count({ where }),
    db.invoice.aggregate({ where: { AND: [where, issuedWhere] }, _sum: { total: true, amountPaid: true } }),
    db.invoice.count({ where: { companyId, ...search } }),
    ...TABS.map((s) => db.invoice.count({ where: { companyId, ...search, AND: [invoiceStatusWhere(s)] } })),
  ]);

  const invoiced = Number(agg._sum.total ?? 0n);
  const paid = Number(agg._sum.amountPaid ?? 0n);

  return (
    <PageContainer>
      <PageHeader
        title="Factures"
        description="Émettez vos factures, suivez les échéances et enregistrez les paiements."
        actions={can(auth.role, "write") && <ButtonLink href="/factures/new"><FilePlus2 className="h-4 w-4" /> Nouvelle facture</ButtonLink>}
      />
      <InvoicesTable
        rows={rows.map((r) => ({
          id: r.id, number: r.number, status: invoiceDisplayStatus(r), lifecycle: r.status, paymentStatus: r.paymentStatus, issueDate: r.issueDate.toISOString(), dueDate: r.dueDate.toISOString(),
          total: Number(r.total), amountPaid: Number(r.amountPaid), reference: r.reference, customer: r.customer, quoteNumber: r.quote?.number ?? null,
        }))}
        summary={{ invoiced, paid, balance: invoiced - paid }}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        hasQuery={!!q || !!status}
        counts={{ all: counts[0], ...Object.fromEntries(TABS.map((s, i) => [s, counts[i + 1]])) } as Record<string, number>}
        canWrite={can(auth.role, "write")}
        canDelete={can(auth.role, "delete")}
      />
    </PageContainer>
  );
}
