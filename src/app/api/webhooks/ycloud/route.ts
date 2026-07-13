import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Webhook ambiguo. Usa /api/webhooks/ycloud/[companyCode]/[secret] para conectar YCloud a una empresa especifica.",
    },
    { status: 400 },
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "ycloud",
    usage: "/api/webhooks/ycloud/AAA001/secret",
  });
}
