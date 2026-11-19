"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { customerSchema } from "@/lib/validation";

export async function createCustomer(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const data = customerSchema.parse(input);
    const customer = await db.customer.create({ data: { ...data, companyId: auth.company.id } });
    await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "customer.created", entityType: "customer", entityId: customer.id, message: `Client ${customer.name} ajouté` });
    revalidatePath("/", "layout");
    const { id: cid, name, nameAr, contactName, city, address, postalCode, ice, taxId, rc, email, paymentDays } = customer;
    return { id: cid, name, nameAr, contactName, city, address, postalCode, ice, taxId, rc, email, paymentDays };
  }, "Client créé avec succès");
}

export async function updateCustomer(id: string, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const data = customerSchema.parse(input);
    const res = await db.customer.updateMany({ where: { id, companyId: auth.company.id }, data });
    if (res.count === 0) throw new BusinessError("Client introuvable.");
    revalidatePath("/", "layout");
    return { id };
  }, "Client mis à jour");
}

export async function deleteCustomer(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const customer = await db.customer.findFirst({
      where: { id, companyId: auth.company.id },
      include: { _count: { select: { invoices: true, quotes: true } } },
    });
    if (!customer) throw new BusinessError("Client introuvable.");
    if (customer._count.invoices > 0 || customer._count.quotes > 0) {
      throw new BusinessError("Ce client possède des devis ou des factures. Archivez-le plutôt que de le supprimer.");
    }
    await db.customer.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { id };
  }, "Client supprimé");
}

export async function setCustomerArchived(id: string, archived: boolean) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const res = await db.customer.updateMany({ where: { id, companyId: auth.company.id }, data: { archived } });
    if (res.count === 0) throw new BusinessError("Client introuvable.");
    revalidatePath("/", "layout");
    return { id };
  }, archived ? "Client archivé" : "Client restauré");
}
