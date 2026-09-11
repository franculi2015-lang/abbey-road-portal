import { createClient } from "@supabase/supabase-js";

export const USER_DOMAIN = "portal.abbeyroad.local";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

export function portalEnv() {
  return {
    url: String(process.env.SUPABASE_URL || "").trim(),
    publishableKey: String(
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
    ).trim(),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    initialSupervisorPassword: String(
      process.env.INITIAL_SUPERVISOR_PASSWORD || "",
    ),
  };
}

export function missingCoreVariables(env = portalEnv()) {
  return [
    !env.url && "SUPABASE_URL",
    !env.publishableKey && "SUPABASE_PUBLISHABLE_KEY",
    !env.serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
}

export function isValidProjectUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeUsername(value = "") {
  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

export function usernameToEmail(value = "") {
  return `${normalizeUsername(value)}@${USER_DOMAIN}`;
}

export function validUsername(value) {
  return /^[a-z0-9._-]{3,30}$/.test(value);
}

export function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

export function adminClient(env = portalEnv()) {
  return createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function publicClient(env = portalEnv()) {
  return createClient(env.url, env.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function authenticatedActor(request, { supervisorOnly = false } = {}) {
  const env = portalEnv();
  const missing = missingCoreVariables(env);
  if (missing.length) {
    return { error: json({ code: "missing_env", error: "Falta configurar el servidor del portal." }, 503) };
  }

  const token = bearerToken(request);
  if (!token) {
    return { error: json({ code: "session_required", error: "Necesitás iniciar sesión." }, 401) };
  }

  const admin = adminClient(env);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json({ code: "invalid_session", error: "La sesión venció. Ingresá nuevamente." }, 401) };
  }

  const { data: actor, error: profileError } = await admin
    .from("profiles")
    .select("id, username, full_name, role, active, must_change_password")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !actor) {
    return { error: json({ code: "profile_missing", error: "No encontramos el perfil de esta cuenta." }, 403) };
  }
  if (!actor.active) {
    return { error: json({ code: "account_inactive", error: "Esta cuenta está desactivada." }, 403) };
  }
  if (supervisorOnly && actor.role !== "supervisor") {
    return { error: json({ code: "supervisor_required", error: "Solo el Supervisor puede realizar esta acción." }, 403) };
  }

  return { admin, actor, authUser: authData.user, env };
}

export function readableAdminError(error, fallback = "No pudimos completar la acción.") {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("already") || message.includes("duplicate") || message.includes("registered")) {
    return "Ese nombre de usuario ya está registrado.";
  }
  if (message.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  if (message.includes("profiles") || message.includes("relation")) {
    return "La base de datos todavía no está preparada. Ejecutá supabase/schema.sql.";
  }
  return fallback;
}

export async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}
