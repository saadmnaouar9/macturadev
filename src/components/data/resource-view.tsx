"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { FilterTabs, ListState, Pagination, Row as TRow, SearchInput, SortHeader, Table, Td, Th, THead } from "./list-state";
import { CrudDrawer, toFormValues, type FieldDef, type FormValues } from "./crud-form";
import { formatMAD, formatRate } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";
import type { Tone } from "@/lib/status";

type RowData = { id: string } & Record<string, unknown>;
type Result = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export interface Column {
  key: string;
  header: string;
  kind: "text" | "title" | "money" | "date" | "badge" | "number" | "percent" | "progress";
  subKey?: string;
  badge?: Record<string, { label: string; tone: Tone }>;
  badgeKey?: string; // clé de la ligne contenant la valeur d'état (par défaut `key`)
  sort?: string;
  align?: "right";
  hide?: "md" | "lg" | "xl";
  avatar?: boolean;
  mono?: boolean;
  emptyText?: string;
}

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void | Promise<void>;
  danger?: boolean;
  separatorBefore?: boolean;
}

const HIDE = { md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

function Cell({ col, row }: { col: Column; row: RowData }) {
  const v = row[col.key];
  const empty = <span className="text-faint">{col.emptyText ?? "—"}</span>;
  switch (col.kind) {
    case "title":
      return (
        <div className="flex items-center gap-3">
          {col.avatar && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">{initials(String(v ?? "?"))}</span>}
          <div className="min-w-0">
            <div className="truncate font-medium text-ink group-hover:text-brand-700">{String(v ?? "—")}</div>
            {col.subKey && row[col.subKey] ? <div className="max-w-[320px] truncate text-xs text-muted">{String(row[col.subKey])}</div> : null}
          </div>
        </div>
      );
    case "money":
      return v === null || v === undefined ? empty : <span className="font-medium tabular text-ink">{formatMAD(Number(v))}</span>;
    case "date":
      return v ? <span className="text-ink-soft">{formatDate(String(v))}</span> : empty;
    case "number":
      return v === null || v === undefined ? empty : <span className="tabular text-ink-soft">{String(v)}</span>;
    case "percent":
      return v === null || v === undefined ? empty : <span className="tabular text-ink-soft">{formatRate(Number(v))} %</span>;
    case "badge": {
      const key = String(row[col.badgeKey ?? col.key] ?? "");
      const b = col.badge?.[key];
      return b ? <Badge tone={b.tone}>{b.label}</Badge> : empty;
    }
    case "progress": {
      const pct = Math.max(0, Math.min(100, Number(v ?? 0)));
      return (
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></span>
          <span className="text-xs tabular text-muted">{Math.round(pct)} %</span>
        </div>
      );
    }
    default:
      return v ? <span className={cn("text-ink-soft", col.mono && "font-mono text-xs")}>{String(v)}</span> : empty;
  }
}

export interface ResourceViewProps {
  title: string;
  description: string;
  icon: LucideIcon;
  entity: string; // "prospect" → libellés
  entityPlural?: string;
  feminine?: boolean;
  columns: Column[];
  rows: RowData[];
  total: number;
  page: number;
  pageSize: number;
  fields: FieldDef[];
  defaults?: FormValues;
  filters?: { param: string; layoutId: string; options: { value: string; label: string; count?: number }[] }[];
  searchPlaceholder?: string;
  summary?: { label: string; value: string; sub?: string; tone?: "default" | "good" | "warn" | "bad" }[];
  hasQuery: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onSave: (id: string | null, payload: Record<string, unknown>) => Promise<Result>;
  onRemove?: (id: string) => Promise<Result>;
  rowActions?: (row: RowData) => RowAction[];
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  canEditRow?: (row: RowData) => boolean;
  canDeleteRow?: (row: RowData) => boolean;
  emptyDescription?: string;
}

/** Liste ressource complète : recherche, filtres, tri, pagination, création/édition en tiroir, suppression confirmée. */
export function ResourceView(p: ResourceViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; row: RowData | null }>({ open: false, row: null });
  const art = p.feminine ? "Nouvelle" : "Nouveau";
  const plural = p.entityPlural ?? `${p.entity}s`;

  // Ouverture depuis l'URL : ?new=1 / ?edit=<id> (actions rapides, calendrier, recherche)
  useEffect(() => {
    if (!p.canWrite) return;
    const edit = params.get("edit");
    const target = params.get("new") === "1" ? { open: true, row: null } : edit ? { open: true, row: p.rows.find((r) => r.id === edit) ?? null } : null;
    if (target && (target.row || params.get("new") === "1")) {
      setDrawer(target);
      const next = new URLSearchParams(params.toString());
      next.delete("new");
      next.delete("edit");
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initial = useMemo(() => toFormValues(p.fields, drawer.row, p.defaults), [p.fields, p.defaults, drawer.row]);

  const remove = async (row: RowData) => {
    if (!p.onRemove) return;
    const ok = await confirm({ title: `Supprimer ce ${p.entity} ?`, description: "Cette action est définitive.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    const res = await p.onRemove(row.id);
    if (res.ok) { toast.success(res.message ?? "Supprimé"); } else toast.error(res.error);
  };

  const toneCls = { default: "text-ink", good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-600" };

  return (
    <>
      <PageHeader
        title={p.title}
        description={p.description}
        actions={
          <>
            {p.headerActions}
            {p.canWrite && <Button onClick={() => setDrawer({ open: true, row: null })}><Plus className="h-4 w-4" /> {art} {p.entity}</Button>}
          </>
        }
      />
      {p.summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {p.summary.map((s) => (
            <Card key={s.label} className="px-4 py-3.5">
              <p className="text-xs text-muted">{s.label}</p>
              <p className={cn("mt-1 truncate text-[17px] font-semibold tracking-tight tabular", toneCls[s.tone ?? "default"])}>{s.value}</p>
              {s.sub && <p className="mt-0.5 truncate text-[11px] text-faint">{s.sub}</p>}
            </Card>
          ))}
        </div>
      )}
      <ListState>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {p.filters?.map((f, i) => (
                <div key={f.param} className="flex items-center gap-2">
                  {i > 0 && <div className="hidden h-5 w-px bg-line sm:block" />}
                  <FilterTabs param={f.param} layoutId={f.layoutId} options={f.options} />
                </div>
              ))}
            </div>
            <SearchInput placeholder={p.searchPlaceholder ?? "Rechercher…"} />
          </div>
          {p.rows.length === 0 ? (
            p.hasQuery ? (
              <EmptyState icon={p.icon} title="Aucun résultat" description="Modifiez la recherche ou les filtres." />
            ) : (
              <EmptyState
                icon={p.icon}
                title={`Aucun ${p.entity} pour le moment`}
                description={p.emptyDescription ?? `Ajoutez votre premier ${p.entity} pour commencer.`}
                action={p.canWrite && <Button onClick={() => setDrawer({ open: true, row: null })}><Plus className="h-4 w-4" /> {art} {p.entity}</Button>}
              />
            )
          ) : (
            <>
              <Table>
                <THead>
                  {p.columns.map((c) =>
                    c.sort ? (
                      <SortHeader key={c.key} field={c.sort} align={c.align} className={c.hide ? HIDE[c.hide] : undefined}>{c.header}</SortHeader>
                    ) : (
                      <Th key={c.key} align={c.align} className={c.hide ? HIDE[c.hide] : undefined}>{c.header}</Th>
                    ),
                  )}
                  <Th className="w-10" />
                </THead>
                <tbody>
                  {p.rows.map((row, i) => {
                    const editable = p.canWrite && (p.canEditRow ? p.canEditRow(row) : true);
                    const deletable = p.canDelete && !!p.onRemove && (p.canDeleteRow ? p.canDeleteRow(row) : true);
                    const extras = p.rowActions?.(row) ?? [];
                    return (
                      <TRow key={row.id} index={i} className={editable ? "cursor-pointer hover:bg-subtle" : undefined}>
                        {p.columns.map((c, ci) => (
                          <Td
                            key={c.key}
                            align={c.align}
                            className={cn(c.hide && HIDE[c.hide], "text-[13px]")}
                          >
                            {ci === 0 && editable ? (
                              <button className="block w-full text-left" onClick={() => setDrawer({ open: true, row })}><Cell col={c} row={row} /></button>
                            ) : (
                              <Cell col={c} row={row} />
                            )}
                          </Td>
                        ))}
                        <Td>
                          {(editable || deletable || extras.length > 0) && (
                            <DropdownMenu>
                              <DropdownTrigger asChild>
                                <button className="rounded-md p-1.5 text-faint opacity-60 transition-all hover:bg-subtle hover:text-ink group-hover:opacity-100 data-[state=open]:bg-subtle data-[state=open]:opacity-100" aria-label="Actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownTrigger>
                              <DropdownContent className="w-56">
                                {editable && <DropdownItem onSelect={() => setDrawer({ open: true, row })}><Pencil /> Modifier</DropdownItem>}
                                {extras.map((a) => (
                                  <span key={a.label}>
                                    {a.separatorBefore && <DropdownSeparator />}
                                    <DropdownItem href={a.href} onSelect={a.onSelect} danger={a.danger}>{a.icon} {a.label}</DropdownItem>
                                  </span>
                                ))}
                                {deletable && (<><DropdownSeparator /><DropdownItem danger onSelect={() => remove(row)}><Trash2 /> Supprimer</DropdownItem></>)}
                              </DropdownContent>
                            </DropdownMenu>
                          )}
                        </Td>
                      </TRow>
                    );
                  })}
                </tbody>
              </Table>
              {p.footer}
              <Pagination page={p.page} pageSize={p.pageSize} total={p.total} />
            </>
          )}
        </Card>
      </ListState>
      <CrudDrawer
        open={drawer.open}
        onOpenChange={(o) => setDrawer((d) => ({ ...d, open: o }))}
        title={drawer.row ? `Modifier le ${p.entity}` : `${art} ${p.entity}`}
        description={drawer.row ? undefined : `Renseignez les informations du ${p.entity}.`}
        fields={p.fields}
        initial={initial}
        submitLabel={drawer.row ? "Enregistrer" : "Créer"}
        onSubmit={(payload) => p.onSave(drawer.row?.id ?? null, payload)}
        onSaved={() => { setDrawer({ open: false, row: null }); }}
      />
      <span className="sr-only">{plural}</span>
    </>
  );
}
