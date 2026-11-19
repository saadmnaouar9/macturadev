import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";

export async function GET(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ customers: [], invoices: [], quotes: [], products: [], suppliers: [], prospects: [] });
  const companyId = auth.company.id;
  const contains = { contains: q, mode: "insensitive" as const };

  const [customers, invoices, quotes, products, suppliers, prospects] = await Promise.all([
    db.customer.findMany({
      where: { companyId, OR: [{ name: contains }, { email: contains }, { ice: contains }, { contactName: contains }, { nameAr: contains }] },
      select: { id: true, name: true, city: true, email: true },
      take: 5,
    }),
    db.invoice.findMany({
      where: { companyId, OR: [{ number: contains }, { reference: contains }, { customer: { name: contains } }] },
      select: { id: true, number: true, total: true, customer: { select: { name: true } } },
      orderBy: { issueDate: "desc" },
      take: 5,
    }),
    db.quote.findMany({
      where: { companyId, OR: [{ number: contains }, { reference: contains }, { customer: { name: contains } }] },
      select: { id: true, number: true, total: true, customer: { select: { name: true } } },
      orderBy: { issueDate: "desc" },
      take: 5,
    }),
    db.product.findMany({
      where: { companyId, OR: [{ name: contains }, { sku: contains }, { description: contains }] },
      select: { id: true, name: true, unitPrice: true, type: true },
      take: 5,
    }),
    db.supplier.findMany({ where: { companyId, OR: [{ name: contains }, { email: contains }, { ice: contains }] }, select: { id: true, name: true, city: true }, take: 5 }),
    db.prospect.findMany({ where: { companyId, OR: [{ name: contains }, { email: contains }, { contactName: contains }] }, select: { id: true, name: true, contactName: true }, take: 5 }),
  ]);

  return NextResponse.json({
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, city: s.city })),
    prospects: prospects.map((p) => ({ id: p.id, name: p.name, contact: p.contactName })),
    customers,
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, customer: i.customer.name, total: formatMAD(i.total) })),
    quotes: quotes.map((d) => ({ id: d.id, number: d.number, customer: d.customer.name, total: formatMAD(d.total) })),
    products: products.map((p) => ({ id: p.id, name: p.name, price: formatMAD(p.unitPrice), type: p.type === "SERVICE" ? "Service" : "Produit" })),
  });
}
