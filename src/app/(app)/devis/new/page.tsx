import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getEditorData } from "@/lib/editor-data";
import { addDays, toDateInput, todayUTC } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { DocumentEditor, blankItem } from "@/components/documents/document-editor";

export const metadata: Metadata = { title: "Nouveau devis" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const auth = await requireAuth("write");
  const { customer } = await searchParams;
  const d = await getEditorData(auth.company.id);
  const today = todayUTC();
  return (
    <PageContainer className="max-w-[1400px]">
      <PageHeader title="Nouveau devis" description="Préparez une proposition commerciale pour votre client." />
      <DocumentEditor
        kind="quote"
        company={d.paperCompany}
        customers={d.customers}
        products={d.products}
        taxRates={d.taxRates}
        defaultTaxRate={d.company.defaultTaxRate}
        defaultPaymentDays={d.company.defaultPaymentDays}
        validityDays={d.company.quoteValidityDays}
        initial={{
          customerId: d.customers.some((c) => c.id === customer) ? customer! : null,
          issueDate: toDateInput(today),
          secondDate: toDateInput(addDays(today, d.company.quoteValidityDays)),
          reference: "",
          paymentTerms: "",
          globalDiscountType: "PERCENT",
          globalDiscount: "",
          notes: d.company.quoteNotes ?? "",
          terms: d.company.quoteTerms ?? "",
          items: [blankItem(d.company.defaultTaxRate)],
        }}
      />
    </PageContainer>
  );
}
