import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function logActivity(
  input: {
    companyId: string;
    userId?: string | null;
    type: string;
    entityType: "customer" | "product" | "quote" | "invoice" | "payment" | "company" | "supplier" | "purchase" | "prospect" | "project" | "task" | "contract" | "employee" | "cash";
    entityId: string;
    message: string;
    amount?: number | bigint | null;
  },
  tx: Tx = db,
) {
  await tx.activity.create({
    data: { ...input, amount: input.amount === null || input.amount === undefined ? null : BigInt(input.amount) },
  });
}
