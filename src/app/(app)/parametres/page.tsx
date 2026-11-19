import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const auth = await requireAuth();
  const { tab } = await searchParams;
  const companyId = auth.company.id;
  const [company, taxRates, members, usage] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId } }),
    db.taxRate.findMany({ where: { companyId }, orderBy: { rate: "desc" } }),
    db.membership.findMany({ where: { companyId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.$transaction([db.invoice.count({ where: { companyId } }), db.quote.count({ where: { companyId } }), db.customer.count({ where: { companyId } })]),
  ]);
  const s = (v: string | null) => v ?? "";
  return (
    <PageContainer className="max-w-6xl">
      <PageHeader title="Paramètres" description="Configurez votre entreprise, vos documents, la TVA et votre équipe." />
      <SettingsView key={tab ?? "entreprise"}
        initialTab={tab ?? "entreprise"}
        company={{
          name: company.name, nameAr: s(company.nameAr), legalForm: s(company.legalForm), ice: s(company.ice), taxId: s(company.taxId), rc: s(company.rc),
          rcCity: s(company.rcCity), patente: s(company.patente), cnss: s(company.cnss), capital: s(company.capital), address: s(company.address),
          city: s(company.city), postalCode: s(company.postalCode), phone: s(company.phone), email: s(company.email), website: s(company.website),
          bankName: s(company.bankName), rib: s(company.rib),
        }}
        documents={{
          invoicePrefix: company.invoicePrefix, quotePrefix: company.quotePrefix, defaultPaymentDays: String(company.defaultPaymentDays),
          quoteValidityDays: String(company.quoteValidityDays), defaultTaxRate: String(company.defaultTaxRate),
          invoiceNotes: s(company.invoiceNotes), invoiceTerms: s(company.invoiceTerms), quoteNotes: s(company.quoteNotes), quoteTerms: s(company.quoteTerms),
        }}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, rate: t.rate, isDefault: t.isDefault }))}
        members={members.map((m) => ({ id: m.id, role: m.role, user: m.user, isMe: m.userId === auth.user.id }))}
        profile={{ name: auth.user.name, email: auth.user.email }}
        usage={{ invoices: usage[0], quotes: usage[1], customers: usage[2] }}
        perms={{ settings: can(auth.role, "settings"), members: can(auth.role, "members") }}
      />
    </PageContainer>
  );
}
