"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BriefcaseBusiness, FileSignature, FilePlus2, FolderKanban, ListChecks, Receipt, Truck, UserCheck, UserRound, Users } from "lucide-react";
import { ResourceView, type ResourceViewProps, type RowAction } from "@/components/data/resource-view";
import type { FieldDef } from "@/components/data/crud-form";
import { MOROCCAN_CITIES } from "@/lib/cities";
import { formatDate } from "@/lib/utils";
import { CONTRACT_STATUS, FREQUENCY_LABELS, PROJECT_STATUS, PROSPECT_STATUS } from "@/lib/status";
import { convertProspect, deleteProspect, saveProspect } from "@/app/(app)/prospects/actions";
import { deleteSupplier, saveSupplier } from "@/app/(app)/fournisseurs/actions";
import { deleteProject, saveProject } from "@/app/(app)/projets/actions";
import { createInvoiceFromContract, deleteContract, saveContract } from "@/app/(app)/contrats/actions";
import { deleteEmployee, saveEmployee } from "@/app/(app)/employes/actions";
import { ProspectCard, ProspectStatsPanel, type ProspectStats } from "./prospects-ui";
import { SupplierCard, SuppliersPanel, type SupplierStats } from "./suppliers-ui";
import type { MapPoint } from "./suppliers-map";
import { ContractCard, ContractStatsPanel, type ContractStats } from "./contracts-ui";

type Common = Pick<ResourceViewProps, "rows" | "total" | "page" | "pageSize" | "hasQuery" | "canWrite" | "canDelete" | "filters" | "summary">;
const opts = (m: Record<string, { label: string }>) => Object.entries(m).map(([value, v]) => ({ value, label: v.label }));

// ─── Prospects ───
const SOURCES = ["Site web", "Recommandation", "Salon / événement", "Réseaux sociaux", "Appel entrant", "Prospection", "Autre"].map((s) => ({ value: s, label: s }));
const PROSPECT_FIELDS: FieldDef[] = [
  { name: "name", label: "Société ou nom", type: "text", required: true, span: true, placeholder: "Atlas Logistique SARL" },
  { name: "contactName", label: "Contact", type: "text" },
  { name: "source", label: "Source", type: "select", options: SOURCES },
  { name: "email", label: "E-mail", type: "email" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "status", label: "Étape", type: "select", required: true, options: opts(PROSPECT_STATUS) },
  { name: "value", label: "Valeur estimée (HT)", type: "money" },
  { name: "nextActionDate", label: "Prochaine relance", type: "date", span: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

/** « 29 nov 2026 · dans 9 j » / « … · en retard de 3 j » (les prospects clôturés n'affichent que la date). */
function relanceLabel(next: unknown, status: unknown): string | null {
  if (!next) return null;
  const date = formatDate(String(next));
  if (status === "WON" || status === "LOST") return date;
  const today = new Date().toISOString().slice(0, 10);
  const d = Math.round((Date.parse(String(next).slice(0, 10)) - Date.parse(today)) / 86400000);
  if (d < 0) return `${date} · en retard de ${-d} j`;
  if (d === 0) return `${date} · aujourd'hui`;
  return `${date} · dans ${d} j`;
}

export function ProspectsView({ stats, ...p }: Common & { stats: ProspectStats }) {
  const router = useRouter();
  const actions = (row: { id: string; convertedCustomerId?: unknown }): RowAction[] =>
    row.convertedCustomerId
      ? [
          { label: "Voir le client", icon: <Users />, href: `/clients/${row.convertedCustomerId}` },
          { label: "Créer un devis", icon: <FilePlus2 />, href: `/devis/new?customer=${row.convertedCustomerId}` },
        ]
      : [
          {
            label: "Convertir en client",
            icon: <UserCheck />,
            onSelect: async () => {
              const res = await convertProspect(row.id);
              if (res.ok) { toast.success(res.message); router.push(`/clients/${res.data.customerId}`); } else toast.error(res.error);
            },
          },
        ];
  return (
    <ResourceView
      {...p}
      rows={p.rows.map((r) => ({ ...r, relance: relanceLabel(r.nextActionDate, r.status) }))}
      filters={[]}
      title="Prospects"
      description="Suivez vos opportunités commerciales de la première prise de contact à la conversion en client."
      icon={BriefcaseBusiness}
      summaryNode={<ProspectStatsPanel stats={stats} />}
      cardView={{ storageKey: "mactura.prospects.view", render: (row, api) => <ProspectCard row={row} api={api} /> }}
      entity="prospect"
      columns={[
        { key: "name", header: "Prospect", kind: "title", subKey: "contact", avatar: true, sort: "name" },
        { key: "status", header: "Étape", kind: "badge", badge: PROSPECT_STATUS },
        { key: "value", header: "Valeur estimée", kind: "money", align: "right", sort: "value" },
        { key: "relance", header: "Prochaine relance", kind: "text", hide: "md", sort: "nextActionDate" },
        { key: "source", header: "Source", kind: "text", hide: "lg" },
        { key: "createdAt", header: "Ajouté le", kind: "date", hide: "xl", sort: "createdAt" },
      ]}
      fields={PROSPECT_FIELDS}
      defaults={{ status: "NEW" }}
      searchPlaceholder="Nom, contact, e-mail…"
      onSave={saveProspect}
      onRemove={deleteProspect}
      rowActions={actions}
      emptyDescription="Ajoutez vos prospects pour suivre chaque opportunité et les convertir en clients en un clic."
    />
  );
}

// ─── Fournisseurs ───
const SUPPLIER_FIELDS: FieldDef[] = [
  { name: "name", label: "Raison sociale", type: "text", required: true, span: true },
  { name: "contactName", label: "Contact", type: "text" },
  { name: "paymentDays", label: "Délai de paiement", type: "number", digits: true, trailing: "jours" },
  { name: "email", label: "E-mail", type: "email" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "ice", label: "ICE", type: "text", digits: true, maxLength: 15, hint: "15 chiffres", mono: true },
  { name: "taxId", label: "IF", type: "text", digits: true, mono: true },
  { name: "rc", label: "RC", type: "text", mono: true },
  { name: "city", label: "Ville", type: "select", options: MOROCCAN_CITIES.map((c) => ({ value: c, label: c })) },
  { name: "address", label: "Adresse", type: "text", span: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

export function SuppliersView({ stats, mapPoints, ...p }: Common & { stats: SupplierStats; mapPoints: MapPoint[] }) {
  return (
    <ResourceView
      {...p}
      title="Fournisseurs"
      description="Gérez vos fournisseurs, suivez ce que vous leur devez et visualisez où ils se trouvent."
      icon={Truck}
      summaryNode={<SuppliersPanel stats={stats} points={mapPoints} />}
      cardView={{ defaultGrid: true, storageKey: "mactura.suppliers.view", render: (row, api) => <SupplierCard row={row} api={api} /> }}
      entity="fournisseur"
      columns={[
        { key: "name", header: "Fournisseur", kind: "title", subKey: "contact", avatar: true, sort: "name" },
        { key: "city", header: "Ville", kind: "text", hide: "md" },
        { key: "ice", header: "ICE", kind: "text", mono: true, hide: "xl" },
        { key: "purchaseCount", header: "Achats", kind: "number", align: "right", hide: "lg" },
        { key: "balance", header: "Reste à payer", kind: "money", align: "right" },
      ]}
      fields={SUPPLIER_FIELDS}
      searchPlaceholder="Nom, ICE, ville…"
      onSave={saveSupplier}
      onRemove={deleteSupplier}
      canDeleteRow={(r) => !r.purchaseCount}
      rowActions={(r) => [
        { label: "Voir les achats", icon: <Receipt />, href: `/achats?q=${encodeURIComponent(String(r.name))}` },
        { label: "Nouvel achat", icon: <FilePlus2 />, href: `/achats?new=1&supplier=${r.id}` },
      ]}
    />
  );
}

// ─── Projets ───
export function ProjectsView({ customers, ...p }: Common & { customers: { value: string; label: string }[] }) {
  const fields: FieldDef[] = [
    { name: "name", label: "Nom du projet", type: "text", required: true, span: true },
    { name: "customerId", label: "Client", type: "select", options: customers },
    { name: "status", label: "Statut", type: "select", required: true, options: opts(PROJECT_STATUS) },
    { name: "startDate", label: "Début", type: "date" },
    { name: "endDate", label: "Fin prévue", type: "date" },
    { name: "budget", label: "Budget (HT)", type: "money", span: true },
    { name: "description", label: "Description", type: "textarea" },
  ];
  return (
    <ResourceView
      {...p}
      title="Projets"
      description="Pilotez vos projets clients : avancement, budget et tâches associées."
      icon={FolderKanban}
      entity="projet"
      columns={[
        { key: "name", header: "Projet", kind: "title", subKey: "customerName", sort: "name" },
        { key: "status", header: "Statut", kind: "badge", badge: PROJECT_STATUS },
        { key: "progress", header: "Avancement", kind: "progress", hide: "md" },
        { key: "endDate", header: "Fin prévue", kind: "date", hide: "lg", sort: "endDate" },
        { key: "budget", header: "Budget", kind: "money", align: "right", hide: "md", sort: "budget" },
      ]}
      fields={fields}
      defaults={{ status: "PLANNED" }}
      searchPlaceholder="Nom du projet…"
      onSave={saveProject}
      onRemove={deleteProject}
      rowActions={(r) => [
        { label: "Voir les tâches", icon: <ListChecks />, href: `/taches?project=${r.id}` },
        { label: "Nouvelle tâche", icon: <FilePlus2 />, href: `/taches?new=1&project=${r.id}` },
      ]}
    />
  );
}

// ─── Contrats ───
export function ContractsView({ customers, stats, ...p }: Common & { customers: { value: string; label: string }[]; stats: ContractStats }) {
  const router = useRouter();
  const fields: FieldDef[] = [
    { name: "reference", label: "Référence", type: "text", required: true, placeholder: "CTR-2026-001", mono: true },
    { name: "status", label: "Statut", type: "select", required: true, options: opts({ DRAFT: { label: "Brouillon" }, ACTIVE: { label: "Actif" }, TERMINATED: { label: "Résilié" } }) },
    { name: "title", label: "Intitulé", type: "text", required: true, span: true, placeholder: "Maintenance annuelle du système d'information" },
    { name: "customerId", label: "Client", type: "select", required: true, span: true, options: customers },
    { name: "startDate", label: "Début", type: "date", required: true },
    { name: "endDate", label: "Fin", type: "date" },
    { name: "amount", label: "Montant HT par période", type: "money" },
    { name: "frequency", label: "Facturation", type: "select", required: true, options: Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label })) },
    { name: "autoRenew", label: "Reconduction tacite", type: "switch", hint: "Le contrat est reconduit automatiquement à son terme." },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  return (
    <ResourceView
      {...p}
      title="Contrats"
      description="Contrats clients récurrents : échéances, montants et génération de factures."
      icon={FileSignature}
      summaryNode={<ContractStatsPanel stats={stats} />}
      cardView={{ defaultGrid: true, storageKey: "mactura.contracts.view", render: (row, api) => <ContractCard row={row} api={api} /> }}
      entity="contrat"
      columns={[
        { key: "title", header: "Contrat", kind: "title", subKey: "subtitle", sort: "title" },
        { key: "status", header: "Statut", kind: "badge", badgeKey: "displayStatus", badge: CONTRACT_STATUS },
        { key: "amount", header: "Montant HT", kind: "money", align: "right", sort: "amount" },
        { key: "frequencyLabel", header: "Facturation", kind: "text", hide: "md" },
        { key: "endDate", header: "Échéance", kind: "date", hide: "lg", sort: "endDate", emptyText: "Sans échéance" },
      ]}
      fields={fields}
      defaults={{ status: "ACTIVE", frequency: "YEARLY" }}
      searchPlaceholder="Intitulé, référence…"
      onSave={saveContract}
      onRemove={deleteContract}
      rowActions={(r) =>
        r.status === "ACTIVE"
          ? [{
              label: "Créer la facture",
              icon: <Receipt />,
              onSelect: async () => {
                const res = await createInvoiceFromContract(r.id);
                if (res.ok) { toast.success(res.message); router.push(`/factures/${res.data.invoiceId}`); } else toast.error(res.error);
              },
            }]
          : []
      }
    />
  );
}

// ─── Employés ───
export function EmployeesView(p: Common) {
  const fields: FieldDef[] = [
    { name: "firstName", label: "Prénom", type: "text", required: true },
    { name: "lastName", label: "Nom", type: "text", required: true },
    { name: "position", label: "Poste", type: "text" },
    { name: "department", label: "Service", type: "text" },
    { name: "email", label: "E-mail", type: "email" },
    { name: "phone", label: "Téléphone", type: "tel" },
    { name: "hireDate", label: "Date d'embauche", type: "date" },
    { name: "salary", label: "Salaire brut mensuel", type: "money" },
    { name: "cin", label: "CIN", type: "text", mono: true },
    { name: "cnss", label: "N° CNSS", type: "text", mono: true },
    { name: "active", label: "Employé actif", type: "switch", hint: "Les anciens employés restent consultables." },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  return (
    <ResourceView
      {...p}
      title="Employés"
      description="Registre du personnel de l'entreprise (accès réservé aux administrateurs)."
      icon={UserRound}
      entity="employé"
      columns={[
        { key: "fullName", header: "Employé", kind: "title", subKey: "position", avatar: true, sort: "lastName" },
        { key: "department", header: "Service", kind: "text", hide: "md" },
        { key: "hireDate", header: "Embauche", kind: "date", hide: "lg", sort: "hireDate" },
        { key: "salary", header: "Salaire brut", kind: "money", align: "right", hide: "md" },
        { key: "state", header: "Statut", kind: "badge", badge: { ACTIVE: { label: "Actif", tone: "success" }, INACTIVE: { label: "Parti", tone: "neutral" } } },
      ]}
      fields={fields}
      defaults={{ active: true }}
      searchPlaceholder="Nom, poste, service…"
      onSave={saveEmployee}
      onRemove={deleteEmployee}
    />
  );
}
