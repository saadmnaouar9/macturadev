// Régénère src/lib/demo/schema-sql.ts à partir de prisma/schema.prisma (à relancer après chaque changement de schéma).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const sql = execSync("npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script", { encoding: "utf8", maxBuffer: 1 << 26 });
writeFileSync("src/lib/demo/schema-sql.ts", `// Généré par \`npm run demo:schema\` — ne pas modifier à la main.\nexport const DEMO_SCHEMA_SQL = ${JSON.stringify(sql)};\n`);
console.log("schema-sql.ts régénéré");
