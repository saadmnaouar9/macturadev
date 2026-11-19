import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEditorData, serializeItems } from "@/lib/editor-data";
import { centsToInput, formatRate } from "@/lib/money";
import { toDateInput } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { SetBreadcrumb } from "@/components/layout/breadcrumbs";
import { DocumentEditor, itemFromDb } from "@/components/documents/document-editor";

export const metadata: Metadata = { title: "Modifier la facture" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("write");
  const { id } = await params;
  const inv = await db.invoice.findFirst({ where: { id, companyId: auth.company.id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!inv) notFound();
  if (inv.status === "CANCELLED" || inv.paymentStatus !== "UNPAID" || inv.amountPaid > 0n) redirect(`/factures/${id}?locked=1`);
  const d = await getEditorData(auth.company.id);
  const customers = d.customers.some((c) => c.id === inv.customerId)
    ? d.customers
    : [...d.customers, ...(await db.customer.findMany({ where: { id: inv.customerId }, select: { id: true, name: true, nameAr: true, contactName: true, city: true, address: true, postalCode: true, ice: true, taxId: true, rc: true, email: true, paymentDays: true } }))];
  const label = inv.number ?? "Brouillon";
  return (
    <PageContainer className="max-w-[1400px]">
      <SetBreadcrumb path={`/factures/${inv.id}`} label={label} />
      <PageHeader
        title={inv.number ? `Modifier la facture ${inv.number}` : "Modifier le brouillon"}
        description={inv.number ? "Facture émise : le numéro est conservé. Toute modification est tracée dans l'historique." : "Le numéro sera attribué à l'émission."}
      />
      <DocumentEditor
        kind="invoice"
        documentId={inv.id}
        documentNumber={inv.number}
        company={d.paperCompany}
        customers={customers}
        products={d.products}
        taxRates={d.taxRates}
        defaultTaxRate={d.company.defaultTaxRate}
        defaultPaymentDays={d.company.defaultPaymentDays}
        validityDays={d.company.quoteValidityDays}
        initial={{
          customerId: inv.customerId,
          issueDate: toDateInput(inv.issueDate),
          secondDate: toDateInput(inv.dueDate),
          reference: inv.reference ?? "",
          paymentTerms: inv.paymentTerms ?? "",
          globalDiscountType: inv.globalDiscountType,
          globalDiscount: inv.globalDiscountType === "AMOUNT" ? (inv.globalDiscountAmount ? centsToInput(inv.globalDiscountAmount) : "") : inv.globalDiscount ? formatRate(inv.globalDiscount) : "",
          notes: inv.notes ?? "",
          terms: inv.terms ?? "",
          items: serializeItems(inv.items).map(itemFromDb),
        }}
      />
    </PageContainer>
  );
}
