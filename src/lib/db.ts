import { PrismaClient } from "@prisma/client";
import { createDemoClient, isDemoMode } from "./demo";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  if (isDemoMode()) return createDemoClient();
  // LOG_QUERIES=1 : journalise chaque requête SQL avec sa durée (diagnostic de performance, désactivé par défaut)
  if (process.env.LOG_QUERIES === "1") {
    const client = new PrismaClient({ log: [{ emit: "event", level: "query" }, "warn", "error"] });
    (client as unknown as { $on: (e: string, cb: (q: { duration: number; query: string }) => void) => void }).$on("query", (q) =>
      console.log(`[sql] ${String(q.duration).padStart(4)}ms ${q.query.replace(/\s+/g, " ").slice(0, 110)}`),
    );
    return client;
  }
  return new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

export const db = globalForPrisma.prisma ?? create();

// En démo (et en dev) le client est conservé pour toute la durée de vie de l'instance : la base embarquée ne doit être créée qu'une fois
if (process.env.NODE_ENV !== "production" || isDemoMode()) globalForPrisma.prisma = db;
