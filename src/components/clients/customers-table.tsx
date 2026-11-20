"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/fast-link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Building2, Eye, FileText, Mail, MapPin, MoreHorizontal, Pencil, Phone, Receipt, Trash2, UserPlus, UserRound, Users, Wallet, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { StatCard, STAT_STRIP } from "@/components/ui/stat-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { startNavProgress } from "@/components/layout/top-progress";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead } from "@/components/data/list-state";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";
import { deleteCustomer, setCustomerArchived } from "@/app/(app)/clients/actions";

interface CustomerRow {
  id: string;
  type: "COMPANY" | "INDIVIDUAL";
  name: string;
  nameAr: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  city: string | null;
  ice: string | null;
  createdAt: string;
  archived: boolean;
  invoiced: number;
  outstanding: number;
  _count: { invoices: number; quotes: number };
}

const AVATAR_TONES = ["bg-brand-50 text-brand-700 ring-brand-100", "bg-accent-50 text-accent-600 ring-accent-100", "bg-emerald-50 text-emerald-700 ring-emerald-100", "bg-brand-50 text-brand-700 ring-brand-100", "bg-brand-50 text-brand-700 ring-brand-100", "bg-amber-50 text-amber-700 ring-amber-100"];
export function avatarTone(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

export function CustomerAvatar({ name, type, size = "md" }: { name: string; type: "COMPANY" | "INDIVIDUAL"; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center font-semibold ring-1 ring-inset", avatarTone(name), type === "COMPANY" ? "rounded-lg" : "rounded-full", size === "lg" ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs")}>
      {initials(name)}
    </span>
  );
}

function RowActions({ row, canWrite, canDelete }: { row: CustomerRow; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const hasDocs = row._count.invoices + row._count.quotes > 0;
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button className="rounded-md p-1.5 text-faint opacity-60 transition-all hover:bg-subtle hover:text-ink group-hover:opacity-100 data-[state=open]:bg-subtle data-[state=open]:opacity-100" aria-label="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem href={`/clients/${row.id}`}><Eye /> Voir la fiche</DropdownItem>
        {canWrite && (
          <>
            <DropdownItem href={`/clients/${row.id}/edit`}><Pencil /> Modifier</DropdownItem>
            <DropdownSeparator />
            <DropdownItem href={`/devis/new?customer=${row.id}`}><FileText /> Nouveau devis</DropdownItem>
            <DropdownItem href={`/factures/new?customer=${row.id}`}><Receipt /> Nouvelle facture</DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              onSelect={async () => {
                const res = await setCustomerArchived(row.id, !row.archived);
                if (res.ok) { toast.success(res.message); } else toast.error(res.error);
              }}
            >
              {row.archived ? <><ArchiveRestore /> Restaurer</> : <><Archive /> Archiver</>}
            </DropdownItem>
          </>
        )}
        {canDelete && !hasDocs && (
          <DropdownItem
            danger
            onSelect={async () => {
              const ok = await confirm({ title: `Supprimer ${row.name} ?`, description: "Cette action est définitive. Le client sera supprimé de votre espace.", confirmLabel: "Supprimer", danger: true });
              if (!ok) return;
              const res = await deleteCustomer(row.id);
              if (res.ok) { toast.success(res.message); } else toast.error(res.error);
            }}
          >
            <Trash2 /> Supprimer
          </DropdownItem>
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}

const VIEW_KEY = "mactura.clients.view";
const EASE = [0.16, 1, 0.3, 1] as const;

function CustomerCard({ r, index, canWrite, canDelete }: { r: CustomerRow; index: number; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const contact = r.email ?? null;
  const phone = r.mobile ?? r.phone ?? null;
  const open = () => { startNavProgress(); router.push(`/clients/${r.id}`); };
  const docs = r._count.invoices + r._count.quotes;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: r.archived ? 0.6 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index, 14) * 0.035, ease: EASE }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        open();
      }}
      className="glass group relative flex cursor-pointer flex-col overflow-hidden rounded-xl p-4 ring-1 ring-inset ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-brand-200/60"
    >

      <div className="relative flex items-start gap-3">
        <span className=" "><CustomerAvatar name={r.name} type={r.type} size="lg" /></span>
        <div className="min-w-0 flex-1">
          <Link href={`/clients/${r.id}`} className="block truncate text-[15px] font-semibold text-ink outline-none transition-colors group-hover:text-brand-700 focus-visible:underline">{r.name}</Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">{r.type === "COMPANY" ? <Building2 className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}{r.type === "COMPANY" ? "Entreprise" : "Particulier"}</span>
            {r.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.city}</span>}
          </p>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0"><RowActions row={r} canWrite={canWrite} canDelete={canDelete} /></div>
      </div>

      <div className="relative mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {contact && <a href={`mailto:${contact}`} className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-brand-700" title={contact}><Mail className="h-3.5 w-3.5 shrink-0" /><span className="max-w-[180px] truncate">{contact}</span></a>}
        {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-brand-700"><Phone className="h-3.5 w-3.5 shrink-0" />{phone}</a>}
        {!contact && !phone && <span className="text-faint">Aucun moyen de contact</span>}
        {r.archived && <Badge dot={false}>Archivé</Badge>}
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-line-soft pt-3">
        <div className="min-w-0 rounded-lg bg-white/[0.03] px-3 py-2">
          <p className="text-[11px] text-muted">Facturé</p>
          <p className="truncate whitespace-nowrap text-[13px] font-semibold tabular text-ink">{formatMAD(r.invoiced)}</p>
        </div>
        <div className={cn("min-w-0 rounded-lg px-3 py-2", r.outstanding > 0 ? "bg-amber-50 ring-1 ring-inset ring-amber-200/60" : "bg-white/[0.03]")}>
          <p className="text-[11px] text-muted">Encours</p>
          <p className={cn("truncate whitespace-nowrap text-[13px] font-semibold tabular", r.outstanding > 0 ? "text-amber-700" : "text-faint")}>{formatMAD(r.outstanding)}</p>
        </div>
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-2 text-[11px] text-faint">
        <span>{docs > 0 ? `${r._count.quotes} devis · ${r._count.invoices} facture${r._count.invoices > 1 ? "s" : ""}` : "Aucun document"} · depuis le {formatDate(r.createdAt)}</span>
        {canWrite && !r.archived && (
          <span data-no-row-click className="flex shrink-0 gap-1">
            <Link href={`/devis/new?customer=${r.id}`} title="Nouveau devis" aria-label="Nouveau devis" className="rounded-md p-1.5 text-muted transition-colors hover:bg-subtle hover:text-brand-700"><FileText className="h-4 w-4" /></Link>
            <Link href={`/factures/new?customer=${r.id}`} title="Nouvelle facture" aria-label="Nouvelle facture" className="rounded-md p-1.5 text-muted transition-colors hover:bg-subtle hover:text-brand-700"><Receipt className="h-4 w-4" /></Link>
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function CustomersTable({
  rows, total, page, pageSize, hasQuery, archivedView, counts, totals, canWrite, canDelete,
}: {
  rows: CustomerRow[]; total: number; page: number; pageSize: number; hasQuery: boolean; archivedView: boolean;
  counts: { all: number; company: number; individual: number; archived: number }; totals: { invoiced: number; outstanding: number }; canWrite: boolean; canDelete: boolean;
}) {
  const [view, setView] = useState<ViewMode>("grid");
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "grid" || v === "table") setView(v); } catch { /* stockage indisponible */ }
  }, []);
  const changeView = (m: ViewMode) => {
    setView(m);
    try { localStorage.setItem(VIEW_KEY, m); } catch { /* ignoré */ }
  };
  return (
    <>
    <div className={`${STAT_STRIP} lg:grid-cols-4`}>
      <StatCard index={0} tone="brand" icon={Users} label="Clients actifs" sub={`${counts.archived} archivé${counts.archived > 1 ? "s" : ""}`}><AnimatedNumber value={counts.all} /></StatCard>
      <StatCard index={1} tone="sky" icon={Building2} label="Entreprises" sub={`${counts.individual} particulier${counts.individual > 1 ? "s" : ""}`}><AnimatedNumber value={counts.company} /></StatCard>
      <StatCard index={2} tone="emerald" icon={TrendingUp} label="Total facturé" sub="clients actifs"><AnimatedNumber value={totals.invoiced} kind="mad" /></StatCard>
      <StatCard index={3} tone="amber" icon={Wallet} label="Encours à encaisser" sub="factures non soldées" pulse={totals.outstanding > 0}><AnimatedNumber value={totals.outstanding} kind="mad" /></StatCard>
    </div>
    <ListState>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <FilterTabs
              param="type"
              layoutId="customer-type-filter"
              options={[
                { value: "", label: "Tous", count: counts.all },
                { value: "COMPANY", label: "Entreprises", count: counts.company },
                { value: "INDIVIDUAL", label: "Particuliers", count: counts.individual },
              ]}
            />
            <div className="hidden h-5 w-px bg-line sm:block" />
            <FilterTabs param="status" layoutId="customer-archived-filter" options={[{ value: "", label: "Actifs" }, { value: "archived", label: "Archivés", count: counts.archived }]} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput placeholder="Nom, e-mail, ICE, ville…" />
            <ViewToggle mode={view} onChange={changeView} layoutId="customer-view-toggle" />
          </div>
        </div>
        {rows.length === 0 ? (
          hasQuery || archivedView ? (
            <EmptyState icon={Users} title="Aucun client trouvé" description="Essayez d'autres mots-clés ou modifiez les filtres." />
          ) : (
            <EmptyState
              icon={Users}
              title="Aucun client pour le moment"
              description="Ajoutez votre premier client pour commencer à créer des devis et des factures."
              action={canWrite && <ButtonLink href="/clients/new"><UserPlus className="h-4 w-4" /> Ajouter un client</ButtonLink>}
            />
          )
        ) : (
          <>
            {view === "grid" ? (
              <div className="grid gap-4 p-4 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((r, i) => <CustomerCard key={r.id} r={r} index={i} canWrite={canWrite} canDelete={canDelete} />)}
              </div>
            ) : (
            <Table>
              <THead>
                <SortHeader field="name">Client</SortHeader>
                <Th className="hidden md:table-cell">Type</Th>
                <SortHeader field="city" className="hidden lg:table-cell">Ville</SortHeader>
                <Th className="hidden xl:table-cell">ICE</Th>
                <Th align="right">Facturé</Th>
                <Th align="right">Encours</Th>
                <SortHeader field="createdAt" className="hidden lg:table-cell">Ajouté le</SortHeader>
                <Th className="w-10" />
              </THead>
              <tbody>
                {rows.map((r, i) => (
                  <Row key={r.id} href={`/clients/${r.id}`} index={i}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={r.name} type={r.type} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-ink group-hover:text-brand-700">{r.name}</span>
                            {r.archived && <Badge dot={false}>Archivé</Badge>}
                          </div>
                          <div className="truncate text-xs text-muted">{r.email ?? r.mobile ?? r.phone ?? "—"}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
                        {r.type === "COMPANY" ? <Building2 className="h-3.5 w-3.5 text-faint" /> : <UserRound className="h-3.5 w-3.5 text-faint" />}
                        {r.type === "COMPANY" ? "Entreprise" : "Particulier"}
                      </span>
                    </Td>
                    <Td className="hidden text-[13px] text-ink-soft lg:table-cell">{r.city ?? "—"}</Td>
                    <Td className="hidden font-mono text-xs text-muted xl:table-cell">{r.ice ?? "—"}</Td>
                    <Td align="right" className="text-[13px] font-medium tabular text-ink">{formatMAD(r.invoiced)}</Td>
                    <Td align="right" className={cn("text-[13px] font-medium tabular", r.outstanding > 0 ? "text-amber-700" : "text-faint")}>{formatMAD(r.outstanding)}</Td>
                    <Td className="hidden text-[13px] text-muted lg:table-cell">{formatDate(r.createdAt)}</Td>
                    <Td><RowActions row={r} canWrite={canWrite} canDelete={canDelete} /></Td>
                  </Row>
                ))}
              </tbody>
            </Table>
            )}
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </Card>
    </ListState>
    </>
  );
}
