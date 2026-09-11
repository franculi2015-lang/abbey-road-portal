import {
  adminClient,
  findAuthUserByEmail,
  isValidProjectUrl,
  json,
  missingCoreVariables,
  portalEnv,
  publicClient,
  readableAdminError,
  usernameToEmail,
} from "./_shared.mjs";

const SUPERVISOR_USERNAME = "Supervisor";
const SUPERVISOR_EMAIL = usernameToEmail(SUPERVISOR_USERNAME);

async function ensureSupervisor(admin, password) {
  const { data: activeSupervisor, error: supervisorError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "supervisor")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (supervisorError) throw supervisorError;
  if (activeSupervisor) return { created: false };

  if (password.length < 10 || password.length > 128) {
    const error = new Error("INITIAL_SUPERVISOR_PASSWORD debe tener entre 10 y 128 caracteres.");
    error.code = "initial_password_missing";
    throw error;
  }

  let authUser = await findAuthUserByEmail(admin, SUPERVISOR_EMAIL);
  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email: SUPERVISOR_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { username: SUPERVISOR_USERNAME, full_name: "Supervisor" },
    });

    if (error) {
      authUser = await findAuthUserByEmail(admin, SUPERVISOR_EMAIL);
      if (!authUser) throw error;
    } else {
      authUser = data.user;
    }
  } else {
    const { error } = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { username: SUPERVISOR_USERNAME, full_name: "Supervisor" },
    });
    if (error) throw error;
  }

  const { data: usernameOwner } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", SUPERVISOR_USERNAME)
    .neq("id", authUser.id)
    .maybeSingle();
  if (usernameOwner) {
    const conflict = new Error("El nombre Supervisor ya pertenece a otra cuenta.");
    conflict.code = "supervisor_username_conflict";
    throw conflict;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: authUser.id,
    username: SUPERVISOR_USERNAME,
    full_name: "Supervisor",
    role: "supervisor",
    active: true,
    must_change_password: true,
  });
  if (profileError) throw profileError;

  return { created: true };
}

export default async (request) => {
  if (request.method !== "GET") {
    return json({ code: "method_not_allowed", error: "Método no permitido." }, 405);
  }

  const env = portalEnv();
  const missing = missingCoreVariables(env);
  if (missing.length || !isValidProjectUrl(env.url)) {
    return json({
      ready: false,
      code: "missing_env",
      title: "Faltan variables en Netlify",
      error: "Completá las variables indicadas y después recargá esta página.",
      missing,
    });
  }

  const admin = adminClient(env);
  const { error: schemaError } = await admin.from("profiles").select("id").limit(1);
  if (schemaError) {
    const schemaIsMissing = schemaError.code === "42P01"
      || schemaError.code === "PGRST205"
      || /relation .*profiles.* does not exist|could not find the table/i.test(schemaError.message || "");
    return json({
      ready: false,
      code: schemaIsMissing ? "schema_missing" : "service_key_invalid",
      title: schemaIsMissing ? "Falta preparar la base de datos" : "La clave privada no coincide",
      error: schemaIsMissing
        ? "Ejecutá el archivo supabase/schema.sql completo en el SQL Editor de Supabase."
        : "Revisá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Netlify. Deben pertenecer al mismo proyecto.",
    });
  }

  const publicAccess = publicClient(env);
  const { error: publicKeyError } = await publicAccess.from("profiles").select("id").limit(0);
  if (publicKeyError && /api key|jwt|unauthorized/i.test(publicKeyError.message || "")) {
    return json({
      ready: false,
      code: "publishable_key_invalid",
      title: "La clave pública no coincide",
      error: "Copiá nuevamente la Publishable key de Supabase y guardala como SUPABASE_PUBLISHABLE_KEY en Netlify.",
    });
  }

  try {
    const result = await ensureSupervisor(admin, env.initialSupervisorPassword);
    return json({
      ready: true,
      supervisorCreated: result.created,
      message: result.created
        ? "El Supervisor inicial fue creado correctamente."
        : "La conexión está lista.",
    });
  } catch (error) {
    const initialPasswordProblem = error.code === "initial_password_missing";
    const usernameConflict = error.code === "supervisor_username_conflict";
    return json({
      ready: false,
      code: initialPasswordProblem
        ? "initial_password_missing"
        : usernameConflict
          ? "supervisor_username_conflict"
          : "bootstrap_failed",
      title: initialPasswordProblem
        ? "Falta la contraseña inicial"
        : usernameConflict
          ? "El usuario Supervisor ya está ocupado"
          : "No se pudo crear el Supervisor",
      error: initialPasswordProblem
        ? "Agregá INITIAL_SUPERVISOR_PASSWORD en Netlify con una clave de al menos 10 caracteres."
        : usernameConflict
          ? "Eliminá o renombrá la cuenta que ya usa Supervisor y volvé a recargar."
          : readableAdminError(error, "Revisá las claves de Supabase configuradas en Netlify."),
    });
  }
};
