import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer } from "@/components/ui/page-header";
import { PurchasesView } from "@/components/modules/purchases-view";
import { formatMAD, formatRate } from "@/lib/money";
import { INVOICE_STATUS, purchaseDisplayStatus } from "@/lib/status";
import { addDays, toDateInput, todayUTC } from "@/lib/utils";

export const metadata: Metadata = { title: "Achats" };

function statusWhere(s: string): Prisma.PurchaseWhereInput {
  const today = todayUTC();
  switch (s) {
    case "UNPAID": case "PARTIAL": return { cancelledAt: null, paymentStatus: s, dueDate: { gte: today } };
    case "OVERDUE": return { cancelledAt: null, paymentStatus: { not: "PAID" }, dueDate: { lt: today } };
    case "PAID": return { cancelledAt: null, paymentStatus: "PAID" };
    case "CANCELLED": return { cancelledAt: { not: null } };
    default: return {};
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, status } = parseListParams(sp, ["reference", "issueDate", "dueDate", "total"], "issueDate");
  const companyId = auth.company.id;
  const today = todayUTC();
  const search: Prisma.PurchaseWhereInput = q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { supplier: { name: { contains: q, mode: "insensitive" } } }, { category: { contains: q, mode: "insensitive" } }] } : {};
  const where: Prisma.PurchaseWhereInput = { companyId, ...search, AND: [statusWhere(status)] };
  const tabs = ["UNPAID", "PARTIAL", "OVERDUE", "PAID", "CANCELLED"];
  const [rows, total, agg, suppliers, taxRates, company, allCount, ...counts] = await Promise.all([
    db.purchase.findMany({ where, orderBy: [{ [sort]: dir }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { supplier: { select: { name: true } }, payments: { orderBy: { date: "desc" } } } }),
    db.purchase.count({ where }),
    db.purchase.aggregate({ where: { companyId, cancelledAt: null }, _sum: { total: true, amountPaid: true } }),
    db.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.taxRate.findMany({ where: { companyId }, orderBy: { rate: "desc" } }),
    db.company.findUniqueOrThrow({ where: { id: companyId }, select: { defaultTaxRate: true } }),
    db.purchase.count({ where: { companyId, ...search } }),
    ...tabs.map((s) => db.purchase.count({ where: { companyId, ...search, AND: [statusWhere(s)] } })),
  ]);
  const overdue = await db.purchase.aggregate({ where: { companyId, ...statusWhere("OVERDUE") }, _sum: { total: true, amountPaid: true } });
  const due = (agg._sum.total ?? 0n) - (agg._sum.amountPaid ?? 0n);
  const badges = Object.fromEntries(tabs.map((t) => [t, INVOICE_STATUS[t as keyof typeof INVOICE_STATUS].label]));
  return (
    <PageContainer>
      <PurchasesView
        suppliers={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        taxRates={taxRates.map((t) => ({ value: String(t.rate), label: `${t.name || `TVA ${formatRate(t.rate)} %`}` }))}
        defaults={{ supplierId: suppliers.some((s) => s.id === sp.supplier) ? sp.supplier! : "", taxRate: String(company.defaultTaxRate), issueDate: toDateInput(today), dueDate: toDateInput(addDays(today, 30)) }}
        rows={rows.map((r) => ({
          id: r.id, supplierId: r.supplierId, reference: r.reference, supplierName: r.supplier.name, category: r.category, notes: r.notes,
          issueDate: r.issueDate.toISOString(), dueDate: r.dueDate.toISOString(), subtotal: Number(r.subtotal), taxRate: r.taxRate, total: Number(r.total),
          balance: r.cancelledAt ? 0 : Number(r.total - r.amountPaid), status: purchaseDisplayStatus(r), cancelled: !!r.cancelledAt,
          activePayments: r.payments.filter((x) => !x.voidedAt).length, paymentCount: r.payments.length,
          payments: r.payments.map((x) => ({ id: x.id, amount: Number(x.amount), date: x.date.toISOString(), method: x.method, reference: x.reference, voidedAt: x.voidedAt?.toISOString() ?? null, voidReason: x.voidReason })),
        }))}
        total={total} page={page} pageSize={PAGE_SIZE} hasQuery={!!q || !!status}
        canWrite={can(auth.role, "write")} canDelete={can(auth.role, "delete")}
        filters={[{ param: "status", layoutId: "purchase-status", options: [{ value: "", label: "Toutes", count: allCount }, ...tabs.map((t, i) => ({ value: t, label: badges[t], count: counts[i] }))] }]}
        summary={[
          { label: "Achats TTC (hors annulés)", value: formatMAD(agg._sum.total ?? 0n) },
          { label: "Déjà payé", value: formatMAD(agg._sum.amountPaid ?? 0n), tone: "good" },
          { label: "Reste à payer", value: formatMAD(due), tone: due > 0n ? "warn" : "default" },
          { label: "En retard de paiement", value: formatMAD((overdue._sum.total ?? 0n) - (overdue._sum.amountPaid ?? 0n)), tone: "bad" },
        ]}
      />
    </PageContainer>
  );
}
