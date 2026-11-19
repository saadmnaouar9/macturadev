"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
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
import { RevenueChart, QuotesChart, StatusDonut } from "./charts";

const ease = [0.16, 1, 0.3, 1] as const;
const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } };

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

function Kpi({
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
    <motion.div variants={item} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="h-full">
      <Card className="group relative h-full overflow-hidden p-5 transition-shadow duration-300 hover:shadow-[var(--shadow-ring),var(--shadow-md)]">
        <div className="flex items-start justify-between">
          <p className="text-[13px] font-medium text-muted">{label}</p>
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset", tone)}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.025em] text-ink">
          <AnimatedNumber value={value} kind={kind} />
        </p>
        <div className="mt-3 flex min-h-5 items-center gap-2 text-xs text-muted">{footer}</div>
        {href && <ArrowUpRight className="absolute bottom-5 right-5 h-4 w-4 text-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />}
      </Card>
    </motion.div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-offset-4">
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
  "invoice.issued": { icon: Receipt, cls: "bg-sky-50 text-sky-600 ring-sky-100" },
  "invoice.sent": { icon: Receipt, cls: "bg-sky-50 text-sky-600 ring-sky-100" },
  "quote.created": { icon: FileText, cls: "bg-subtle text-muted ring-line" },
  "quote.sent": { icon: FileText, cls: "bg-sky-50 text-sky-600 ring-sky-100" },
  "quote.converted": { icon: Receipt, cls: "bg-violet-50 text-violet-600 ring-violet-100" },
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
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">Voici la situation de votre activité sur les {PERIOD_LABEL[data.period].replace("depuis", "mois écoulés depuis")}.</p>
        </motion.div>
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
      </div>

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
                  <Link key={s.href} href={s.href} className="inline-flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-inset ring-line transition-colors hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200">
                    <s.icon className="h-4 w-4" /> {s.label}
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div key={data.period} variants={container} initial="hidden" animate="show" className={cn("grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3", pending && "opacity-60")}>
        <Kpi
          label="Chiffre d'affaires encaissé"
          value={kpis.collected.value}
          icon={Wallet}
          tone="bg-brand-50 text-brand-700 ring-brand-100"
          footer={<><Change value={kpis.collected.change} /> {kpis.collected.change !== null && <span>vs période précédente</span>}</>}
        />
        <Kpi
          label="Total facturé (TTC)"
          value={kpis.invoiced.value}
          icon={Receipt}
          tone="bg-sky-50 text-sky-700 ring-sky-100"
          href="/factures"
          footer={<><Change value={kpis.invoiced.change} /> <span>{kpis.invoiced.count} factures émises</span></>}
        />
        <Kpi
          label="Factures payées"
          value={kpis.paid.value}
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-700 ring-emerald-100"
          href="/factures?status=PAID"
          footer={<span><span className="font-medium text-ink-soft">{kpis.paid.count}</span> factures soldées sur la période</span>}
        />
        <Kpi
          label="Factures impayées"
          value={kpis.unpaid.value}
          icon={Hourglass}
          tone="bg-amber-50 text-amber-700 ring-amber-100"
          href="/factures?status=OUTSTANDING"
          footer={<span><span className="font-medium text-ink-soft">{kpis.unpaid.count}</span> factures en attente de règlement</span>}
        />
        <Kpi
          label="Paiements en retard"
          value={kpis.overdue.value}
          icon={AlertTriangle}
          tone="bg-rose-50 text-rose-700 ring-rose-100"
          href="/factures?status=OVERDUE"
          footer={
            kpis.overdue.count > 0 ? (
              <span className="text-rose-700"><span className="font-semibold">{kpis.overdue.count}</span> factures échues à relancer</span>
            ) : (
              <span className="text-emerald-700">Aucun retard de paiement</span>
            )
          }
        />
        <Kpi
          label="Clients"
          value={kpis.customers.value}
          kind="int"
          icon={Users}
          tone="bg-accent-50 text-accent-600 ring-accent-100"
          href="/clients"
          footer={<span><span className="font-medium text-ink-soft">+{kpis.customers.newCount}</span> nouveaux sur la période</span>}
        />
        <Kpi
          label="Trésorerie"
          value={data.extra.treasury}
          icon={Landmark}
          tone="bg-brand-50 text-brand-700 ring-brand-100"
          href="/tresorerie"
          footer={<span>Banque <span className="font-medium text-ink-soft">{formatMAD(data.extra.bank)}</span> · Caisse <span className="font-medium text-ink-soft">{formatMAD(data.extra.cash)}</span></span>}
        />
        <Kpi
          label="Dettes fournisseurs"
          value={data.extra.payable}
          icon={ShoppingCart}
          tone="bg-accent-50 text-accent-600 ring-accent-100"
          href="/achats"
          footer={data.extra.payableOverdue > 0 ? <span className="text-rose-700"><span className="font-semibold">{data.extra.payableOverdue}</span> factures échues à régler</span> : <span>{data.extra.payableCount} factures en attente</span>}
        />
        <Kpi
          label="Tâches en cours"
          value={data.extra.openTasks}
          kind="int"
          icon={ListChecks}
          tone="bg-violet-50 text-violet-700 ring-violet-100"
          href="/taches"
          footer={data.extra.lateTasks > 0 ? <span className="text-rose-700"><span className="font-semibold">{data.extra.lateTasks}</span> en retard</span> : <span className="text-emerald-700">Aucun retard</span>}
        />
      </motion.div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.2, ease }} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader title="Évolution du chiffre d'affaires" description="Montants facturés et encaissés (TTC) sur les 12 derniers mois" />
            <div className="px-2 pb-4 pt-2 sm:px-4">
              <RevenueChart data={data.revenueSeries} />
            </div>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.27, ease }}>
          <Card className="h-full">
            <CardHeader title="Répartition des factures" description={`Montants TTC — ${PERIOD_LABEL[data.period]}`} />
            <StatusDonut data={data.statusBreakdown} />
          </Card>
        </motion.div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.3, ease }} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader title="Performance commerciale" description="Devis émis et acceptés par mois (montants TTC)" />
            <div className="px-2 pb-4 pt-2 sm:px-4">
              <QuotesChart data={data.quoteSeries} />
            </div>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.36, ease }}>
          <Card className="h-full">
            <CardHeader title="Indicateurs clés" description={PERIOD_LABEL[data.period]} />
            <div className="grid grid-cols-2 gap-3 p-5">
              {[
                { label: "Taux de conversion", icon: Percent, value: data.indicators.conversion, kind: "percent" as const, hint: "devis acceptés / décidés" },
                { label: "Taux d'encaissement", icon: Wallet, value: data.indicators.recovery, kind: "percent" as const, hint: "encaissé / facturé" },
                { label: "Délai moyen de paiement", icon: Timer, value: data.indicators.avgDelay, kind: "days" as const, hint: "émission → règlement" },
                { label: "Facture moyenne", icon: Receipt, value: data.indicators.avgInvoice, kind: "mad" as const, hint: "montant TTC" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg bg-canvas p-3.5 ring-1 ring-inset ring-line-soft">
                  <k.icon className="h-4 w-4 text-faint" />
                  <p className="mt-2.5 text-[17px] font-semibold tracking-tight text-ink">
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.4, ease }}>
          <Card className="h-full">
            <CardHeader title="Transactions récentes" description="Derniers paiements reçus" action={<Link href="/factures?status=PAID" className="text-[13px] font-medium text-brand-700 hover:underline">Tout voir</Link>} />
            {data.recentPayments.length === 0 ? (
              <EmptyState icon={CircleDollarSign} title="Aucun paiement" description="Les règlements enregistrés sur vos factures apparaîtront ici." />
            ) : (
              <ul className="mt-3 divide-y divide-line-soft">
                {data.recentPayments.map((p, i) => (
                  <motion.li key={p.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.04, duration: 0.35, ease }}>
                    <Link href={`/factures/${p.invoiceId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">{initials(p.customerName)}</span>
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

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.46, ease }}>
          <Card className="h-full">
            <CardHeader title="Meilleurs clients" description={`Chiffre facturé — ${PERIOD_LABEL[data.period]}`} />
            {data.topCustomers.length === 0 ? (
              <EmptyState icon={Users} title="Pas encore de données" description="Vos principaux clients s'afficheront dès les premières factures émises." />
            ) : (
              <ul className="space-y-4 p-5">
                {data.topCustomers.map((c, i) => {
                  const max = data.topCustomers[0].amount || 1;
                  return (
                    <li key={c.id}>
                      <Link href={`/clients/${c.id}`} className="group block">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] font-medium text-ink group-hover:text-brand-700">{c.name}</span>
                          <span className="shrink-0 text-[13px] font-semibold tabular text-ink">{formatMAD(c.amount)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
                          <motion.div
                            className="h-full rounded-full bg-brand-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${(c.amount / max) * 100}%` }}
                            transition={{ duration: 0.9, delay: 0.5 + i * 0.08, ease }}
                          />
                        </div>
                        {c.city && <span className="mt-1 block text-[11px] text-faint">{c.city}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.52, ease }} className="lg:col-span-2 xl:col-span-1">
          <Card className="h-full">
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
                      {a.href ? <Link href={a.href} className="group flex gap-3">{body}</Link> : <div className="flex gap-3">{body}</div>}
                    </motion.li>
                  );
                })}
              </ol>
            )}
          </Card>
        </motion.div>
      </div>

      {canWrite && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.58, ease }} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/factures/new", label: "Nouvelle facture", desc: "Facturer un client", icon: Receipt },
            { href: "/devis/new", label: "Nouveau devis", desc: "Proposer une offre", icon: FileText },
            { href: "/clients/new", label: "Nouveau client", desc: "Particulier ou entreprise", icon: UserPlus },
            { href: "/produits?new=1", label: "Nouveau produit", desc: "Enrichir le catalogue", icon: PackagePlus },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="group flex items-center gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-ring)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-ring),var(--shadow-md)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <a.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{a.label}</span>
                <span className="block text-xs text-muted">{a.desc}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          ))}
        </motion.div>
      )}
    </div>
  );
}
