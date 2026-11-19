// Les modules serveur importent "server-only" (garde-fou Next.js). Hors de Next, on le neutralise.
import { register } from "node:module";

const hook = `export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`, import.meta.url);

// Chargement CommonJS (tsx) : redirige également require("server-only")
import Module from "node:module";
import { fileURLToPath } from "node:url";
const empty = fileURLToPath(new URL("./empty.cjs", import.meta.url));
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return empty;
  return original.call(this, request, ...rest);
};
