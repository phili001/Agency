import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { createCompanyWithOwner, findAuthUserByEmail } from "@/lib/admin-companies";
import { normalizeAppUrl } from "@/lib/app-url";
import {
  addAgencyContactTags,
  getAgencyContact,
  getAgencyGhlConfig,
  readAgencyContactField,
  setAgencyContactFields,
} from "@/lib/integrations/ghl-agency";
import { hashSecret, secretMatchesHash } from "@/lib/integrations/secrets";
import {
  ACCESS_READY_TAG,
  buildWelcomeLink,
  GHL_FIELD_ACCESS_LINK,
  GHL_FIELD_COMPANY_NAME,
  GHL_FIELD_WORKSPACE_ID,
  hasPaidTag,
  parsePurchasePayload,
  readWebhookSecrets,
  resolveCompanyName,
} from "@/lib/levy-purchase";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Alta automatica tras pagar Levy en el funnel de la agencia.
 *
 * GHL (workflow "Crear cuenta") -> aqui: se comprueba el secreto, se confirma
 * contra GHL que el contacto pago, se crea usuario + empresa + agentes y se
 * devuelve a GHL el enlace de primer acceso con la etiqueta que dispara el
 * correo. Nada de contraseñas por correo: el cliente la crea con ese enlace.
 */
function fail(status: number, error: string) {
  return NextResponse.json({ error, ok: false }, { status });
}

export async function POST(request: Request) {
  const expectedSecret = process.env.LEVY_PURCHASE_WEBHOOK_SECRET?.trim();

  if (!expectedSecret || !getAgencyGhlConfig()) {
    console.error("[ghl-purchase] Faltan variables de entorno del alta automática.");
    return fail(500, "El alta automática no está configurada.");
  }

  const body = await request.json().catch(() => null);
  const candidates = readWebhookSecrets(request.headers, body);
  const expectedHash = hashSecret(expectedSecret);
  const authorized = Object.values(candidates).some(
    (value) => value && secretMatchesHash(value, expectedHash),
  );

  if (!authorized) {
    // Solo que fuentes llegaron, nunca los valores: sirve para ver si GHL
    // esta quitando el encabezado sin dejar el secreto en los logs.
    console.warn("[ghl-purchase] Secreto inválido. Fuentes recibidas:", {
      authorization: Boolean(candidates.authorization),
      body: Boolean(candidates.body),
      header: Boolean(candidates.header),
      rawAuthorizationHeader: request.headers.has("authorization"),
    });
    return fail(401, "Secreto inválido.");
  }

  const payload = parsePurchasePayload(body);

  if (!payload.ghlContactId) {
    return fail(400, "Falta ghlContactId.");
  }

  try {
    // La fuente de verdad es GHL, no el cuerpo del webhook: asi un formulario
    // enviado sin pagar, o una llamada a mano, no consiguen cuenta.
    const contact = await getAgencyContact(payload.ghlContactId);

    if (!contact) {
      return fail(404, "El contacto no existe en GHL.");
    }

    if (!hasPaidTag(contact.tags)) {
      console.warn(`[ghl-purchase] Contacto ${contact.id} sin etiqueta de pago.`);
      return fail(403, "Ese contacto no tiene un pago registrado.");
    }

    const email = (contact.email ?? payload.email ?? "").trim().toLowerCase();

    if (!email) {
      return fail(400, "El contacto no tiene correo.");
    }

    const admin = createAdminClient();
    const existingUser = await findAuthUserByEmail(admin, email);
    const { data: ownedWorkspace } = existingUser
      ? await admin
          .from("workspaces")
          .select("id")
          .eq("owner_id", existingUser.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // GHL reintenta los webhooks: si ya tiene empresa no se crea otra, solo se
    // le vuelve a mandar el acceso.
    let workspaceId = ownedWorkspace?.id as string | undefined;
    const created = !workspaceId;

    if (!workspaceId) {
      const companyName = resolveCompanyName({
        companyName:
          payload.companyName ?? (await readAgencyContactField(contact, GHL_FIELD_COMPANY_NAME)),
        email,
        firstName: contact.firstName ?? payload.firstName,
      });
      const { workspace } = await createCompanyWithOwner({
        companyName,
        ownerEmail: email,
        // Nadie la conoce: el cliente pone la suya con el enlace de bienvenida.
        temporaryPassword: randomBytes(24).toString("base64url"),
      });
      workspaceId = workspace.id as string;
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      email,
      type: "recovery",
    });

    if (linkError || !link.properties?.hashed_token) {
      throw linkError ?? new Error("Supabase no devolvió el enlace de acceso.");
    }

    const accessLink = buildWelcomeLink(
      normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL),
      link.properties.hashed_token,
    );

    // Primero los campos y despues la etiqueta: la etiqueta dispara el correo
    // y el correo lee el enlace de ese campo.
    await setAgencyContactFields(contact.id, {
      [GHL_FIELD_ACCESS_LINK]: accessLink,
      [GHL_FIELD_WORKSPACE_ID]: workspaceId,
    });
    await addAgencyContactTags(contact.id, [ACCESS_READY_TAG]);

    return NextResponse.json({ created, ok: true, workspaceId });
  } catch (error) {
    console.error("[ghl-purchase] No se pudo completar el alta:", error);
    return fail(500, error instanceof Error ? error.message : "No se pudo crear la cuenta.");
  }
}
