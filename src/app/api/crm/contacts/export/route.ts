import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { exportContacts } from "@/lib/crm/import-export";
import { createAdminClient } from "@/lib/supabase/admin";

/** Todos los contactos de la empresa activa en CSV. Owner/admin. */
export async function GET() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const csv = await exportContacts(createAdminClient(), workspaceId);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return new Response(csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="contactos_${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "crm/contacts/export");
  }
}
