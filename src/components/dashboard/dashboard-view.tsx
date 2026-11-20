"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileText,
  Hourglass,
  Landmark,
  ListChecks,
  ShoppingCart,
  Loader2,
  PackagePlus,
  Percent,
  Receipt,
  Timer,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DashboardData, Period } from "@/lib/dashboard";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMAD } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/status";
import { cn, formatDate, formatRelative, initials } from "@/lib/utils";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Recharts est chargé après l'affichage de la page : le tableau de bord devient interactif plus tôt
const RevenueChart = dynamic(() => import("./charts").then((m) => m.RevenueChart), { ssr: false, loading: () => <Skeleton className="mx-3 mb-3 h-[300px]" /> });
const QuotesChart = dynamic(() => import("./charts").then((m) => m.QuotesChart), { ssr: false, loading: () => <Skeleton className="mx-3 mb-3 h-[260px]" /> });
const StatusDonut = dynamic(() => import("./charts").then((m) => m.StatusDonut), { ssr: false, loading: () => <Skeleton className="mx-5 mb-5 h-[300px]" /> });

const ease = [0.16, 1, 0.3, 1] as const;
const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease } } };

const PERIOD_LABEL: Record<Period, string> = { "30d": "30 derniers jours", ytd: "depuis le 1er janvier", "12m": "12 derniers mois" };

function Change({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs text-faint">Aucun historique</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular", good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1).replace(".", ",")} %
    </span>
  );
}

/** Grande carte d'indicateur (chiffres principaux) */
function KpiFeatured({
  label,
  value,
  kind = "mad",
  icon: Icon,
  accent,
  tone,
  footer,
  href,
}: {
  label: string;
  value: number;
  kind?: "mad" | "int";
  icon: LucideIcon;
  accent: string;
  tone: string;
  footer: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className="group h-full">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular text-ink">
        <AnimatedNumber value={value} kind={kind} />
      </p>
      <div className="mt-1.5 flex min-h-5 items-center gap-2 text-xs text-muted">{footer}</div>
    </div>
  );
  return href ? (
    <Link prefetch={false} href={href} className="block rounded-md focus-visible:outline-offset-4 hover:[&_p:nth-child(2)]:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Tuile compacte (indicateurs secondaires) */
function KpiTile({
  label,
  value,
  kind = "mad",
  icon: Icon,
  tone,
  footer,
  href,
}: {
  label: string;
  value: number;
  kind?: "mad" | "int";
  icon: LucideIcon;
  tone: string;
  footer: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className="h-full">
      <p className="truncate text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-base font-semibold tracking-tight tabular text-ink"><AnimatedNumber value={value} kind={kind} /></p>
      <div className="mt-1 flex min-h-4 items-center gap-1.5 text-xs leading-snug text-muted">{footer}</div>
    </div>
  );
  return href ? (
    <Link prefetch={false} href={href} className="block rounded-md focus-visible:outline-offset-4 hover:[&_p:nth-child(2)]:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

const ACTIVITY_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  "payment.created": { icon: CircleDollarSign, cls: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  "quote.accepted": { icon: CheckCircle2, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  "quote.rejected": { icon: AlertTriangle, cls: "bg-rose-50 text-rose-600 ring-rose-100" },
  "invoice.issued": { icon: Receipt, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  "invoice.sent": { icon: Receipt, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  "quote.created": { icon: FileText, cls: "bg-subtle text-muted ring-line" },
  "quote.sent": { icon: FileText, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  "quote.converted": { icon: Receipt, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  "customer.created": { icon: UserPlus, cls: "bg-accent-50 text-accent-600 ring-accent-100" },
};

export function DashboardView({ data, firstName, canWrite, welcome, forbidden }: { data: DashboardData; firstName: string; canWrite: boolean; welcome: boolean; forbidden: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const { kpis } = data;

  useEffect(() => {
    if (forbidden) toast.error("Vous n'avez pas accès à cette page.");
    if (welcome) toast.success("Votre espace est prêt", { description: "Commencez par ajouter un client ou un produit." });
  }, [forbidden, welcome]);

  const hour = new Date().getHours();
  const greeting = hour < 18 ? "Bonjour" : "Bonsoir";
  const isEmpty = kpis.invoiced.count === 0 && kpis.customers.value === 0;

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">Voici la situation de votre activité sur les {PERIOD_LABEL[data.period].replace("depuis", "mois écoulés depuis")}.</p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex items-center gap-3">
            {pending && <Loader2 className="h-4 w-4 animate-spin text-faint" />}
            <SegmentedControl<Period>
              layoutId="period"
              value={data.period}
              onChange={(p) => start(() => router.replace(`${pathname}?period=${p}`, { scroll: false }))}
              options={[
                { value: "30d", label: "30 jours" },
                { value: "ytd", label: "Cette année" },
                { value: "12m", label: "12 mois" },
              ]}
            />
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/factures/new", label: "Nouvelle facture", icon: Receipt },
                { href: "/devis/new", label: "Nouveau devis", icon: FileText },
                { href: "/clients/new", label: "Nouveau client", icon: UserPlus },
                { href: "/produits?new=1", label: "Nouveau produit", icon: PackagePlus },
              ].map((a) => (
                <Link prefetch={false} key={a.href} href={a.href} aria-label={a.label} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-subtle hover:text-ink">
                  <a.icon className="h-3.5 w-3.5 text-muted" />
                  <span>{a.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {isEmpty && canWrite && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6">
          <Card className="overflow-hidden">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-[15px] font-semibold text-ink">Démarrez avec Mactura en trois étapes</p>
                <p className="mt-1 text-sm text-muted">Ajoutez un client, vos produits ou services, puis créez votre premier devis. Les statistiques se rempliront automatiquement.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: "/clients/new", label: "1. Ajouter un client", icon: UserPlus },
                  { href: "/produits?new=1", label: "2. Ajouter un produit", icon: PackagePlus },
                  { href: "/devis/new", label: "3. Créer un devis", icon: FileText },
                ].map((s) => (
                  <Link prefetch={false} key={s.href} href={s.href} className="inline-flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-inset ring-line transition-colors hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200">
                    <s.icon className="h-4 w-4" /> {s.label}
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div key={data.period} variants={container} initial="hidden" animate="show" className={cn("overflow-hidden rounded-xl border border-line-soft bg-surface transition-opacity", pending && "opacity-60")}>
        <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiFeatured
            label="Chiffre d'affaires encaissé"
            value={kpis.collected.value}
            icon={Wallet}
            accent="bg-brand-500"
            tone="text-muted"
            footer={<><Change value={kpis.collected.change} /> {kpis.collected.change !== null && <span>vs période précédente</span>}</>}
          />
          <KpiFeatured
            label="Total facturé (TTC)"
            value={kpis.invoiced.value}
            icon={Receipt}
            accent="bg-brand-500"
            tone="text-muted"
            href="/factures"
            footer={<><Change value={kpis.invoiced.change} /> <span>{kpis.invoiced.count} factures émises</span></>}
          />
          <KpiFeatured
            label="Trésorerie"
            value={data.extra.treasury}
            icon={Landmark}
            accent="bg-emerald-500"
            tone="text-muted"
            href="/tresorerie"
            footer={<span>Banque <span className="font-medium text-ink-soft">{formatMAD(data.extra.bank)}</span> · Caisse <span className="font-medium text-ink-soft">{formatMAD(data.extra.cash)}</span></span>}
          />
          <KpiFeatured
            label="Paiements en retard"
            value={kpis.overdue.value}
            icon={AlertTriangle}
            accent="bg-rose-500"
            tone="text-muted"
            href="/factures?status=OVERDUE"
            footer={
              kpis.overdue.count > 0 ? (
                <span className="text-rose-700"><span className="font-semibold">{kpis.overdue.count}</span> factures échues à relancer</span>
              ) : (
                <span className="text-emerald-700">Aucun retard de paiement</span>
              )
            }
          />
        </div>
        <div className="grid gap-x-8 gap-y-5 border-t border-line-soft p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiTile
            label="Factures payées"
            value={kpis.paid.value}
            icon={CheckCircle2}
            tone="text-muted"
            href="/factures?status=PAID"
            footer={<span><span className="font-medium text-ink-soft">{kpis.paid.count}</span> factures soldées sur la période</span>}
          />
          <KpiTile
            label="Factures impayées"
            value={kpis.unpaid.value}
            icon={Hourglass}
            tone="text-muted"
            href="/factures?status=OUTSTANDING"
            footer={<span><span className="font-medium text-ink-soft">{kpis.unpaid.count}</span> factures en attente de règlement</span>}
          />
          <KpiTile
            label="Clients"
            value={kpis.customers.value}
            kind="int"
            icon={Users}
            tone="text-muted"
            href="/clients"
            footer={<span><span className="font-medium text-ink-soft">+{kpis.customers.newCount}</span> nouveaux sur la période</span>}
          />
          <KpiTile
            label="Dettes fournisseurs"
            value={data.extra.payable}
            icon={ShoppingCart}
            tone="text-muted"
            href="/achats"
            footer={data.extra.payableOverdue > 0 ? <span className="text-rose-700"><span className="font-semibold">{data.extra.payableOverdue}</span> factures échues à régler</span> : <span>{data.extra.payableCount} factures en attente</span>}
          />
          <KpiTile
            label="Tâches en cours"
            value={data.extra.openTasks}
            kind="int"
            icon={ListChecks}
            tone="text-muted"
            href="/taches"
            footer={data.extra.lateTasks > 0 ? <span className="text-rose-700"><span className="font-semibold">{data.extra.lateTasks}</span> en retard</span> : <span className="text-emerald-700">Aucun retard</span>}
          />
        </div>
      </motion.div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06, ease }} className="xl:col-span-2">
          <Card className="h-full rounded-xl">
            <CardHeader title="Évolution du chiffre d'affaires" description="Montants facturés et encaissés (TTC) sur les 12 derniers mois" />
            <div className="px-2 pb-4 pt-2 sm:px-4">
              <RevenueChart data={data.revenueSeries} />
            </div>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08, ease }}>
          <Card className="h-full rounded-xl">
            <CardHeader title="Répartition des factures" description={`Montants TTC — ${PERIOD_LABEL[data.period]}`} />
            <StatusDonut data={data.statusBreakdown} />
          </Card>
        </motion.div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.09, ease }} className="xl:col-span-2">
          <Card className="h-full rounded-xl">
            <CardHeader title="Performance commerciale" description="Devis émis et acceptés par mois (montants TTC)" />
            <div className="px-2 pb-4 pt-2 sm:px-4">
              <QuotesChart data={data.quoteSeries} />
            </div>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.11, ease }}>
          <Card className="h-full rounded-xl">
            <CardHeader title="Indicateurs clés" description={PERIOD_LABEL[data.period]} />
            <div className="grid grid-cols-2 gap-3 p-5">
              {[
                { label: "Taux de conversion", icon: Percent, value: data.indicators.conversion, kind: "percent" as const, hint: "devis acceptés / décidés" },
                { label: "Taux d'encaissement", icon: Wallet, value: data.indicators.recovery, kind: "percent" as const, hint: "encaissé / facturé" },
                { label: "Délai moyen de paiement", icon: Timer, value: data.indicators.avgDelay, kind: "days" as const, hint: "émission → règlement" },
                { label: "Facture moyenne", icon: Receipt, value: data.indicators.avgInvoice, kind: "mad" as const, hint: "montant TTC" },
              ].map((k) => (
                <div key={k.label} className="min-w-0">
                  <p className="text-[17px] font-semibold tracking-tight tabular text-ink">
                    {k.value === null ? (
                      <span className="text-faint">—</span>
                    ) : k.kind === "days" ? (
                      <><AnimatedNumber value={k.value} kind="int" /> <span className="text-sm font-medium text-muted">jours</span></>
                    ) : (
                      <AnimatedNumber value={k.value} kind={k.kind} />
                    )}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-ink-soft">{k.label}</p>
                  <p className="text-[11px] text-faint">{k.hint}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12, ease }}>
          <Card className="h-full rounded-xl">
            <CardHeader title="Transactions récentes" description="Derniers paiements reçus" action={<Link prefetch={false} href="/factures?status=PAID" className="text-[13px] font-medium text-brand-700 hover:underline">Tout voir</Link>} />
            {data.recentPayments.length === 0 ? (
              <EmptyState icon={CircleDollarSign} title="Aucun paiement" description="Les règlements enregistrés sur vos factures apparaîtront ici." />
            ) : (
              <ul className="mt-3 divide-y divide-line-soft">
                {data.recentPayments.map((p, i) => (
                  <motion.li key={p.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.04, duration: 0.35, ease }}>
                    <Link prefetch={false} href={`/factures/${p.invoiceId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">{initials(p.customerName)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{p.customerName}</span>
                        <span className="block truncate text-xs text-muted">{p.invoiceNumber} · {PAYMENT_METHODS[p.method]}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[13px] font-semibold tabular text-emerald-700">+{formatMAD(p.amount)}</span>
                        <span className="block text-[11px] text-faint">{formatDate(p.date)}</span>
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.14, ease }}>
          <Card className="h-full rounded-xl">
            <CardHeader title="Meilleurs clients" description={`Chiffre facturé — ${PERIOD_LABEL[data.period]}`} />
            {data.topCustomers.length === 0 ? (
              <EmptyState icon={Users} title="Pas encore de données" description="Vos principaux clients s'afficheront dès les premières factures émises." />
            ) : (
              <ul className="space-y-4 p-5">
                {data.topCustomers.map((c, i) => {
                  const max = data.topCustomers[0].amount || 1;
                  return (
                    <li key={c.id}>
                      <Link prefetch={false} href={`/clients/${c.id}`} className="group block">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2.5"><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold", i === 0 ? "text-muted" : "bg-subtle text-muted")}>{i + 1}</span><span className="truncate text-[13px] font-medium text-ink group-hover:text-brand-700">{c.name}</span></span>
                          <span className="shrink-0 text-[13px] font-semibold tabular text-ink">{formatMAD(c.amount)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
                          <motion.div
                            className="h-full rounded-full bg-brand-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(c.amount / max) * 100}%` }}
                            transition={{ duration: 0.9, delay: 0.5 + i * 0.08, ease }}
                          />
                        </div>
                        {c.city && <span className="mt-1 block pl-[34px] text-[11px] text-faint">{c.city}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16, ease }} className="lg:col-span-2 xl:col-span-1">
          <Card className="h-full rounded-xl">
            <CardHeader title="Activité récente" description="Les derniers événements de votre espace" />
            {data.activities.length === 0 ? (
              <EmptyState icon={Clock} title="Aucune activité" description="Vos actions apparaîtront ici." />
            ) : (
              <ol className="relative p-5">
                <span className="absolute bottom-8 left-[35px] top-8 w-px bg-line" aria-hidden />
                {data.activities.map((a, i) => {
                  const I = ACTIVITY_ICON[a.type] ?? { icon: Clock, cls: "bg-subtle text-muted ring-line" };
                  const body = (
                    <>
                      <span className={cn("relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset", I.cls)}>
                        <I.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="block text-[13px] leading-snug text-ink-soft group-hover:text-ink">{a.message}</span>
                        <span className="mt-0.5 block text-[11px] text-faint">{formatRelative(a.createdAt)}{a.userName ? ` · ${a.userName}` : ""}</span>
                      </span>
                    </>
                  );
                  return (
                    <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + i * 0.04, duration: 0.35, ease }} className="mb-4 last:mb-0">
                      {a.href ? <Link prefetch={false} href={a.href} className="group flex gap-3">{body}</Link> : <div className="flex gap-3">{body}</div>}
                    </motion.li>
                  );
                })}
              </ol>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
