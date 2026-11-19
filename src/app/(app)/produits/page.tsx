import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer } from "@/components/ui/page-header";
import { ProductsView } from "@/components/products/products-view";

export const metadata: Metadata = { title: "Produits & Services" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, type, get } = parseListParams(sp, ["name", "unitPrice", "createdAt"], "name");
  const category = get("category") ?? "";
  const companyId = auth.company.id;
  const where: Prisma.ProductWhereInput = {
    companyId,
    ...(type === "PRODUCT" || type === "SERVICE" ? { type } : {}),
    ...(category ? { categoryId: category === "none" ? null : category } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const effectiveDir = sp.sort ? dir : "asc";

  const [rows, total, categories, taxRates, typeCounts, editing] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ active: "desc" }, { [sort]: effectiveDir }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: true, _count: { select: { invoiceItems: true, quoteItems: true } } },
    }),
    db.product.count({ where }),
    db.category.findMany({ where: { companyId }, orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
    db.taxRate.findMany({ where: { companyId }, orderBy: { rate: "desc" } }),
    db.product.groupBy({ by: ["type"], where: { companyId }, _count: true }),
    sp.edit ? db.product.findFirst({ where: { id: sp.edit, companyId } }) : null,
  ]);

  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { defaultTaxRate: true } });
  const mapProduct = (p: NonNullable<typeof editing>) => ({
    id: p.id, type: p.type, name: p.name, description: p.description, sku: p.sku, unit: p.unit, unitPrice: Number(p.unitPrice), taxRate: p.taxRate, categoryId: p.categoryId, active: p.active,
  });

  return (
    <PageContainer>
      <ProductsView
        rows={rows.map((p) => ({ ...mapProduct(p), category: p.category ? { name: p.category.name, color: p.category.color } : null, usage: p._count.invoiceItems + p._count.quoteItems }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        hasQuery={!!q || !!type || !!category}
        categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color, count: c._count.products }))}
        taxRates={taxRates.map((t) => ({ name: t.name, rate: t.rate }))}
        defaultTaxRate={company.defaultTaxRate}
        counts={{ PRODUCT: typeCounts.find((t) => t.type === "PRODUCT")?._count ?? 0, SERVICE: typeCounts.find((t) => t.type === "SERVICE")?._count ?? 0 }}
        openNew={sp.new === "1"}
        editing={editing ? mapProduct(editing) : null}
        canWrite={can(auth.role, "write")}
        canDelete={can(auth.role, "delete")}
      />
    </PageContainer>
  );
}
