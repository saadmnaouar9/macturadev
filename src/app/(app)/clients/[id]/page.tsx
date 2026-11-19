import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ACTIVE_LIFECYCLE, invoiceDisplayStatus, quoteDisplayStatus } from "@/lib/status";
import { PageContainer } from "@/components/ui/page-header";
import { SetBreadcrumb } from "@/components/layout/breadcrumbs";
import { CustomerDetail } from "@/components/clients/customer-detail";

export const metadata: Metadata = { title: "Fiche client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;
  const companyId = auth.company.id;
  const customer = await db.customer.findFirst({ where: { id, companyId } });
  if (!customer) notFound();

  const [invoices, quotes, payments] = await Promise.all([
    db.invoice.findMany({ where: { companyId, customerId: id }, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], select: { id: true, number: true, status: true, paymentStatus: true, issueDate: true, dueDate: true, total: true, amountPaid: true } }),
    db.quote.findMany({ where: { companyId, customerId: id }, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], select: { id: true, number: true, status: true, issueDate: true, expiryDate: true, total: true, invoice: { select: { id: true } } } }),
    db.payment.findMany({ where: { companyId, voidedAt: null, invoice: { customerId: id } }, orderBy: { date: "desc" }, select: { id: true, amount: true, date: true, method: true, invoice: { select: { id: true, number: true } } } }),
  ]);
  const activities = await db.activity.findMany({
    where: { companyId, OR: [{ entityId: id }, { entityId: { in: [...invoices.map((i) => i.id), ...quotes.map((q) => q.id)] } }] },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, type: true, message: true, createdAt: true, entityType: true, entityId: true, user: { select: { name: true } } },
  });

  const issued = invoices.filter((i) => ACTIVE_LIFECYCLE.includes(i.status));
  const outstanding = issued.filter((i) => i.paymentStatus !== "PAID");
  const stats = {
    invoiced: Number(issued.reduce((s, i) => s + i.total, 0n)),
    collected: Number(payments.reduce((s, p) => s + p.amount, 0n)),
    outstanding: Number(outstanding.reduce((s, i) => s + i.total - i.amountPaid, 0n)),
    overdue: outstanding.filter((i) => invoiceDisplayStatus(i) === "OVERDUE").length,
    quotes: quotes.length,
    accepted: quotes.filter((q) => q.status === "ACCEPTED").length,
  };

  return (
    <PageContainer>
      <SetBreadcrumb path={`/clients/${id}`} label={customer.name} />
      <CustomerDetail
        customer={{ ...customer, createdAt: customer.createdAt.toISOString() }}
        stats={stats}
        invoices={invoices.map((i) => ({ id: i.id, number: i.number, status: invoiceDisplayStatus(i), issueDate: i.issueDate.toISOString(), dueDate: i.dueDate.toISOString(), total: Number(i.total), balance: Number(i.total - i.amountPaid) }))}
        quotes={quotes.map((q) => ({ id: q.id, number: q.number, status: quoteDisplayStatus(q), issueDate: q.issueDate.toISOString(), expiryDate: q.expiryDate.toISOString(), total: Number(q.total), invoiceId: q.invoice?.id ?? null }))}
        payments={payments.map((p) => ({ id: p.id, amount: Number(p.amount), date: p.date.toISOString(), method: p.method, invoiceId: p.invoice.id, invoiceNumber: p.invoice.number }))}
        activities={activities.map((a) => ({ id: a.id, type: a.type, message: a.message, createdAt: a.createdAt.toISOString(), href: a.entityType === "invoice" ? `/factures/${a.entityId}` : a.entityType === "quote" ? `/devis/${a.entityId}` : null, userName: a.user?.name ?? null }))}
        canWrite={can(auth.role, "write")}
        canDelete={can(auth.role, "delete")}
      />
    </PageContainer>
  );
}
