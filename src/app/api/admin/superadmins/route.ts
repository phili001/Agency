import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { findAuthUserByEmail } from "@/lib/admin-companies";
import { getBootstrapSuperadminEmails, requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function assertCurrentUserIsAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await requirePlatformAdmin(user);
}

export async function POST(request: Request) {
  try {
    await assertCurrentUserIsAdmin();
    const { email, temporaryPassword } = (await request.json()) as {
      email?: string;
      temporaryPassword?: string;
    };
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email requerido." }, { status: 400 });
    }

    const admin = createAdminClient();
    let user = await findAuthUserByEmail(admin, normalizedEmail);
    let userCreated = false;

    if (!user) {
      const password = temporaryPassword?.trim();

      if (!password || password.length < 8) {
        return NextResponse.json(
          {
            error:
              "Ese usuario no existe. Ingresa una contraseña temporal de mínimo 8 caracteres para crearlo.",
          },
          { status: 400 },
        );
      }

      const created = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        password,
        user_metadata: {
          full_name: normalizedEmail.split("@")[0],
        },
      });

      if (created.error || !created.data.user) {
        throw created.error ?? new Error("No se pudo crear el superadmin.");
      }

      user = created.data.user;
      userCreated = true;
    }

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...user.app_metadata,
        platform_admin: true,
      },
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      email: normalizedEmail,
      ok: true,
      userCreated,
    });
  } catch (error) {
    return apiErrorResponse(error, "admin/superadmins");
  }
}

export async function DELETE(request: Request) {
  try {
    await assertCurrentUserIsAdmin();
    const { email } = (await request.json()) as { email?: string };
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email requerido." }, { status: 400 });
    }

    if (getBootstrapSuperadminEmails().includes(normalizedEmail)) {
      return NextResponse.json(
        { error: "Este superadmin viene de SUPERADMIN_EMAILS y no se puede quitar desde la app." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const user = await findAuthUserByEmail(admin, normalizedEmail);

    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const nextAppMetadata = { ...user.app_metadata };
    delete nextAppMetadata.platform_admin;
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: nextAppMetadata,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "admin/superadmins");
  }
}
