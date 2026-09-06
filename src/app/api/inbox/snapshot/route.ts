import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { getConversationHandoffInfo } from "@/lib/handoff";
import { createAdminClient } from "@/lib/supabase/admin";

/** Mensajes que se cargan de la conversacion abierta. */
const MESSAGE_PAGE_SIZE = 300;

function stableTime(value: string | null) {
  if (!value) {
    return "Nueva";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nueva";
  }

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
}

function getMetadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getYCloudContactName(metadata: Record<string, unknown>) {
  const ycloud = getMetadataRecord(metadata.ycloud);

  return typeof ycloud.contact_name === "string" && ycloud.contact_name.trim()
    ? ycloud.contact_name.trim()
    : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    const requestedConversationId = searchParams.get("conversationId")?.trim();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent", "viewer"]);

    const admin = createAdminClient();
    const [{ data: workspace }, { data: conversations }] = await Promise.all([
      admin.from("workspaces").select("id, name").eq("id", workspaceId).single(),
      admin
        .from("conversations")
        .select("id, contact_id, status, ai_enabled, last_message_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100),
    ]);
    const contactIds = [...new Set((conversations ?? []).map((item) => item.contact_id))];
    const conversationIds = (conversations ?? []).map((item) => item.id);
    // Si la pedida ya no esta entre las visibles, se cae a la mas reciente.
    const targetConversationId =
      requestedConversationId && conversationIds.includes(requestedConversationId)
        ? requestedConversationId
        : conversationIds[0];
    const [{ data: contacts }, { data: messages }, { data: flowRuns }] = await Promise.all([
      contactIds.length
        ? admin
            .from("contacts")
            .select("id, full_name, phone_e164, email, metadata, automation_labels, messaging_status, created_at")
            .eq("workspace_id", workspaceId)
            .in("id", contactIds)
        : Promise.resolve({ data: [] }),
      // Solo los mensajes de la conversacion abierta, y los mas RECIENTES.
      // Traer 2000 de las 100 conversaciones no escalaba, y pedirlos
      // ascendentes hacia que el limite cortara justo los mensajes nuevos:
      // pasados 2000 mensajes el inbox se quedaba congelado en el pasado.
      targetConversationId
        ? admin
            .from("messages")
            .select("id, conversation_id, body, direction, role, message_type, created_at, metadata")
            .eq("workspace_id", workspaceId)
            .eq("conversation_id", targetConversationId)
            .order("created_at", { ascending: false })
            .limit(MESSAGE_PAGE_SIZE)
        : Promise.resolve({ data: [] }),
      conversationIds.length
        ? admin
            .from("flow_runs")
            .select(
              "id, flow_id, contact_id, conversation_id, current_step_id, status, updated_at",
            )
            .eq("workspace_id", workspaceId)
            .in("conversation_id", conversationIds)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    const { data: pendingReviews } = conversationIds.length
      ? await admin
          .from("flow_answer_reviews")
          .select(
            "id, contact_id, conversation_id, question, original_answer, validation_reason, attempt_count, created_at",
          )
          .eq("workspace_id", workspaceId)
          .eq("status", "pending_human")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : { data: [] };
    const handoffByConversation = await getConversationHandoffInfo(
      admin,
      workspaceId,
      conversationIds,
    );
    const pendingReviewByConversation = new Map(
      (pendingReviews ?? []).map((review) => [review.conversation_id, review]),
    );
    const contactById = new Map((contacts ?? []).map((contact) => [contact.id, contact]));
    const latestFlowRunByConversation = new Map<
      string,
      NonNullable<typeof flowRuns>[number]
    >();
    (flowRuns ?? []).forEach((run) => {
      if (
        run.conversation_id &&
        !latestFlowRunByConversation.has(run.conversation_id)
      ) {
        latestFlowRunByConversation.set(run.conversation_id, run);
      }
    });

    return NextResponse.json({
      conversations: (conversations ?? []).map((conversation) => {
        const contact = contactById.get(conversation.contact_id);
        const metadata = getMetadataRecord(contact?.metadata);
        const flowProgress = getMetadataRecord(metadata.flow_progress);
        const ycloudName = getYCloudContactName(metadata);
        const latestFlowRun = latestFlowRunByConversation.get(conversation.id);

        return {
          aiEnabled: conversation.ai_enabled,
          business: workspace?.name ?? "Workspace",
          contactId: conversation.contact_id,
          contactMetadata: {
            ...metadata,
            automation_labels: contact?.automation_labels ?? [],
            messaging_status: contact?.messaging_status ?? "active",
            pending_review: pendingReviewByConversation.get(conversation.id),
          },
          contactPhone: contact?.phone_e164,
          id: conversation.id,
          name: contact?.full_name ?? ycloudName ?? contact?.phone_e164 ?? "Contacto",
          onboarding: latestFlowRun
            ? {
                completedSteps: Number(flowProgress.completedSteps ?? 0),
                currentStepId: latestFlowRun.current_step_id,
                flowId: latestFlowRun.flow_id,
                runId: latestFlowRun.id,
                stageLabel: String(
                  flowProgress.currentStageLabel ??
                    flowProgress.currentStageKey ??
                    "Inicio",
                ),
                status: latestFlowRun.status,
                totalSteps: Number(flowProgress.totalSteps ?? 0),
              }
            : undefined,
          handoff: handoffByConversation.get(conversation.id) ?? undefined,
          rawStatus: conversation.status,
          status: conversation.ai_enabled ? "IA activa" : "Handoff",
          summary:
            conversation.status === "pending_handoff"
              ? "Conversación esperando atención humana."
              : "Conversación sincronizada desde WhatsApp.",
          time: stableTime(conversation.last_message_at ?? conversation.created_at),
          workspaceId,
        };
      }),
      // Se invierten para mostrarlos en orden cronologico dentro del chat.
      messages: [...(messages ?? [])].reverse(),
      messagesConversationId: targetConversationId ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error, "inbox/snapshot");
  }
}
