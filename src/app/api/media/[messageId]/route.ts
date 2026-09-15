import { apiErrorResponse, notFound } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { getWorkspaceYCloudKey } from "@/lib/integrations/ycloud";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sirve la foto, audio o documento de un mensaje de WhatsApp.
 *
 * El link que manda YCloud solo es publico unos minutos y despues exige la
 * API key de la empresa (30 dias). Pasarlo tal cual al navegador dejaba las
 * imagenes rotas; aqui se descarga con la clave del workspace y se reenvia.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const admin = createAdminClient();
    const { data: message } = await admin
      .from("messages")
      .select("id, workspace_id, media_url, message_type, metadata")
      .eq("id", messageId)
      .maybeSingle();

    if (!message?.media_url) {
      throw notFound("Este mensaje no tiene archivo adjunto.");
    }

    await requireWorkspaceRole(message.workspace_id, [
      "owner",
      "admin",
      "agent",
      "viewer",
    ]);

    const apiKey = await getWorkspaceYCloudKey(message.workspace_id);
    const upstream = await fetch(message.media_url, {
      cache: "no-store",
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });

    if (!upstream.ok || !upstream.body) {
      throw notFound(
        upstream.status === 404 || upstream.status === 410
          ? "El archivo ya no está disponible en WhatsApp (caduca a los 30 días)."
          : "No se pudo descargar el archivo de WhatsApp.",
      );
    }

    const metadata =
      message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
        ? (message.metadata as Record<string, unknown>)
        : {};
    const contentType =
      upstream.headers.get("content-type") ??
      (typeof metadata.media_mime_type === "string"
        ? metadata.media_mime_type
        : "application/octet-stream");
    const filename =
      typeof metadata.media_filename === "string" ? metadata.media_filename : null;
    const headers = new Headers({
      "Cache-Control": "private, max-age=3600",
      "Content-Type": contentType,
    });

    if (filename) {
      headers.set(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
    }

    return new Response(upstream.body, { headers, status: 200 });
  } catch (error) {
    return apiErrorResponse(error, "media");
  }
}
