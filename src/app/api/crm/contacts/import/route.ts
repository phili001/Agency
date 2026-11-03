import { NextResponse } from "next/server";

import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { IMPORT_MAX_BYTES, importContacts } from "@/lib/crm/import-export";
import { createAdminClient } from "@/lib/supabase/admin";

/** Importa un CSV (cuerpo `text/csv` o `multipart` con el campo `file`). Owner/admin. */
export async function POST(request: Request) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const declared = Number(request.headers.get("content-length") ?? 0);

    if (declared > IMPORT_MAX_BYTES + 64 * 1024) {
      throw badRequest("El archivo supera el máximo permitido (5 MB).");
    }

    const type = request.headers.get("content-type") ?? "";
    let text: string;

    if (type.includes("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) {
        throw badRequest("Adjunta un archivo CSV.");
      }
      text = await file.text();
    } else {
      text = await request.text();
    }

    return NextResponse.json(
      await importContacts(createAdminClient(), workspaceId, text, { kind: "import", userId: user.id }),
    );
  } catch (error) {
    return apiErrorResponse(error, "crm/contacts/import");
  }
}
