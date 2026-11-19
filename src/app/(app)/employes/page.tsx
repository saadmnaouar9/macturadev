import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer } from "@/components/ui/page-header";
import { formatMAD } from "@/lib/money";
import { EmployeesView } from "@/components/modules/views";

export const metadata: Metadata = { title: "Employés" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth("settings");
  const sp = await searchParams;
  const { q, sort, dir, page, status } = parseListParams(sp, ["lastName", "hireDate", "createdAt"], "lastName");
  const companyId = auth.company.id;
  const where: Prisma.EmployeeWhereInput = {
    companyId,
    ...(status === "inactive" ? { active: false } : status === "tous" ? {} : { active: true }),
    ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { position: { contains: q, mode: "insensitive" } }, { department: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total, activeAgg, inactive] = await Promise.all([
    db.employee.findMany({ where, orderBy: { [sort]: sp.sort ? dir : "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.employee.count({ where }),
    db.employee.aggregate({ where: { companyId, active: true }, _count: true, _sum: { salary: true } }),
    db.employee.count({ where: { companyId, active: false } }),
  ]);
  return (
    <PageContainer>
      <EmployeesView
        rows={rows.map((r) => ({ ...r, fullName: `${r.firstName} ${r.lastName}`, salary: Number(r.salary), state: r.active ? "ACTIVE" : "INACTIVE", hireDate: r.hireDate?.toISOString() ?? null, createdAt: undefined, updatedAt: undefined }))}
        total={total} page={page} pageSize={PAGE_SIZE} hasQuery={!!q || !!status}
        canWrite={can(auth.role, "settings")} canDelete={can(auth.role, "settings")}
        filters={[{ param: "status", layoutId: "employee-status", options: [{ value: "", label: "Actifs", count: activeAgg._count }, { value: "inactive", label: "Partis", count: inactive }, { value: "tous", label: "Tous", count: activeAgg._count + inactive }] }]}
        summary={[
          { label: "Effectif actif", value: String(activeAgg._count) },
          { label: "Masse salariale brute", value: formatMAD(activeAgg._sum.salary ?? 0n), sub: "par mois" },
          { label: "Salaire moyen", value: activeAgg._count ? formatMAD(Math.round(Number(activeAgg._sum.salary ?? 0n) / activeAgg._count)) : "—" },
        ]}
      />
    </PageContainer>
  );
}
