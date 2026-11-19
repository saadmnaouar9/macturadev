import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getCalendarEvents } from "@/lib/calendar";
import { toDateInput, todayUTC } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page-header";
import { CalendarView } from "@/components/modules/calendar-view";

export const metadata: Metadata = { title: "Calendrier" };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const auth = await requireAuth();
  const { m } = await searchParams;
  const today = todayUTC();
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : toDateInput(today).slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  // La grille affiche aussi les jours des mois voisins : on charge une marge de 7 jours de chaque côté
  const start = new Date(Date.UTC(y, mo - 1, -6));
  const end = new Date(Date.UTC(y, mo, 8));
  const events = await getCalendarEvents(auth.company.id, start, end);
  return (
    <PageContainer className="max-w-[1400px]">
      <CalendarView month={month} events={events} today={toDateInput(today)} />
    </PageContainer>
  );
}
