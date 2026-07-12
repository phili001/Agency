import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = ["owner", "admin", "agent", "viewer"] as const;

type TeamRole = (typeof allowedRoles)[number];

function getUserDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email ?? "Usuario";
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  let page = 1;

  while (page <= 10) {
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { email, role, workspaceId } = (await request.json()) as {
    email?: string;
    role?: TeamRole;
    workspaceId?: string;
  };
  const normalizedEmail = email?.trim().toLowerCase();

  if (!workspaceId || !normalizedEmail || !role || !allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: "workspaceId, email y role son requeridos." },
      { status: 400 },
    );
  }

  const { data: currentMember } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!currentMember || !["owner", "admin"].includes(currentMember.role)) {
    return NextResponse.json(
      { error: "Solo owner o admin pueden agregar miembros." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  let targetUser = await findAuthUserByEmail(admin, normalizedEmail);

  if (!targetUser) {
    const invited = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { full_name: normalizedEmail.split("@")[0] },
    });

    if (invited.data.user) {
      targetUser = invited.data.user;
    } else {
      const created = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: false,
        user_metadata: {
          full_name: normalizedEmail.split("@")[0],
        },
      });

      if (created.error || !created.data.user) {
        return NextResponse.json(
          {
            error:
              invited.error?.message ??
              created.error?.message ??
              "No se pudo invitar el usuario en Supabase Auth.",
          },
          { status: 400 },
        );
      }

      targetUser = created.data.user;
    }
  }

  const { data: member, error: memberError } = await admin
    .from("workspace_members")
    .upsert(
      {
        role,
        user_id: targetUser.id,
        workspace_id: workspaceId,
      },
      { onConflict: "workspace_id,user_id" },
    )
    .select("id, workspace_id, user_id, role, created_at")
    .single();

  if (memberError || !member) {
    return NextResponse.json(
      { error: memberError?.message ?? "No se pudo agregar el miembro." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    member: {
      ...member,
      display_email: targetUser.email ?? normalizedEmail,
      display_name: getUserDisplayName({
        email: targetUser.email ?? normalizedEmail,
        user_metadata: targetUser.user_metadata,
      }),
    },
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { memberId, workspaceId } = (await request.json()) as {
    memberId?: string;
    workspaceId?: string;
  };

  if (!memberId || !workspaceId) {
    return NextResponse.json(
      { error: "workspaceId y memberId son requeridos." },
      { status: 400 },
    );
  }

  const { data: currentMember } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!currentMember || !["owner", "admin"].includes(currentMember.role)) {
    return NextResponse.json(
      { error: "Solo owner o admin pueden eliminar miembros." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data: targetMember, error: targetError } = await admin
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (targetError || !targetMember) {
    return NextResponse.json(
      { error: targetError?.message ?? "No se encontro el miembro." },
      { status: 404 },
    );
  }

  if (targetMember.user_id === user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propio acceso desde aqui." },
      { status: 400 },
    );
  }

  if (targetMember.role === "owner") {
    const { count, error: countError } = await admin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "No puedes eliminar el ultimo owner del workspace." },
        { status: 400 },
      );
    }
  }

  const { error: deleteError } = await admin
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
