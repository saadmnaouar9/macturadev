import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { UserPlus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { issuedWhere, outstandingWhere } from "@/lib/status";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { CustomersTable } from "@/components/clients/customers-table";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, type, status } = parseListParams(sp, ["name", "createdAt", "city"], "createdAt");
  const companyId = auth.company.id;

  const where: Prisma.CustomerWhereInput = {
    companyId,
    archived: status === "archived",
    ...(type === "COMPANY" || type === "INDIVIDUAL" ? { type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nameAr: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { ice: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total, counts, archivedCount] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, type: true, name: true, nameAr: true, email: true, phone: true, mobile: true, city: true, ice: true, createdAt: true, archived: true, _count: { select: { invoices: true, quotes: true } } },
    }),
    db.customer.count({ where }),
    db.customer.groupBy({ by: ["type"], where: { companyId, archived: false }, _count: true }),
    db.customer.count({ where: { companyId, archived: true } }),
  ]);

  const ids = rows.map((r) => r.id);
  const [invoiced, outstanding] = ids.length
    ? await Promise.all([
        db.invoice.groupBy({ by: ["customerId"], where: { companyId, customerId: { in: ids }, ...issuedWhere }, _sum: { total: true } }),
        db.invoice.groupBy({ by: ["customerId"], where: { companyId, customerId: { in: ids }, ...outstandingWhere }, _sum: { total: true, amountPaid: true } }),
      ])
    : [[], []];

  const data = rows.map((r) => {
    const inv = invoiced.find((x) => x.customerId === r.id);
    const out = outstanding.find((x) => x.customerId === r.id);
    return {
      ...r,
      createdAt: r.createdAt.toISOString(),
      invoiced: Number(inv?._sum.total ?? 0n),
      outstanding: Number((out?._sum.total ?? 0n) - (out?._sum.amountPaid ?? 0n)),
    };
  });

  const companyCount = counts.find((c) => c.type === "COMPANY")?._count ?? 0;
  const individualCount = counts.find((c) => c.type === "INDIVIDUAL")?._count ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Clients"
        description="Gérez vos clients particuliers et entreprises, et suivez leur historique commercial."
        actions={
          can(auth.role, "write") && (
            <ButtonLink href="/clients/new">
              <UserPlus className="h-4 w-4" /> Nouveau client
            </ButtonLink>
          )
        }
      />
      <CustomersTable
        rows={data}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        hasQuery={!!q || !!type}
        archivedView={status === "archived"}
        counts={{ all: companyCount + individualCount, company: companyCount, individual: individualCount, archived: archivedCount }}
        canWrite={can(auth.role, "write")}
        canDelete={can(auth.role, "delete")}
      />
    </PageContainer>
  );
}
