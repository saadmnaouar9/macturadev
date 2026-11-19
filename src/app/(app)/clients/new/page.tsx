import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/clients/customer-form";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function NewClientPage() {
  await requireAuth("write");
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader title="Nouveau client" description="Renseignez les informations de votre client. Seul le nom est obligatoire." />
      <CustomerForm />
    </PageContainer>
  );
}
