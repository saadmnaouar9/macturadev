"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Box, Boxes, Copy, Layers, MoreHorizontal, Package, PackagePlus, Pencil, Power, Tag, Trash2, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead, useListState } from "@/components/data/list-state";
import { Select } from "@/components/ui/field";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { formatMAD, formatRate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteProduct, setProductActive } from "@/app/(app)/produits/actions";
import { ProductDrawer, type ProductValue } from "./product-drawer";
import { CategoriesDialog, type CategoryItem } from "./categories-dialog";

interface ProductRow extends ProductValue {
  id: string;
  category: { name: string; color: string } | null;
  usage: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEW_KEY = "mactura.products.view";

const STAT_TONES = {
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-200/70", glow: "bg-brand-500/25" },
  sky: { tile: "bg-sky-50 text-sky-700 ring-sky-200/70", glow: "bg-sky-500/25" },
  violet: { tile: "bg-violet-50 text-violet-700 ring-violet-200/70", glow: "bg-violet-500/25" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-200/80", glow: "bg-amber-500/25" },
} as const;

function StatCard({ label, value, icon: Icon, tone, index }: { label: string; value: number; icon: LucideIcon; tone: keyof typeof STAT_TONES; index: number }) {
  const t = STAT_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: EASE }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="glass group relative overflow-hidden rounded-xl p-4 shadow-[var(--shadow-ring),var(--shadow-md)]"
    >
      <span aria-hidden className={cn("pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100", t.glow)} />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink"><AnimatedNumber value={value} /></p>
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110", t.tile)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  );
}

function ProductCard({ p, index, canWrite, onOpen, menu }: { p: ProductRow; index: number; canWrite: boolean; onOpen: () => void; menu: React.ReactNode }) {
  const isService = p.type === "SERVICE";
  const ttc = Math.round(p.unitPrice * (1 + p.taxRate / 10000));
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: p.active ? 1 : 0.6, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index, 14) * 0.035, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      onClick={(e) => {
        if (!canWrite || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        onOpen();
      }}
      className={cn("glass group relative flex flex-col overflow-hidden rounded-xl p-4 ring-1 ring-inset ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-brand-200/60", canWrite && "cursor-pointer")}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgb(91 155 255 / 0.16), transparent 70%)" }} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px opacity-70", isService ? "bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" : "bg-gradient-to-r from-transparent via-sky-400/70 to-transparent")} />

      <div className="relative flex items-start gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110", isService ? "bg-violet-50 text-violet-600 ring-violet-100" : "bg-sky-50 text-sky-600 ring-sky-100")}>
          {isService ? <Wrench className="h-5 w-5" /> : <Box className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left text-[15px] font-semibold text-ink outline-none transition-colors group-hover:text-brand-700 focus-visible:underline" onClick={onOpen} disabled={!canWrite}>{p.name}</button>
          <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-muted">{[p.sku, p.description].filter(Boolean).join(" · ") || (isService ? "Service" : "Produit")}</p>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0">{menu}</div>
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
        {p.category ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
            <span className="h-2 w-2 rounded-full" style={{ background: p.category.color }} />
            {p.category.name}
          </span>
        ) : null}
        <span className="rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">/ {p.unit}</span>
        {!p.active && <Badge dot={false}>Inactif</Badge>}
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-lg font-semibold tabular tracking-tight text-ink">{formatMAD(p.unitPrice)}</p>
          <p className="whitespace-nowrap text-xs tabular text-muted">TTC {formatMAD(ttc)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium tabular text-brand-700 ring-1 ring-inset ring-brand-200/70">TVA {formatRate(p.taxRate)} %</span>
          {p.usage > 0 && <span className="whitespace-nowrap text-[11px] text-faint">Utilisé {p.usage}×</span>}
        </div>
      </div>
    </motion.div>
  );
}

function CategoryFilter({ categories }: { categories: CategoryItem[] }) {
  const params = useSearchParams();
  const { setParams } = useListState();
  return (
    <Select value={params.get("category") ?? ""} onChange={(e) => setParams({ category: e.target.value || null })} className="w-full sm:w-48" aria-label="Filtrer par catégorie">
      <option value="">Toutes les catégories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
      <option value="none">Sans catégorie</option>
    </Select>
  );
}

export function ProductsView({
  rows, total, page, pageSize, hasQuery, categories, taxRates, defaultTaxRate, counts, openNew, editing, canWrite, canDelete,
}: {
  rows: ProductRow[]; total: number; page: number; pageSize: number; hasQuery: boolean; categories: CategoryItem[];
  taxRates: { name: string; rate: number }[]; defaultTaxRate: number; counts: { PRODUCT: number; SERVICE: number };
  openNew: boolean; editing: (ProductValue & { id: string }) | null; canWrite: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; product: (ProductValue & { id?: string }) | null }>({ open: false, product: null });
  const [catOpen, setCatOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "grid" || v === "table") setView(v); } catch { /* stockage indisponible : mode par défaut */ }
  }, []);
  const changeView = (m: ViewMode) => {
    setView(m);
    try { localStorage.setItem(VIEW_KEY, m); } catch { /* ignoré */ }
  };

  // Ouverture depuis l'URL (?new=1 ou ?edit=id) — actions rapides, recherche globale
  useEffect(() => {
    if (openNew && canWrite) setDrawer({ open: true, product: null });
    else if (editing && canWrite) setDrawer({ open: true, product: editing });
  }, [openNew, editing, canWrite]);

  const closeDrawer = (o: boolean) => {
    setDrawer((d) => ({ ...d, open: o }));
    if (!o && (params.has("new") || params.has("edit"))) {
      const next = new URLSearchParams(params.toString());
      next.delete("new");
      next.delete("edit");
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  };

  const toggleActive = async (p: ProductRow) => {
    const res = await setProductActive(p.id, !p.active);
    if (res.ok) { toast.success(res.message); } else toast.error(res.error);
  };
  const remove = async (p: ProductRow) => {
    const ok = await confirm({
      title: `Supprimer « ${p.name} » ?`,
      description: p.usage > 0 ? `Cet article figure sur ${p.usage} ligne(s) de documents. Ces documents ne seront pas modifiés : ils conservent leur propre copie de la désignation et du prix.` : "Cette action est définitive.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    const res = await deleteProduct(p.id);
    if (res.ok) { toast.success(res.message); } else toast.error(res.error);
  };

  const rowMenu = (p: ProductRow) =>
    canWrite && (
      <DropdownMenu>
        <DropdownTrigger asChild>
          <button className="rounded-md p-1.5 text-faint opacity-60 transition-all hover:bg-subtle hover:text-ink group-hover:opacity-100 data-[state=open]:bg-subtle data-[state=open]:opacity-100" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => setDrawer({ open: true, product: p })}><Pencil /> Modifier</DropdownItem>
          <DropdownItem onSelect={() => setDrawer({ open: true, product: { ...p, id: undefined, name: `${p.name} (copie)` } })}><Copy /> Dupliquer</DropdownItem>
          <DropdownItem onSelect={() => toggleActive(p)}><Power /> {p.active ? "Désactiver" : "Réactiver"}</DropdownItem>
          {canDelete && (<><DropdownSeparator /><DropdownItem danger onSelect={() => remove(p)}><Trash2 /> Supprimer</DropdownItem></>)}
        </DropdownContent>
      </DropdownMenu>
    );

  return (
    <>
      <PageHeader
        title="Produits & Services"
        description="Votre catalogue centralisé, réutilisable dans tous vos devis et factures."
        actions={
          canWrite && (
            <>
              <Button variant="secondary" onClick={() => setCatOpen(true)}><Layers className="h-4 w-4" /> Catégories</Button>
              <Button onClick={() => setDrawer({ open: true, product: null })}><PackagePlus className="h-4 w-4" /> Nouvel article</Button>
            </>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} label="Articles" value={counts.PRODUCT + counts.SERVICE} icon={Boxes} tone="brand" />
        <StatCard index={1} label="Produits" value={counts.PRODUCT} icon={Box} tone="sky" />
        <StatCard index={2} label="Services" value={counts.SERVICE} icon={Wrench} tone="violet" />
        <StatCard index={3} label="Catégories" value={categories.length} icon={Tag} tone="amber" />
      </div>
      <ListState>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterTabs
              param="type"
              layoutId="product-type"
              options={[
                { value: "", label: "Tous", count: counts.PRODUCT + counts.SERVICE },
                { value: "PRODUCT", label: "Produits", count: counts.PRODUCT },
                { value: "SERVICE", label: "Services", count: counts.SERVICE },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <CategoryFilter categories={categories} />
              <SearchInput placeholder="Nom, référence, description…" />
              <ViewToggle mode={view} onChange={changeView} layoutId="product-view-toggle" />
            </div>
          </div>
          {rows.length === 0 ? (
            hasQuery ? (
              <EmptyState icon={Package} title="Aucun article trouvé" description="Essayez d'autres mots-clés ou modifiez les filtres." />
            ) : (
              <EmptyState
                icon={Package}
                title="Votre catalogue est vide"
                description="Ajoutez vos produits et services pour les insérer en un clic dans vos devis et factures."
                action={canWrite && <Button onClick={() => setDrawer({ open: true, product: null })}><PackagePlus className="h-4 w-4" /> Ajouter un article</Button>}
              />
            )
          ) : (
            <>
              {view === "grid" ? (
                <div className="grid gap-4 p-4 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((p, i) => (
                    <ProductCard key={p.id} p={p} index={i} canWrite={canWrite} onOpen={() => setDrawer({ open: true, product: p })} menu={rowMenu(p)} />
                  ))}
                </div>
              ) : (
              <Table>
                <THead>
                  <SortHeader field="name">Article</SortHeader>
                  <Th className="hidden md:table-cell">Catégorie</Th>
                  <Th className="hidden lg:table-cell">Unité</Th>
                  <Th className="hidden sm:table-cell" align="right">TVA</Th>
                  <SortHeader field="unitPrice" align="right">Prix HT</SortHeader>
                  <Th className="hidden lg:table-cell" align="right">Prix TTC</Th>
                  <Th className="w-10" />
                </THead>
                <tbody>
                  {rows.map((p, i) => (
                    <Row key={p.id} index={i} className={cn(!p.active && "opacity-55")}>
                      <Td>
                        <button className="flex w-full items-center gap-3 text-left" onClick={() => canWrite && setDrawer({ open: true, product: p })} disabled={!canWrite}>
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", p.type === "SERVICE" ? "bg-violet-50 text-violet-600 ring-violet-100" : "bg-sky-50 text-sky-600 ring-sky-100")}>
                            {p.type === "SERVICE" ? <Wrench className="h-4 w-4" /> : <Box className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium text-ink group-hover:text-brand-700">{p.name}</span>
                              {!p.active && <Badge dot={false}>Inactif</Badge>}
                            </span>
                            <span className="block max-w-[420px] truncate text-xs text-muted">{[p.sku, p.description].filter(Boolean).join(" · ") || (p.type === "SERVICE" ? "Service" : "Produit")}</span>
                          </span>
                        </button>
                      </Td>
                      <Td className="hidden md:table-cell">
                        {p.category ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
                            <span className="h-2 w-2 rounded-full" style={{ background: p.category.color }} />
                            {p.category.name}
                          </span>
                        ) : <span className="text-xs text-faint">—</span>}
                      </Td>
                      <Td className="hidden text-[13px] text-ink-soft lg:table-cell">{p.unit}</Td>
                      <Td className="hidden whitespace-nowrap text-[13px] tabular text-ink-soft sm:table-cell" align="right">{formatRate(p.taxRate)} %</Td>
                      <Td align="right" className="whitespace-nowrap text-[13px] font-semibold tabular text-ink">{formatMAD(p.unitPrice)}</Td>
                      <Td align="right" className="hidden whitespace-nowrap text-[13px] tabular text-muted lg:table-cell">{formatMAD(Math.round(p.unitPrice * (1 + p.taxRate / 10000)))}</Td>
                      <Td>
                        {rowMenu(p)}
                      </Td>
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

      <ProductDrawer
        open={drawer.open}
        onOpenChange={closeDrawer}
        product={drawer.product}
        categories={categories}
        taxRates={taxRates}
        defaultTaxRate={defaultTaxRate}
        onSaved={() => { closeDrawer(false); }}
      />
      <CategoriesDialog open={catOpen} onOpenChange={setCatOpen} categories={categories} canDelete={canDelete} />
    </>
  );
}
