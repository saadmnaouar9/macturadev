import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/clients/customer-form";
import { SetBreadcrumb } from "@/components/layout/breadcrumbs";

export const metadata: Metadata = { title: "Modifier le client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("write");
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, companyId: auth.company.id } });
  if (!c) notFound();
  const s = (v: string | null) => v ?? "";
  return (
    <PageContainer className="max-w-5xl">
      <SetBreadcrumb path={`/clients/${c.id}`} label={c.name} />
      <PageHeader title={`Modifier ${c.name}`} description="Les modifications s'appliquent aux nouveaux documents." />
      <CustomerForm
        customerId={c.id}
        initial={{
          type: c.type, name: c.name, nameAr: s(c.nameAr), contactName: s(c.contactName), email: s(c.email), phone: s(c.phone), mobile: s(c.mobile),
          ice: s(c.ice), taxId: s(c.taxId), rc: s(c.rc), address: s(c.address), city: s(c.city), postalCode: s(c.postalCode), country: c.country,
          paymentDays: c.paymentDays === null ? "" : String(c.paymentDays), notes: s(c.notes),
        }}
      />
    </PageContainer>
  );
}
