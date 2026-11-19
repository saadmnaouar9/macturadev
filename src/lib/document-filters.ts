import "server-only";
import type { Prisma } from "@prisma/client";
import { ACTIVE_LIFECYCLE } from "./status";
import { todayUTC } from "./utils";

export function quoteStatusWhere(status: string): Prisma.QuoteWhereInput {
  const today = todayUTC();
  switch (status) {
    case "DRAFT":
      return { status: "DRAFT", expiryDate: { gte: today } };
    case "SENT":
      return { status: "SENT", expiryDate: { gte: today } };
    case "ACCEPTED":
    case "REJECTED":
      return { status };
    case "EXPIRED":
      return { OR: [{ status: "EXPIRED" }, { status: { in: ["DRAFT", "SENT"] }, expiryDate: { lt: today } }] };
    default:
      return {};
  }
}

export function invoiceStatusWhere(status: string): Prisma.InvoiceWhereInput {
  const today = todayUTC();
  switch (status) {
    // Cycle de vie
    case "DRAFT":
    case "CANCELLED":
      return { status };
    case "ISSUED":
    case "SENT":
      return { status };
    // Règlement (factures émises/envoyées uniquement)
    case "PAID":
      return { status: { in: ACTIVE_LIFECYCLE }, paymentStatus: "PAID" };
    case "UNPAID":
    case "PARTIAL":
      return { status: { in: ACTIVE_LIFECYCLE }, paymentStatus: status, dueDate: { gte: today } };
    case "OVERDUE":
      return { status: { in: ACTIVE_LIFECYCLE }, paymentStatus: { not: "PAID" }, dueDate: { lt: today } };
    case "OUTSTANDING":
      return { status: { in: ACTIVE_LIFECYCLE }, paymentStatus: { not: "PAID" } };
    default:
      return {};
  }
}
