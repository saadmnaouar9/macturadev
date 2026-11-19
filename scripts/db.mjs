// Starts a local PostgreSQL server (real Postgres binaries shipped via npm).
// Usage: npm run db:start   — keep this terminal open while developing.
// If you already run PostgreSQL elsewhere, skip this and point DATABASE_URL to it.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), ".pgdata");
const port = Number(process.env.PGPORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "mactura",
  password: "mactura",
  port,
  persistent: true,
  onLog: () => {},
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) {
  console.log("› Initialisation du cluster PostgreSQL…");
  await pg.initialise();
}
await pg.start();
if (fresh) {
  await pg.createDatabase("mactura");
}
console.log(`✓ PostgreSQL prêt sur postgresql://mactura:mactura@localhost:${port}/mactura`);

const stop = async () => {
  console.log("\n› Arrêt de PostgreSQL…");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
