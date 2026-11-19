import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CircleDollarSign } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PAYMENT_METHODS } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead } from "@/components/data/list-state";

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

  const [inRows, outRows, total, sum, inCount, outCount] = await Promise.all([
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
  ]);

  const rows = kind === "in"
    ? inRows.map((p) => ({ id: p.id, date: p.date, amount: p.amount, method: p.method, reference: p.reference, doc: p.invoice.number ?? "—", party: p.invoice.customer.name, href: `/factures/${p.invoice.id}`, partyHref: `/clients/${p.invoice.customer.id}`, voidedAt: p.voidedAt, voidReason: p.voidReason }))
    : outRows.map((p) => ({ id: p.id, date: p.date, amount: p.amount, method: p.method, reference: p.reference, doc: p.purchase.reference, party: p.purchase.supplier.name, href: `/achats?q=${encodeURIComponent(p.purchase.reference)}`, partyHref: `/fournisseurs?q=${encodeURIComponent(p.purchase.supplier.name)}`, voidedAt: p.voidedAt, voidReason: p.voidReason }));

  return (
    <PageContainer>
      <PageHeader title="Paiements" description="Historique complet des encaissements clients et des règlements fournisseurs, y compris les paiements annulés." />
      <ListState>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="px-4 py-3.5">
            <p className="text-xs text-muted">{kind === "in" ? "Total encaissé" : "Total décaissé"} {state === "voided" ? "(annulés)" : "(actifs)"}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular", kind === "in" ? "text-emerald-700" : "text-ink")}>{formatMAD(sum._sum.amount ?? 0n)}</p>
          </Card>
          <Card className="px-4 py-3.5">
            <p className="text-xs text-muted">Nombre de paiements</p>
            <p className="mt-1 text-lg font-semibold tabular text-ink">{total}</p>
          </Card>
        </div>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <FilterTabs param="type" layoutId="pay-type" options={[{ value: "", label: "Encaissements", count: inCount }, { value: "out", label: "Décaissements", count: outCount }]} />
              <div className="hidden h-5 w-px bg-line lg:block" />
              <FilterTabs param="state" layoutId="pay-state" options={[{ value: "", label: "Actifs" }, { value: "voided", label: "Annulés" }]} />
              <div className="hidden h-5 w-px bg-line lg:block" />
              <FilterTabs param="method" layoutId="pay-method" options={[{ value: "", label: "Tous modes" }, { value: "BANK_TRANSFER", label: "Virement" }, { value: "CASH", label: "Espèces" }, { value: "CHECK", label: "Chèque" }, { value: "CARD", label: "Carte" }]} />
            </div>
            <SearchInput placeholder="Référence, document, tiers…" />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={CircleDollarSign} title="Aucun paiement" description="Les paiements apparaîtront ici dès leur enregistrement sur une facture ou un achat." />
          ) : (
            <>
              <Table>
                <THead>
                  <SortHeader field="date">Date</SortHeader>
                  <Th>Document</Th>
                  <Th>{kind === "in" ? "Client" : "Fournisseur"}</Th>
                  <Th className="hidden md:table-cell">Mode</Th>
                  <Th className="hidden lg:table-cell">Référence</Th>
                  <SortHeader field="amount" align="right">Montant</SortHeader>
                </THead>
                <tbody>
                  {rows.map((r, i) => (
                    <Row key={r.id} index={i} href={r.href}>
                      <Td className="text-[13px] text-ink-soft">{formatDate(r.date)}</Td>
                      <Td><span className="font-mono text-[13px] font-medium text-ink">{r.doc}</span></Td>
                      <Td><Link href={r.partyHref} className="text-[13px] font-medium text-ink-soft hover:text-brand-700">{r.party}</Link></Td>
                      <Td className="hidden text-[13px] text-ink-soft md:table-cell">{PAYMENT_METHODS[r.method]}</Td>
                      <Td className="hidden text-xs text-muted lg:table-cell">{r.reference ?? "—"}</Td>
                      <Td align="right">
                        <span className={cn("text-[13px] font-semibold tabular", r.voidedAt ? "text-faint line-through" : kind === "in" ? "text-emerald-700" : "text-ink")}>{kind === "in" ? "+" : "−"}{formatMAD(r.amount)}</span>
                        {r.voidedAt && <span className="mt-0.5 block"><Badge dot={false}>Annulé</Badge><span className="ml-1.5 text-[11px] text-muted">{r.voidReason}</span></span>}
                      </Td>
                    </Row>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
            </>
          )}
        </Card>
      </ListState>
    </PageContainer>
  );
}
