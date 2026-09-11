import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const required = [
  "dist/index.html",
  "netlify.toml",
  "netlify/functions/public-config.mjs",
  "netlify/functions/setup-status.mjs",
  "netlify/functions/register-user.mjs",
  "netlify/functions/admin-user.mjs",
  "netlify/functions/account.mjs",
  "supabase/schema.sql",
  "README.md",
];

const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length) throw new Error(`Faltan archivos: ${missing.join(", ")}`);

function textFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? textFiles(path) : [path];
  });
}

const source = [...textFiles(join(root, "src")), ...textFiles(join(root, "netlify/functions"))]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

if (source.includes("VITE_SUPABASE")) {
  throw new Error("El portal no debe depender de variables VITE_SUPABASE.");
}
if (/SUPABASE_SERVICE_ROLE_KEY\s*=\s*[A-Za-z0-9._-]{20,}/.test(source)) {
  throw new Error("Se detectó una posible clave privada dentro del código.");
}

console.log("Verificación completada: build, funciones, esquema y configuración presentes.");
