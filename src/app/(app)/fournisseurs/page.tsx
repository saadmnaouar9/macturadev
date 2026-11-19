import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer } from "@/components/ui/page-header";
import { formatMAD } from "@/lib/money";
import { SuppliersView } from "@/components/modules/views";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page } = parseListParams(sp, ["name", "createdAt"], "name");
  const companyId = auth.company.id;
  const where: Prisma.SupplierWhereInput = { companyId, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { ice: { contains: q } }] } : {}) };
  const [rows, total, totalAll, due] = await Promise.all([
    db.supplier.findMany({ where, orderBy: { [sort]: sp.sort ? dir : "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { _count: { select: { purchases: true } } } }),
    db.supplier.count({ where }),
    db.supplier.count({ where: { companyId } }),
    db.purchase.groupBy({ by: ["supplierId"], where: { companyId, cancelledAt: null, paymentStatus: { not: "PAID" } }, _sum: { total: true, amountPaid: true } }),
  ]);
  const balance = (id: string) => { const d = due.find((x) => x.supplierId === id); return d ? Number((d._sum.total ?? 0n) - (d._sum.amountPaid ?? 0n)) : 0; };
  const payable = due.reduce((s, d) => s + (d._sum.total ?? 0n) - (d._sum.amountPaid ?? 0n), 0n);
  return (
    <PageContainer>
      <SuppliersView
        rows={rows.map((r) => ({ ...r, contact: [r.contactName, r.email ?? r.phone].filter(Boolean).join(" · "), purchaseCount: r._count.purchases, balance: balance(r.id), createdAt: undefined, updatedAt: undefined, _count: undefined }))}
        total={total} page={page} pageSize={PAGE_SIZE} hasQuery={!!q}
        canWrite={can(auth.role, "write")} canDelete={can(auth.role, "delete")}
        summary={[
          { label: "Fournisseurs", value: String(totalAll) },
          { label: "Total à payer", value: formatMAD(payable), sub: `${due.length} fournisseur${due.length > 1 ? "s" : ""} concerné${due.length > 1 ? "s" : ""}`, tone: payable > 0n ? "warn" : "default" },
        ]}
      />
    </PageContainer>
  );
}
