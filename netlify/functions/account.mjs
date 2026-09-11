import { authenticatedActor, json, requestBody } from "./_shared.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return json({ code: "method_not_allowed", error: "Método no permitido." }, 405);
  }

  const auth = await authenticatedActor(request);
  if (auth.error) return auth.error;
  const body = await requestBody(request);
  if (!body || body.action !== "password-changed") {
    return json({ code: "invalid_action", error: "Acción inválida." }, 400);
  }

  const { error } = await auth.admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", auth.actor.id);
  if (error) return json({ code: "update_failed", error: "La clave cambió, pero no pudimos actualizar el aviso." }, 500);

  return json({ message: "Contraseña actualizada." });
};
