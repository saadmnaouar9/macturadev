import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadActivities, loadDocumentView } from "@/lib/document-view";
import { quoteDisplayStatus } from "@/lib/status";
import { PageContainer } from "@/components/ui/page-header";
import { SetBreadcrumb } from "@/components/layout/breadcrumbs";
import { QuoteDetail } from "@/components/documents/quote-detail";

export const metadata: Metadata = { title: "Devis" };

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ locked?: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;
  const { locked } = await searchParams;
  const view = await loadDocumentView("quote", auth.company.id, id);
  if (!view || view.kind !== "quote") notFound();
  const q = view.doc;
  const activities = await loadActivities(auth.company.id, id);
  return (
    <PageContainer className="max-w-[1400px]">
      <SetBreadcrumb path={`/devis/${id}`} label={q.number} />
      <QuoteDetail
        quote={{
          id: q.id, number: q.number, status: quoteDisplayStatus(q), rawStatus: q.status, total: Number(q.total),
          issueDate: q.issueDate.toISOString(), expiryDate: q.expiryDate.toISOString(),
          sentAt: q.sentAt?.toISOString() ?? null, acceptedAt: q.acceptedAt?.toISOString() ?? null, rejectedAt: q.rejectedAt?.toISOString() ?? null,
          customer: { id: q.customer.id, name: q.customer.name, email: q.customer.email, city: q.customer.city },
          invoice: q.invoice,
        }}
        paper={view.paper}
        activities={activities}
        canWrite={can(auth.role, "write")}
        canDelete={can(auth.role, "delete")}
        lockedNotice={locked === "1"}
      />
    </PageContainer>
  );
}
