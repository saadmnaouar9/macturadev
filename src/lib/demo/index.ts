import { PrismaClient } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { DEMO_SCHEMA_SQL } from "./schema-sql";
import { seedDemo } from "../../../prisma/seed";

/**
 * Mode Démo : base PostgreSQL embarquée (PGlite, WebAssembly) créée et remplie au premier accès.
 * Aucune base externe ni DATABASE_URL requise. Les données vivent en mémoire dans l'instance serveur :
 * les modifications sont conservées tant que l'instance reste active, puis le jeu de démonstration est recréé à l'identique.
 */
import { isDemoMode } from "./mode";
export { isDemoMode };
export const DEMO_EMAIL = "demo@mactura.ma";
export const DEMO_PASSWORD = "Demo1234";

export function createDemoClient(): PrismaClient {
  const pg = new PGlite();
  const base = new PrismaClient({ adapter: new PrismaPGlite(pg) as never, log: ["error"] });

  const ready = (async () => {
    await pg.waitReady;
    await pg.exec(DEMO_SCHEMA_SQL);
    await seedDemo(base, { quiet: true });
  })();
  ready.catch((e) => console.error("[demo] initialisation impossible", e));

  // Toute requête attend la fin de l'initialisation (schéma + données) avant de s'exécuter
  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await ready;
          return query(args);
        },
      },
      async $queryRaw({ args, query }) {
        await ready;
        return query(args);
      },
      async $executeRaw({ args, query }) {
        await ready;
        return query(args);
      },
    },
  });

  return new Proxy(extended, {
    get(target, prop, receiver) {
      if (prop === "$transaction") {
        return async (...a: unknown[]) => {
          await ready;
          return (target.$transaction as (...x: unknown[]) => unknown)(...a);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as PrismaClient;
}
