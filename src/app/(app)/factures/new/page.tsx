import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEditorData } from "@/lib/editor-data";
import { addDays, toDateInput, todayUTC } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { DocumentEditor, blankItem } from "@/components/documents/document-editor";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const auth = await requireAuth("write");
  const { customer } = await searchParams;
  const d = await getEditorData(auth.company.id);
  const today = todayUTC();
  const selected = d.customers.find((c) => c.id === customer);
  const days = selected?.paymentDays ?? d.company.defaultPaymentDays;
  return (
    <PageContainer className="max-w-[1400px]">
      <PageHeader title="Nouvelle facture" description="La facture est enregistrée en brouillon, puis numérotée à son émission." />
      <DocumentEditor
        kind="invoice"
        canIssue={can(auth.role, "write")}
        company={d.paperCompany}
        customers={d.customers}
        products={d.products}
        taxRates={d.taxRates}
        defaultTaxRate={d.company.defaultTaxRate}
        defaultPaymentDays={d.company.defaultPaymentDays}
        validityDays={d.company.quoteValidityDays}
        initial={{
          customerId: selected?.id ?? null,
          issueDate: toDateInput(today),
          secondDate: toDateInput(addDays(today, days)),
          reference: "",
          paymentTerms: days === 0 ? "Paiement à réception" : `${days} jours`,
          globalDiscountType: "PERCENT",
          globalDiscount: "",
          notes: d.company.invoiceNotes ?? "",
          terms: d.company.invoiceTerms ?? "",
          items: [blankItem(d.company.defaultTaxRate)],
        }}
      />
    </PageContainer>
  );
}
