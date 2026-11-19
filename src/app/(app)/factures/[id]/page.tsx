import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadActivities, loadDocumentView } from "@/lib/document-view";
import { invoiceDisplayStatus } from "@/lib/status";
import { PageContainer } from "@/components/ui/page-header";
import { SetBreadcrumb } from "@/components/layout/breadcrumbs";
import { InvoiceDetail } from "@/components/documents/invoice-detail";

export const metadata: Metadata = { title: "Facture" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ locked?: string; pay?: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;
  const view = await loadDocumentView("invoice", auth.company.id, id);
  if (!view || view.kind !== "invoice") notFound();
  const inv = view.doc;
  const activities = await loadActivities(auth.company.id, id);
  return (
    <PageContainer className="max-w-[1400px]">
      <SetBreadcrumb path={`/factures/${id}`} label={inv.number ?? "Brouillon"} />
      <InvoiceDetail
        invoice={{
          id: inv.id, number: inv.number, status: invoiceDisplayStatus(inv), lifecycle: inv.status, paymentStatus: inv.paymentStatus, total: Number(inv.total), amountPaid: Number(inv.amountPaid),
          issueDate: inv.issueDate.toISOString(), dueDate: inv.dueDate.toISOString(), issuedAt: inv.issuedAt?.toISOString() ?? null, sentAt: inv.sentAt?.toISOString() ?? null,
          paidAt: inv.paidAt?.toISOString() ?? null, cancelledAt: inv.cancelledAt?.toISOString() ?? null,
          customer: { id: inv.customer.id, name: inv.customer.name, email: inv.customer.email },
          quote: inv.quote,
          payments: inv.payments.map((p) => ({ id: p.id, amount: Number(p.amount), date: p.date.toISOString(), method: p.method, reference: p.reference, notes: p.notes, voidedAt: p.voidedAt?.toISOString() ?? null, voidReason: p.voidReason })),
        }}
        paper={view.paper}
        activities={activities}
        canWrite={can(auth.role, "write")}
        canDelete={can(auth.role, "delete")}
        lockedNotice={sp.locked === "1"}
        openPayment={sp.pay === "1"}
      />
    </PageContainer>
  );
}
