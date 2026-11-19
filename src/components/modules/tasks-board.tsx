"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarClock, Check, ListChecks, Plus, Trash2 } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { useConfirm } from "@/components/ui/confirm";
import { CrudDrawer, toFormValues, type FieldDef } from "@/components/data/crud-form";
import { FilterTabs, ListState, SearchInput, useListState } from "@/components/data/list-state";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/status";
import { cn, formatDate, initials, todayUTC } from "@/lib/utils";
import { deleteTask, saveTask, setTaskStatus } from "@/app/(app)/taches/actions";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
}

const COLUMNS: { status: TaskStatus; accent: string }[] = [
  { status: "TODO", accent: "bg-faint" },
  { status: "IN_PROGRESS", accent: "bg-brand-600" },
  { status: "DONE", accent: "bg-emerald-500" },
];
const ease = [0.16, 1, 0.3, 1] as const;

function ProjectFilter({ projects }: { projects: { value: string; label: string }[] }) {
  const params = useSearchParams();
  const { setParams } = useListState();
  return (
    <Select aria-label="Filtrer par projet" value={params.get("project") ?? ""} onChange={(e) => setParams({ project: e.target.value || null })} className="w-full sm:w-52">
      <option value="">Tous les projets</option>
      {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
    </Select>
  );
}

export function TasksBoard({ tasks, projects, members, canWrite, canDelete, counts, defaultProject }: {
  tasks: TaskRow[]; projects: { value: string; label: string }[]; members: { value: string; label: string }[];
  canWrite: boolean; canDelete: boolean; counts: { all: number; mine: number; late: number }; defaultProject: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; task: TaskRow | null }>({ open: false, task: null });
  const today = todayUTC().getTime();

  const fields: FieldDef[] = useMemo(() => [
    { name: "title", label: "Titre", type: "text", required: true, span: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "projectId", label: "Projet", type: "select", options: projects },
    { name: "assigneeId", label: "Assignée à", type: "select", options: members },
    { name: "status", label: "Statut", type: "select", required: true, options: Object.entries(TASK_STATUS).map(([value, v]) => ({ value, label: v.label })) },
    { name: "priority", label: "Priorité", type: "select", required: true, options: Object.entries(TASK_PRIORITY).map(([value, v]) => ({ value, label: v.label })) },
    { name: "dueDate", label: "Échéance", type: "date", span: true },
  ], [projects, members]);

  useEffect(() => {
    if (!canWrite) return;
    const edit = params.get("edit");
    const isNew = params.get("new") === "1";
    if (!isNew && !edit) return;
    const t = edit ? tasks.find((x) => x.id === edit) ?? null : null;
    if (isNew || t) setDrawer({ open: true, task: t });
    const next = new URLSearchParams(params.toString());
    next.delete("new"); next.delete("edit");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = async (t: TaskRow, status: TaskStatus) => {
    const res = await setTaskStatus(t.id, status);
    // setTaskStatus appelle revalidatePath : la réponse de l'action contient déjà les données à jour (pas de refresh supplémentaire)
    if (!res.ok) toast.error(res.error);
  };
  const remove = async (t: TaskRow) => {
    if (!(await confirm({ title: "Supprimer cette tâche ?", description: t.title, confirmLabel: "Supprimer", danger: true }))) return;
    const res = await deleteTask(t.id);
    if (res.ok) { toast.success(res.message); } else toast.error(res.error);
  };

  const initial = toFormValues(fields, drawer.task as unknown as Record<string, unknown> | null, { status: "TODO", priority: "MEDIUM", projectId: defaultProject });

  return (
    <>
      <PageHeader
        title="Tâches"
        description="Organisez le travail de l'équipe : à faire, en cours, terminé."
        actions={canWrite && <Button onClick={() => setDrawer({ open: true, task: null })}><Plus className="h-4 w-4" /> Nouvelle tâche</Button>}
      />
      <ListState>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <FilterTabs param="scope" layoutId="task-scope" options={[{ value: "", label: "Toutes", count: counts.all }, { value: "mine", label: "Mes tâches", count: counts.mine }, { value: "late", label: "En retard", count: counts.late }]} />
            <ProjectFilter projects={projects} />
          </div>
          <SearchInput placeholder="Rechercher une tâche…" />
        </div>
      </ListState>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col, ci) => {
          const items = tasks.filter((t) => t.status === col.status);
          return (
            <motion.section key={col.status} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: ci * 0.06, ease }} className="flex min-h-[200px] flex-col rounded-2xl bg-white/[0.035] p-2.5" aria-label={TASK_STATUS[col.status].label}>
              <header className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
                <span className={cn("h-2 w-2 rounded-full", col.accent)} />
                <h2 className="text-[13px] font-semibold text-ink">{TASK_STATUS[col.status].label}</h2>
                <span className="rounded-md bg-surface px-1.5 text-xs tabular text-muted ring-1 ring-inset ring-line">{items.length}</span>
              </header>
              <ul className="flex-1 space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((t) => {
                    const late = t.status !== "DONE" && t.dueDate && new Date(t.dueDate).getTime() < today;
                    const prev = COLUMNS[ci - 1]?.status;
                    const next = COLUMNS[ci + 1]?.status;
                    return (
                      <motion.li key={t.id} layout="position" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25, ease }} className="group rounded-xl bg-surface p-3 shadow-[var(--shadow-ring),var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-ring),var(--shadow-md)]">
                        <div className="flex items-start gap-2.5">
                          {canWrite && (
                            <button onClick={() => move(t, t.status === "DONE" ? "TODO" : "DONE")} className={cn("mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors", t.status === "DONE" ? "border-emerald-500 bg-emerald-500 text-white" : "border-white/25 hover:border-emerald-500")} aria-label={t.status === "DONE" ? "Rouvrir la tâche" : "Marquer comme terminée"}>
                              {t.status === "DONE" && <Check className="h-3 w-3" strokeWidth={3} />}
                            </button>
                          )}
                          <button className="min-w-0 flex-1 text-left" onClick={() => canWrite && setDrawer({ open: true, task: t })} disabled={!canWrite}>
                            <span className={cn("block text-[13px] font-medium leading-snug", t.status === "DONE" ? "text-faint line-through" : "text-ink")}>{t.title}</span>
                            {t.projectName && <span className="mt-1 block truncate text-xs text-muted">{t.projectName}</span>}
                          </button>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <Badge tone={TASK_PRIORITY[t.priority].tone} dot={false}>{TASK_PRIORITY[t.priority].label}</Badge>
                          {t.dueDate && (
                            <span className={cn("inline-flex items-center gap-1 text-[11px]", late ? "font-medium text-rose-600" : "text-muted")}>
                              <CalendarClock className="h-3 w-3" /> {formatDate(t.dueDate)}
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-0.5">
                            {canWrite && prev && <button onClick={() => move(t, prev)} className="rounded p-1 text-faint opacity-0 hover:bg-subtle hover:text-ink focus:opacity-100 group-hover:opacity-100" aria-label={`Déplacer vers ${TASK_STATUS[prev].label}`}><ArrowLeft className="h-3.5 w-3.5" /></button>}
                            {canWrite && next && <button onClick={() => move(t, next)} className="rounded p-1 text-faint opacity-0 hover:bg-subtle hover:text-ink focus:opacity-100 group-hover:opacity-100" aria-label={`Déplacer vers ${TASK_STATUS[next].label}`}><ArrowRight className="h-3.5 w-3.5" /></button>}
                            {canDelete && <button onClick={() => remove(t)} className="rounded p-1 text-faint opacity-0 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100" aria-label="Supprimer la tâche"><Trash2 className="h-3.5 w-3.5" /></button>}
                            {t.assigneeName && <span title={t.assigneeName} className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent-50 text-[10px] font-semibold text-accent-600 ring-1 ring-inset ring-accent-100">{initials(t.assigneeName)}</span>}
                          </span>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
                {items.length === 0 && (
                  <li className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-8 text-center text-xs text-faint"><ListChecks className="h-4 w-4" /> Aucune tâche</li>
                )}
              </ul>
            </motion.section>
          );
        })}
      </div>

      <CrudDrawer
        open={drawer.open}
        onOpenChange={(o) => setDrawer((d) => ({ ...d, open: o }))}
        title={drawer.task ? "Modifier la tâche" : "Nouvelle tâche"}
        fields={fields}
        initial={initial}
        submitLabel={drawer.task ? "Enregistrer" : "Créer"}
        onSubmit={(payload) => saveTask(drawer.task?.id ?? null, payload)}
        onSaved={() => { setDrawer({ open: false, task: null }); }}
      />
    </>
  );
}
