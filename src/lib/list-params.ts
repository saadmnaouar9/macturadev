export const PAGE_SIZE = 15;

export function parseListParams(sp: Record<string, string | string[] | undefined>, allowedSorts: string[], defaultSort: string) {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const q = (get("q") ?? "").trim().slice(0, 100);
  const sortRaw = get("sort");
  const sort = sortRaw && allowedSorts.includes(sortRaw) ? sortRaw : defaultSort;
  const dir: "asc" | "desc" = get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(get("page") ?? "1", 10) || 1));
  return { q, sort, dir, page, status: get("status") ?? "", type: get("type") ?? "", get };
}
