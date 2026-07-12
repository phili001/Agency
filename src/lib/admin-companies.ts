import "server-only";

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
      model: "gpt-5.5",
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
    throw new Error("Nombre y correo son requeridos.");
  }

  let owner = await findAuthUserByEmail(admin, normalizedEmail);

  if (!owner) {
    if (temporaryPassword.trim().length < 8) {
      throw new Error(
        "Ese usuario no existe. La contrasena temporal debe tener minimo 8 caracteres.",
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
    throw new Error("Correo y empresa son requeridos.");
  }

  let owner = await findAuthUserByEmail(admin, normalizedEmail);

  if (!owner) {
    const password = temporaryPassword?.trim();

    if (!password || password.length < 8) {
      throw new Error(
        "Ese usuario no existe. Ingresa una contrasena temporal de minimo 8 caracteres para crearlo.",
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
