import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "Tu usuario no tiene email para validar la contraseña actual." },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const current = currentPassword?.trim();
  const next = newPassword?.trim();

  if (!current || !next) {
    return NextResponse.json(
      { error: "La contraseña actual y la nueva son requeridas." },
      { status: 400 },
    );
  }

  if (next.length < 8) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener mínimo 8 caracteres." },
      { status: 400 },
    );
  }

  if (current === next) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser diferente a la actual." },
      { status: 400 },
    );
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });

  if (signInError) {
    return NextResponse.json(
      { error: "La contraseña actual no es correcta." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: next,
  });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "No se pudo actualizar la contraseña." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
