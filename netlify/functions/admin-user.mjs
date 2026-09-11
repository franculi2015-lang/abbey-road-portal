import {
  authenticatedActor,
  json,
  normalizeUsername,
  readableAdminError,
  requestBody,
  usernameToEmail,
  validUsername,
  validUuid,
} from "./_shared.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return json({ code: "method_not_allowed", error: "Método no permitido." }, 405);
  }

  const auth = await authenticatedActor(request, { supervisorOnly: true });
  if (auth.error) return auth.error;

  const body = await requestBody(request);
  if (!body) return json({ code: "invalid_body", error: "Solicitud inválida." }, 400);

  if (body.action === "create") {
    const username = normalizeUsername(body.username);
    const fullName = String(body.fullName || "").trim().replace(/\s+/g, " ");
    const password = String(body.password || "");
    if (!validUsername(username) || fullName.length < 2 || fullName.length > 80 || password.length < 10 || password.length > 128) {
      return json({ code: "invalid_fields", error: "Revisá el usuario, el nombre y la contraseña temporal." }, 400);
    }

    const { data: existing } = await auth.admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (existing) return json({ code: "username_taken", error: "Ese nombre de usuario ya está registrado." }, 409);

    const { data, error } = await auth.admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (error || !data.user) return json({ code: "create_failed", error: readableAdminError(error) }, 400);

    const { error: profileError } = await auth.admin.from("profiles").upsert({
      id: data.user.id,
      username,
      full_name: fullName,
      role: "alumno",
      active: true,
      must_change_password: true,
    });
    if (profileError) {
      await auth.admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      return json({ code: "profile_failed", error: readableAdminError(profileError) }, 500);
    }
    return json({ userId: data.user.id, message: "Cuenta creada como alumno/a." }, 201);
  }

  if (body.action === "update-profile") {
    const userId = String(body.userId || "");
    if (!validUuid(userId)) return json({ code: "invalid_user", error: "El perfil indicado no es válido." }, 400);

    const patch = {};
    if (Object.hasOwn(body, "fullName")) {
      const fullName = String(body.fullName || "").trim().replace(/\s+/g, " ");
      if (fullName.length < 2 || fullName.length > 80) return json({ code: "invalid_name", error: "Revisá el nombre visible." }, 400);
      patch.full_name = fullName;
    }
    if (Object.hasOwn(body, "role")) {
      if (!["supervisor", "profesor", "alumno"].includes(body.role)) return json({ code: "invalid_role", error: "El rol indicado no es válido." }, 400);
      patch.role = body.role;
    }
    if (Object.hasOwn(body, "active")) patch.active = Boolean(body.active);
    if (!Object.keys(patch).length) return json({ code: "empty_patch", error: "No hay cambios para guardar." }, 400);

    const { error } = await auth.admin.from("profiles").update(patch).eq("id", userId);
    if (error) {
      const lastSupervisor = String(error.message || "").includes("last active supervisor");
      return json({ code: "update_failed", error: readableAdminError(error, lastSupervisor ? "Debe quedar al menos un Supervisor activo." : "No pudimos actualizar el perfil.") }, 400);
    }
    return json({ message: "Perfil actualizado." });
  }

  if (body.action === "reset-password") {
    const userId = String(body.userId || "");
    const password = String(body.password || "");
    if (!validUuid(userId) || password.length < 10 || password.length > 128) {
      return json({ code: "invalid_password", error: "Usá una contraseña de entre 10 y 128 caracteres." }, 400);
    }
    const { error } = await auth.admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ code: "reset_failed", error: readableAdminError(error) }, 400);
    await auth.admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
    return json({ message: "Contraseña restablecida." });
  }

  if (body.action === "delete") {
    const userId = String(body.userId || "");
    if (!validUuid(userId) || userId === auth.actor.id) {
      return json({ code: "invalid_delete", error: "No podés eliminar tu propia cuenta desde esta pantalla." }, 400);
    }
    const { error } = await auth.admin.auth.admin.deleteUser(userId);
    if (error) return json({ code: "delete_failed", error: readableAdminError(error, "No pudimos eliminar la cuenta.") }, 400);
    return json({ message: "Cuenta eliminada definitivamente." });
  }

  return json({ code: "unknown_action", error: "Acción desconocida." }, 400);
};
