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
      { error: "Tu usuario no tiene email para validar la contrasena actual." },
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
      { error: "La contrasena actual y la nueva son requeridas." },
      { status: 400 },
    );
  }

  if (next.length < 8) {
    return NextResponse.json(
      { error: "La nueva contrasena debe tener minimo 8 caracteres." },
      { status: 400 },
    );
  }

  if (current === next) {
    return NextResponse.json(
      { error: "La nueva contrasena debe ser diferente a la actual." },
      { status: 400 },
    );
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });

  if (signInError) {
    return NextResponse.json(
      { error: "La contrasena actual no es correcta." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: next,
  });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "No se pudo actualizar la contrasena." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
