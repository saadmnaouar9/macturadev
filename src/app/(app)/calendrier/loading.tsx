import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-header";

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-8 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-ring)]">
        <div className="flex gap-3 p-4">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-9 w-48" />
        </div>
        <TableSkeleton />
      </div>
    </PageContainer>
  );
}
