// Prépare la base de test (création si besoin + migrations). Nécessite un serveur PostgreSQL démarré.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://mactura:mactura@localhost:5433/mactura_test?schema=public";
const name = new URL(url).pathname.slice(1);
const admin = new PrismaClient({ datasources: { db: { url: url.replace(`/${name}`, "/postgres") } } });
const exists = await admin.$queryRawUnsafe(`SELECT 1 FROM pg_database WHERE datname = '${name.replace(/'/g, "")}'`);
if (exists.length === 0) {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
  console.log(`✓ Base de test ${name} créée`);
}
await admin.$disconnect();
execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: url } });
console.log("✓ Base de test migrée");
