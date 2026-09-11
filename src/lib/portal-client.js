import { createClient } from "@supabase/supabase-js";

export let supabase = null;

export function configureSupabase({ url, publishableKey }) {
  if (!url || !publishableKey) {
    throw new Error("La configuración pública de Supabase está incompleta.");
  }

  supabase = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "abbey-road-portal-session-v2",
    },
  });

  return supabase;
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
  const raw = String(value).trim().toLowerCase();
  return raw.includes("@") ? raw : `${normalizeUsername(raw)}@portal.abbeyroad.local`;
}

export function roleLabel(role) {
  return {
    supervisor: "Supervisor",
    profesor: "Profesor/a",
    alumno: "Alumno/a",
  }[role] || role;
}
