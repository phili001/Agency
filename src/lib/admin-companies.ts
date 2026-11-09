import "server-only";

import { badRequest, notFound } from "@/lib/api-error";
import {
  buildDefaultAgentConfig,
  buildDefaultAgentPrompt,
  defaultAgentPresets,
} from "@/lib/default-agents";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateNextCompanyCode, getDefaultWorkspaceSlug } from "@/lib/workspaces";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function findAuthUserByEmail(admin: AdminClient, email: string) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (item) => item.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user || data.users.length < 100) {
      return user ?? null;
    }

    page += 1;
  }

  return null;
}

export async function createDefaultAgentsForWorkspace(
  admin: AdminClient,
  workspaceId: string,
) {
  const { data: existingAgents } = await admin
    .from("agents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (existingAgents?.length) {
    return;
  }

  await admin.from("agents").insert(
    defaultAgentPresets.map((preset) => ({
      config: buildDefaultAgentConfig(preset),
      is_active: true,
      model: "gpt-4o-mini",
      name: preset.name,
      system_prompt: buildDefaultAgentPrompt(preset),
      temperature: 0.3,
      type: preset.type,
      workspace_id: workspaceId,
    })),
  );
}

export async function createCompanyWithOwner({
  companyName,
  ownerEmail,
  temporaryPassword,
}: {
  companyName: string;
  ownerEmail: string;
  temporaryPassword: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = ownerEmail.trim().toLowerCase();
  const cleanName = companyName.trim();

  if (!cleanName || !normalizedEmail) {
    throw badRequest("Nombre y correo son requeridos.");
  }

  let owner = await findAuthUserByEmail(admin, normalizedEmail);

  if (!owner) {
    if (temporaryPassword.trim().length < 8) {
      throw badRequest(
        "Ese usuario no existe. La contraseña temporal debe tener mínimo 8 caracteres.",
      );
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      password: temporaryPassword.trim(),
      user_metadata: {
        full_name: normalizedEmail.split("@")[0],
      },
    });

    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario owner.");
    }

    owner = data.user;
  }

  const companyCode = await generateNextCompanyCode();
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .insert({
      company_code: companyCode,
      name: cleanName,
      owner_id: owner.id,
      slug: getDefaultWorkspaceSlug(owner.id, cleanName),
    })
    .select("*")
    .single();

  if (workspaceError || !workspace) {
    throw workspaceError ?? new Error("No se pudo crear la empresa.");
  }

  const { error: memberError } = await admin.from("workspace_members").upsert(
    {
      role: "owner",
      user_id: owner.id,
      workspace_id: workspace.id,
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (memberError) {
    throw memberError;
  }

  await createDefaultAgentsForWorkspace(admin, workspace.id);

  return { owner, workspace };
}

export async function linkOwnerToWorkspace({
  ownerEmail,
  temporaryPassword,
  workspaceId,
}: {
  ownerEmail: string;
  temporaryPassword?: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = ownerEmail.trim().toLowerCase();

  if (!normalizedEmail || !workspaceId) {
    throw badRequest("Correo y empresa son requeridos.");
  }

  let owner = await findAuthUserByEmail(admin, normalizedEmail);

  if (!owner) {
    const password = temporaryPassword?.trim();

    if (!password || password.length < 8) {
      throw badRequest(
        "Ese usuario no existe. Ingresa una contraseña temporal de mínimo 8 caracteres para crearlo.",
      );
    }

    const created = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      password,
      user_metadata: { full_name: normalizedEmail.split("@")[0] },
    });

    if (created.error || !created.data.user) {
      throw created.error ?? new Error("No se pudo crear el usuario.");
    }

    owner = created.data.user;
  }

  const { error: workspaceError } = await admin
    .from("workspaces")
    .update({ owner_id: owner.id })
    .eq("id", workspaceId);

  if (workspaceError) {
    throw workspaceError;
  }

  const { error: memberError } = await admin.from("workspace_members").upsert(
    {
      role: "owner",
      user_id: owner.id,
      workspace_id: workspaceId,
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (memberError) {
    throw memberError;
  }

  await createDefaultAgentsForWorkspace(admin, workspaceId);

  return owner;
}

/** Suscripciones de Stripe que siguen cobrando: borrar la empresa no las cancela. */
const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

/**
 * Borra una empresa con todos sus datos (las tablas hijas caen por `on delete cascade`).
 * Exige escribir el nombre exacto y se niega si hay una suscripción de Stripe viva.
 */
export async function deleteCompany({
  confirmName,
  workspaceId,
}: {
  confirmName: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!workspaceId) {
    throw badRequest("Falta la empresa.");
  }

  const { data: workspace, error } = await admin
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!workspace) {
    throw notFound("La empresa ya no existe.");
  }

  if (confirmName.trim() !== workspace.name.trim()) {
    throw badRequest("El nombre escrito no coincide con el de la empresa.");
  }

  const { data: billing } = await admin
    .from("workspace_billing")
    .select("stripe_subscription_id, status, cancel_at_period_end")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (
    billing?.stripe_subscription_id &&
    billing.status &&
    LIVE_SUBSCRIPTION_STATUSES.has(billing.status) &&
    !billing.cancel_at_period_end
  ) {
    throw badRequest(
      "Esta empresa tiene una suscripción de Stripe activa. Cancélala en Stripe antes de eliminarla.",
    );
  }

  const { error: deleteError } = await admin.from("workspaces").delete().eq("id", workspaceId);

  if (deleteError) {
    throw deleteError;
  }

  return workspace;
}
