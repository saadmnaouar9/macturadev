"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { categorySchema, productSchema } from "@/lib/validation";

async function assertCategory(companyId: string, categoryId: string | null) {
  if (!categoryId) return;
  const cat = await db.category.findFirst({ where: { id: categoryId, companyId } });
  if (!cat) throw new BusinessError("Catégorie invalide.", { categoryId: "Catégorie introuvable" });
}

export async function saveProduct(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const data = productSchema.parse(input);
    await assertCategory(auth.company.id, data.categoryId);
    const payload = { ...data, unitPrice: BigInt(data.unitPrice) };
    if (id) {
      const res = await db.product.updateMany({ where: { id, companyId: auth.company.id }, data: payload });
      if (res.count === 0) throw new BusinessError("Produit introuvable.");
      revalidatePath("/produits");
      return { id };
    }
    const p = await db.product.create({ data: { ...payload, companyId: auth.company.id } });
    await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "product.created", entityType: "product", entityId: p.id, message: `${p.type === "SERVICE" ? "Service" : "Produit"} « ${p.name} » ajouté au catalogue` });
    revalidatePath("/produits");
    return { id: p.id };
  }, id ? "Article mis à jour" : "Article ajouté au catalogue");
}

export async function deleteProduct(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    // Les lignes de devis/factures conservent leur copie (désignation, prix, TVA) : suppression sans perte.
    const res = await db.product.deleteMany({ where: { id, companyId: auth.company.id } });
    if (res.count === 0) throw new BusinessError("Produit introuvable.");
    revalidatePath("/produits");
    return { id };
  }, "Article supprimé");
}

export async function setProductActive(id: string, active: boolean) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const res = await db.product.updateMany({ where: { id, companyId: auth.company.id }, data: { active } });
    if (res.count === 0) throw new BusinessError("Produit introuvable.");
    revalidatePath("/produits");
    return { id };
  }, active ? "Article réactivé" : "Article désactivé");
}

export async function saveCategory(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const data = categorySchema.parse(input);
    if (id) {
      const res = await db.category.updateMany({ where: { id, companyId: auth.company.id }, data });
      if (res.count === 0) throw new BusinessError("Catégorie introuvable.");
      revalidatePath("/produits");
      return { id, ...data };
    }
    const c = await db.category.create({ data: { ...data, companyId: auth.company.id } });
    revalidatePath("/produits");
    return { id: c.id, ...data };
  }, id ? "Catégorie mise à jour" : "Catégorie créée");
}

export async function deleteCategory(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const res = await db.category.deleteMany({ where: { id, companyId: auth.company.id } });
    if (res.count === 0) throw new BusinessError("Catégorie introuvable.");
    revalidatePath("/produits");
    return { id };
  }, "Catégorie supprimée");
}
