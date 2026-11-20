"use client";

import { motion } from "framer-motion";
import { Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CardApi } from "@/components/data/resource-view";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";

type Row = { id: string } & Record<string, unknown>;

/** Ancienneté lisible : « 2 ans 3 mois », « 8 mois », « Moins d'un mois ». */
function seniority(hire: string): string {
  const from = new Date(hire);
  const now = new Date();
  let months = (now.getUTCFullYear() - from.getUTCFullYear()) * 12 + (now.getUTCMonth() - from.getUTCMonth());
  if (now.getUTCDate() < from.getUTCDate()) months -= 1;
  if (months < 1) return "Moins d'un mois";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} an${y > 1 ? "s" : ""}` : "", m ? `${m} mois` : ""].filter(Boolean).join(" ");
}

/** Carte d'un employé (affichage « Cartes » de la liste) : identité, poste, contact, ancienneté et salaire. */
export function EmployeeCard({ row, api }: { row: Row; api: CardApi }) {
  const name = String(row.fullName ?? "");
  const position = row.position ? String(row.position) : null;
  const department = row.department ? String(row.department) : null;
  const email = row.email ? String(row.email) : null;
  const phone = row.phone ? String(row.phone) : null;
  const hire = row.hireDate ? String(row.hireDate) : null;
  const salary = Number(row.salary ?? 0);
  const active = row.state !== "INACTIVE";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: active ? 1 : 0.65, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(api.index, 14) * 0.03, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("flex flex-col rounded-xl border border-line-soft bg-surface p-4 transition-colors hover:border-line", api.editable && "cursor-pointer")}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-semibold text-ink-soft">{initials(name || "?")}</span>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left text-[15px] font-semibold text-ink outline-none hover:text-brand-700 focus-visible:underline disabled:cursor-default disabled:hover:text-ink" onClick={api.open} disabled={!api.editable}>{name}</button>
          <p className="truncate text-xs text-muted">{position ?? "Poste non renseigné"}</p>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0">{api.menu}</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={active ? "success" : "neutral"}>{active ? "Actif" : "Parti"}</Badge>
        {department && <span className="text-xs text-muted">{department}</span>}
      </div>

      <div className="mt-3 flex min-h-[1.25rem] flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {email && (
          <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-brand-700" title={email}>
            <Mail className="h-3.5 w-3.5 shrink-0" /><span className="max-w-[170px] truncate">{email}</span>
          </a>
        )}
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-brand-700">
            <Phone className="h-3.5 w-3.5 shrink-0" />{phone}
          </a>
        )}
        {!email && !phone && <span className="text-faint">Aucun moyen de contact</span>}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
        <div>
          <p className="text-xs text-muted">Embauche</p>
          <p className="text-[13px] font-medium text-ink">{hire ? formatDate(hire) : "—"}</p>
          {hire && <p className="text-xs text-faint">{seniority(hire)}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Salaire brut / mois</p>
          <p className="text-[15px] font-semibold tabular text-ink">{salary > 0 ? formatMAD(salary) : "—"}</p>
        </div>
      </div>
    </motion.div>
  );
}
