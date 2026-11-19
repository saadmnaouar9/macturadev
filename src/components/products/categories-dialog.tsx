"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import { deleteCategory, saveCategory } from "@/app/(app)/produits/actions";

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
  count: number;
}

const COLORS = ["#4F43AD", "#0EA5E9", "#10B981", "#F59E0B", "#EE6136", "#8B5CF6", "#EC4899", "#64748B"];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Couleur ${c}`} className={cn("h-5 w-5 rounded-full ring-offset-2 transition-transform hover:scale-110", value.toUpperCase() === c && "ring-2 ring-ink/30")} style={{ background: c }} />
      ))}
    </div>
  );
}

export function CategoriesDialog({ open, onOpenChange, categories, canDelete }: { open: boolean; onOpenChange: (o: boolean) => void; categories: CategoryItem[]; canDelete: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);

  const create = () =>
    start(async () => {
      const res = await saveCategory(null, { name, color });
      if (res.ok) { toast.success(res.message); setName(""); } else toast.error(res.fieldErrors?.name ?? res.error);
    });
  const update = () =>
    editing &&
    start(async () => {
      const res = await saveCategory(editing.id, { name: editing.name, color: editing.color });
      if (res.ok) { toast.success(res.message); setEditing(null); } else toast.error(res.fieldErrors?.name ?? res.error);
    });
  const remove = async (c: CategoryItem) => {
    const ok = await confirm({ title: `Supprimer « ${c.name} » ?`, description: c.count ? `${c.count} article(s) resteront dans le catalogue, sans catégorie.` : "Cette catégorie sera supprimée.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    const res = await deleteCategory(c.id);
    if (res.ok) { toast.success(res.message); } else toast.error(res.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Catégories" description="Organisez votre catalogue par familles d'articles.">
      <form onSubmit={(e) => { e.preventDefault(); create(); }} className="mb-5 space-y-3 rounded-xl bg-canvas p-3.5 ring-1 ring-inset ring-line-soft">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" aria-label="Nom de la catégorie" />
          <Button type="submit" loading={pending && !editing} disabled={name.trim().length < 2}><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </form>
      {categories.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Aucune catégorie pour le moment.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          <AnimatePresence initial={false}>
            {categories.map((c) => (
              <motion.li key={c.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="py-2.5">
                {editing?.id === c.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), update())} />
                      <Button size="icon" onClick={update} loading={pending} aria-label="Valider"><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Annuler"><X className="h-4 w-4" /></Button>
                    </div>
                    <ColorPicker value={editing.color} onChange={(col) => setEditing({ ...editing, color: col })} />
                  </div>
                ) : (
                  <div className="group flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 text-sm font-medium text-ink">{c.name}</span>
                    <span className="text-xs tabular text-muted">{c.count} article{c.count > 1 ? "s" : ""}</span>
                    <button onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })} className="rounded-md p-1.5 text-faint hover:bg-subtle hover:text-ink" aria-label="Renommer"><Pencil className="h-3.5 w-3.5" /></button>
                    {canDelete && <button onClick={() => remove(c)} className="rounded-md p-1.5 text-faint hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Dialog>
  );
}
