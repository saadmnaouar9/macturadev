import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEditorData, serializeItems } from "@/lib/editor-data";
import { centsToInput, formatRate } from "@/lib/money";
import { toDateInput } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { SetBreadcrumb } from "@/components/layout/breadcrumbs";
import { DocumentEditor } from "@/components/documents/document-editor";
import { itemFromDb } from "@/components/documents/editor-model";

export const metadata: Metadata = { title: "Modifier le devis" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("write");
  const { id } = await params;
  const q = await db.quote.findFirst({ where: { id, companyId: auth.company.id }, include: { items: { orderBy: { position: "asc" } }, invoice: { select: { id: true } } } });
  if (!q) notFound();
  if (q.invoice || !(q.status === "DRAFT" || q.status === "SENT")) redirect(`/devis/${id}?locked=1`);
  const d = await getEditorData(auth.company.id);
  // Le client d'un devis existant reste sélectionnable même s'il a été archivé
  const customers = d.customers.some((c) => c.id === q.customerId)
    ? d.customers
    : [...d.customers, ...(await db.customer.findMany({ where: { id: q.customerId }, select: { id: true, name: true, nameAr: true, contactName: true, city: true, address: true, postalCode: true, ice: true, taxId: true, rc: true, email: true, paymentDays: true } }))];
  return (
    <PageContainer className="max-w-[1400px]">
      <SetBreadcrumb path={`/devis/${q.id}`} label={q.number} />
      <PageHeader title={`Modifier le devis ${q.number}`} description="Les totaux sont recalculés automatiquement." />
      <DocumentEditor
        kind="quote"
        documentId={q.id}
        documentNumber={q.number}
        company={d.paperCompany}
        customers={customers}
        products={d.products}
        taxRates={d.taxRates}
        defaultTaxRate={d.company.defaultTaxRate}
        defaultPaymentDays={d.company.defaultPaymentDays}
        validityDays={d.company.quoteValidityDays}
        initial={{
          customerId: q.customerId,
          issueDate: toDateInput(q.issueDate),
          secondDate: toDateInput(q.expiryDate),
          reference: q.reference ?? "",
          paymentTerms: "",
          globalDiscountType: q.globalDiscountType,
          globalDiscount: q.globalDiscountType === "AMOUNT" ? (q.globalDiscountAmount ? centsToInput(q.globalDiscountAmount) : "") : q.globalDiscount ? formatRate(q.globalDiscount) : "",
          notes: q.notes ?? "",
          terms: q.terms ?? "",
          items: serializeItems(q.items).map(itemFromDb),
        }}
      />
    </PageContainer>
  );
}
