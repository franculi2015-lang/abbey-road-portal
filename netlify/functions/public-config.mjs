import { isValidProjectUrl, json, portalEnv } from "./_shared.mjs";

export default async (request) => {
  if (request.method !== "GET") {
    return json({ code: "method_not_allowed", error: "Método no permitido." }, 405);
  }

  const env = portalEnv();
  const missing = [
    !env.url && "SUPABASE_URL",
    !env.publishableKey && "SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);

  if (missing.length || !isValidProjectUrl(env.url) || env.publishableKey.length < 20) {
    return json(
      {
        code: "public_config_missing",
        error: "Falta completar la configuración pública del portal en Netlify.",
        missing,
      },
      503,
    );
  }

  return json({ url: env.url, publishableKey: env.publishableKey });
};
