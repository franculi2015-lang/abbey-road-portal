export class PortalApiError extends Error {
  constructor(message, code = "unknown", status = 0, details = {}) {
    super(message);
    this.name = "PortalApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new PortalApiError(
      "No se pudo conectar con el servidor del portal. Recargá la página o revisá el despliegue.",
      "network_error",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new PortalApiError(
      "Netlify no está ejecutando las funciones del portal. Publicá la carpeta completa, no solamente dist.",
      "functions_unavailable",
      response.status,
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new PortalApiError(
      data.error || "No pudimos completar la acción.",
      data.code || "request_failed",
      response.status,
      data,
    );
  }

  return data;
}
