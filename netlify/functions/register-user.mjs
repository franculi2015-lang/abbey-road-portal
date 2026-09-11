import {
  adminClient,
  json,
  missingCoreVariables,
  normalizeUsername,
  portalEnv,
  readableAdminError,
  requestBody,
  usernameToEmail,
  validUsername,
} from "./_shared.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return json({ code: "method_not_allowed", error: "Método no permitido." }, 405);
  }

  const env = portalEnv();
  if (missingCoreVariables(env).length) {
    return json({ code: "missing_env", error: "El portal todavía no está configurado." }, 503);
  }

  const body = await requestBody(request);
  if (!body) return json({ code: "invalid_body", error: "Solicitud inválida." }, 400);

  const username = normalizeUsername(body.username);
  const fullName = String(body.fullName || "").trim().replace(/\s+/g, " ");
  const password = String(body.password || "");
  if (!body.adultConsent) {
    return json({ code: "consent_required", error: "Se necesita autorización de una persona adulta responsable." }, 400);
  }
  if (!validUsername(username)) {
    return json({ code: "invalid_username", error: "El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo." }, 400);
  }
  if (fullName.length < 2 || fullName.length > 80) {
    return json({ code: "invalid_name", error: "Ingresá un nombre de entre 2 y 80 caracteres." }, 400);
  }
  if (password.length < 10 || password.length > 128) {
    return json({ code: "invalid_password", error: "La contraseña debe tener entre 10 y 128 caracteres." }, 400);
  }

  const admin = adminClient(env);
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existing) {
    return json({ code: "username_taken", error: "Ese nombre de usuario ya está registrado." }, 409);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (error || !data.user) {
    return json({ code: "create_failed", error: error?.message || "No pudimos crear la cuenta." }, 400);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    username,
    full_name: fullName,
    role: "alumno",
    active: true,
    must_change_password: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    return json({ code: "profile_failed", error: readableAdminError(profileError) }, 500);
  }

  return json({ message: "¡Cuenta creada! Ya podés ingresar como alumno/a.", username }, 201);
};
