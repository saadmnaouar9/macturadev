"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Box, Copy, Layers, MoreHorizontal, Package, PackagePlus, Pencil, Power, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead, useListState } from "@/components/data/list-state";
import { Select } from "@/components/ui/field";
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
                      <Td className="hidden text-[13px] tabular text-ink-soft sm:table-cell" align="right">{formatRate(p.taxRate)} %</Td>
                      <Td align="right" className="text-[13px] font-semibold tabular text-ink">{formatMAD(p.unitPrice)}</Td>
                      <Td align="right" className="hidden text-[13px] tabular text-muted lg:table-cell">{formatMAD(Math.round(p.unitPrice * (1 + p.taxRate / 10000)))}</Td>
                      <Td>
                        {canWrite && (
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
                        )}
                      </Td>
                    </Row>
                  ))}
                </tbody>
              </Table>
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
