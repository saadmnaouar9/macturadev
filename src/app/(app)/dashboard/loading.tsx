import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-header";

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-ring)]">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-4 h-7 w-40" />
            <Skeleton className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-ring)] xl:col-span-2"><Skeleton className="h-72 w-full" /></div>
        <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-ring)]"><Skeleton className="h-72 w-full" /></div>
      </div>
    </PageContainer>
  );
}
