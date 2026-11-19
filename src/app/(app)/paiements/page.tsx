import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PAYMENT_METHODS } from "@/lib/status";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { PaymentsView } from "@/components/modules/payments-view";

export const metadata: Metadata = { title: "Paiements" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, get } = parseListParams(sp, ["date", "amount"], "date");
  const kind = get("type") === "out" ? "out" : "in";
  const state = get("state") === "voided" ? "voided" : "active";
  const method = get("method") ?? "";
  const companyId = auth.company.id;
  const common = { companyId, voidedAt: state === "voided" ? { not: null } : null, ...(method in PAYMENT_METHODS ? { method: method as never } : {}) };
  // Répartition par mode : mêmes filtres, hors filtre de mode (sinon un seul mode apparaîtrait)
  const base = { companyId, voidedAt: state === "voided" ? { not: null } : null };

  const [inRows, outRows, total, sum, inCount, outCount, byMethod] = await Promise.all([
    kind === "in"
      ? db.payment.findMany({
          where: { ...common, ...(q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { invoice: { number: { contains: q, mode: "insensitive" } } }, { invoice: { customer: { name: { contains: q, mode: "insensitive" } } } }] } : {}) } as Prisma.PaymentWhereInput,
          orderBy: [{ [sort]: dir }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
          include: { invoice: { select: { id: true, number: true, customer: { select: { id: true, name: true } } } } },
        })
      : [],
    kind === "out"
      ? db.purchasePayment.findMany({
          where: { ...common, ...(q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { purchase: { reference: { contains: q, mode: "insensitive" } } }, { purchase: { supplier: { name: { contains: q, mode: "insensitive" } } } }] } : {}) } as Prisma.PurchasePaymentWhereInput,
          orderBy: [{ [sort]: dir }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
          include: { purchase: { select: { id: true, reference: true, supplier: { select: { id: true, name: true } } } } },
        })
      : [],
    kind === "in"
      ? db.payment.count({ where: common as Prisma.PaymentWhereInput })
      : db.purchasePayment.count({ where: common as Prisma.PurchasePaymentWhereInput }),
    kind === "in"
      ? db.payment.aggregate({ where: common as Prisma.PaymentWhereInput, _sum: { amount: true } })
      : db.purchasePayment.aggregate({ where: common as Prisma.PurchasePaymentWhereInput, _sum: { amount: true } }),
    db.payment.count({ where: { companyId, voidedAt: null } }),
    db.purchasePayment.count({ where: { companyId, voidedAt: null } }),
    kind === "in"
      ? db.payment.groupBy({ by: ["method"], where: base as Prisma.PaymentWhereInput, _sum: { amount: true }, _count: true })
      : db.purchasePayment.groupBy({ by: ["method"], where: base as Prisma.PurchasePaymentWhereInput, _sum: { amount: true }, _count: true }),
  ]);

  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const rows = kind === "in"
    ? inRows.map((p) => ({ id: p.id, date: p.date.toISOString(), amount: Number(p.amount), method: p.method, reference: p.reference, doc: p.invoice.number ?? "—", party: p.invoice.customer.name, href: `/factures/${p.invoice.id}`, partyHref: `/clients/${p.invoice.customer.id}`, voidedAt: iso(p.voidedAt), voidReason: p.voidReason }))
    : outRows.map((p) => ({ id: p.id, date: p.date.toISOString(), amount: Number(p.amount), method: p.method, reference: p.reference, doc: p.purchase.reference, party: p.purchase.supplier.name, href: `/achats?q=${encodeURIComponent(p.purchase.reference)}`, partyHref: `/fournisseurs?q=${encodeURIComponent(p.purchase.supplier.name)}`, voidedAt: iso(p.voidedAt), voidReason: p.voidReason }));

  return (
    <PageContainer>
      <PageHeader title="Paiements" description="Historique complet des encaissements clients et des règlements fournisseurs, y compris les paiements annulés." />
      <PaymentsView
        rows={rows}
        kind={kind}
        state={state}
        total={total}
        sum={Number(sum._sum.amount ?? 0n)}
        page={page}
        pageSize={PAGE_SIZE}
        inCount={inCount}
        outCount={outCount}
        methods={byMethod.map((m) => ({ method: m.method, amount: Number(m._sum.amount ?? 0n), count: m._count }))}
      />
    </PageContainer>
  );
}
