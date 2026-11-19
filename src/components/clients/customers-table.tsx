"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Building2, Eye, FileText, MoreHorizontal, Pencil, Receipt, Trash2, UserPlus, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
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

const AVATAR_TONES = ["bg-brand-50 text-brand-700 ring-brand-100", "bg-accent-50 text-accent-600 ring-accent-100", "bg-emerald-50 text-emerald-700 ring-emerald-100", "bg-sky-50 text-sky-700 ring-sky-100", "bg-violet-50 text-violet-700 ring-violet-100", "bg-amber-50 text-amber-700 ring-amber-100"];
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

export function CustomersTable({
  rows, total, page, pageSize, hasQuery, archivedView, counts, canWrite, canDelete,
}: {
  rows: CustomerRow[]; total: number; page: number; pageSize: number; hasQuery: boolean; archivedView: boolean;
  counts: { all: number; company: number; individual: number; archived: number }; canWrite: boolean; canDelete: boolean;
}) {
  return (
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
          <SearchInput placeholder="Nom, e-mail, ICE, ville…" />
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
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </Card>
    </ListState>
  );
}
