import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { getWorkspaceOpenAIKey } from "@/lib/integrations/openai";

type OpenAIResponsePayload = {
  error?: { message?: string };
  output_text?: string;
};

export async function POST(request: Request) {
  try {
    const { workspaceId } = (await request.json()) as { workspaceId?: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent"]);
    const apiKey = await getWorkspaceOpenAIKey(workspaceId);

    if (!apiKey) {
      return NextResponse.json({ error: "Conecta OpenAI primero." }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: "Responde solo: listo",
        max_output_tokens: 20,
        model: "gpt-5.4-mini",
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as OpenAIResponsePayload;

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message ?? "OpenAI rechazo la prueba." },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true, sample: payload.output_text ?? "listo" });
  } catch (error) {
    return apiErrorResponse(error, "integrations/openai/test");
  }
}
