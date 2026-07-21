import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FlowGhlAction, FlowStage, FlowStep } from "@/lib/flow-definitions";
import { parseFlowSteps } from "@/lib/flow-definitions";
import { verifyFlowAnswer } from "@/lib/flow-answer-verifier";
import { runGoHighLevelFlowActions } from "@/lib/integrations/gohighlevel";
import type { Database, Json } from "@/lib/supabase/database.types";

type AdminClient = SupabaseClient;

type FlowRow = Database["public"]["Tables"]["flows"]["Row"];
type FlowRunRow = Database["public"]["Tables"]["flow_runs"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

type ConversationContext = {
  contactId: string;
  conversationId: string;
  inboundText?: string | null;
  workspaceId: string;
};

const MAX_STEPS_PER_TICK = 8;
const TERMINAL_RUN_STATUSES = ["blocked", "completed", "transferred"];

function withLabel(labels: string[], label: string) {
  return Array.from(new Set([...labels, label]));
}

function withoutLabel(labels: string[], label: string) {
  return labels.filter((item) => item !== label);
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getAnswers(value: Json) {
  return getRecord(value) as Record<string, Json>;
}

function getHistory(value: Json) {
  return Array.isArray(value) ? value : [];
}

function getStringArray(value: Json | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getFlowOptionMetadata(step: FlowStep) {
  return (step.options ?? []).map((option) => ({
    id: option.value,
    title: option.label,
  }));
}

function getFlowStages(flow: FlowRow, steps: FlowStep[]): FlowStage[] {
  const configured = getRecord(flow.trigger_config).stages;
  const stages = Array.isArray(configured)
    ? configured.filter(
        (stage): stage is FlowStage =>
          Boolean(stage) &&
          typeof stage === "object" &&
          !Array.isArray(stage) &&
          typeof (stage as Record<string, unknown>).key === "string" &&
          typeof (stage as Record<string, unknown>).label === "string",
      )
    : [];

  if (stages.length > 0) {
    return stages;
  }

  return Array.from(new Set(steps.map((step) => step.stageKey ?? "inicio"))).map(
    (key) => ({ description: "", key, label: key }),
  );
}

function getNextStepId(steps: FlowStep[], currentStep: FlowStep) {
  return (
    currentStep.nextStepId ??
    steps[steps.findIndex((step) => step.id === currentStep.id) + 1]?.id ??
    null
  );
}

function completeCheckpoint(
  answers: Record<string, Json>,
  flow: FlowRow,
  step: FlowStep,
  steps: FlowStep[],
) {
  const completedStepIds = Array.from(
    new Set([...getStringArray(answers._completed_step_ids), step.id]),
  );
  const stages = getFlowStages(flow, steps);
  const completedStageKeys = stages
    .filter((stage) => {
      const requiredSteps = steps.filter(
        (item) =>
          (item.stageKey ?? stages[0]?.key ?? "inicio") === stage.key &&
          item.requiredForStage !== false,
      );
      return (
        requiredSteps.length > 0 &&
        requiredSteps.every((item) => completedStepIds.includes(item.id))
      );
    })
    .map((stage) => stage.key);
  const nextIncompleteStep = steps.find(
    (item) =>
      item.requiredForStage !== false && !completedStepIds.includes(item.id),
  );

  return {
    ...answers,
    _completed_stage_keys: completedStageKeys,
    _completed_step_ids: completedStepIds,
    _current_stage_key:
      nextIncompleteStep?.stageKey ??
      step.stageKey ??
      stages[stages.length - 1]?.key ??
      "inicio",
  };
}

async function syncContactFlowProgress({
  answers,
  contact,
  flow,
  supabase,
}: {
  answers: Record<string, Json>;
  contact: ContactRow;
  flow: FlowRow;
  supabase: AdminClient;
}) {
  const metadata = getRecord(contact.metadata);
  const steps = parseFlowSteps(flow.steps);
  const stages = getFlowStages(flow, steps);
  const currentStageKey = String(answers._current_stage_key ?? "");
  const completedStepIds = getStringArray(answers._completed_step_ids);
  const requiredStepIds = steps
    .filter((step) => step.requiredForStage !== false)
    .map((step) => step.id);

  await supabase
    .from("contacts")
    .update({
      metadata: {
        ...metadata,
        flow_answers: {
          ...getRecord(metadata.flow_answers),
          ...answers,
        },
        flow_progress: {
          completedStageKeys: getStringArray(answers._completed_stage_keys),
          completedStepIds,
          completedSteps: requiredStepIds.filter((id) => completedStepIds.includes(id))
            .length,
          currentStageKey,
          currentStageLabel:
            stages.find((stage) => stage.key === currentStageKey)?.label ??
            currentStageKey,
          flowId: flow.id,
          totalSteps: requiredStepIds.length,
          updatedAt: new Date().toISOString(),
        },
        flow_updated_at: new Date().toISOString(),
      },
    })
    .eq("id", contact.id)
    .eq("workspace_id", flow.workspace_id);
}

function renderTemplate(template: string, contact: ContactRow, answers: Record<string, Json>) {
  const firstName = contact.full_name?.split(/\s+/)[0] ?? "";
  const values: Record<string, string> = {
    email: contact.email ?? "",
    firstName,
    fullName: contact.full_name ?? "",
    phone: contact.phone_e164,
    videoDia0Url: String(answers.videoDia0Url ?? answers.video_dia_0_url ?? ""),
    ...Object.fromEntries(
      Object.entries(answers).map(([key, value]) => [key, String(value ?? "")]),
    ),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? "");
}

function findStep(steps: FlowStep[], stepId?: string | null) {
  if (!steps.length) {
    return null;
  }

  return steps.find((step) => step.id === stepId) ?? steps[0];
}

function findNextStep(steps: FlowStep[], stepId?: string | null) {
  return stepId ? findStep(steps, stepId) : null;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function waitUntil(step: FlowStep) {
  const amount = Number(step.waitAmount ?? 0);
  const multiplier =
    step.waitUnit === "days" ? 60 * 24 : step.waitUnit === "hours" ? 60 : 1;

  return addMinutes(new Date(), Math.max(1, amount * multiplier)).toISOString();
}

async function logFlowEvent({
  contactId,
  conversationId,
  error,
  eventType,
  flowId,
  flowRunId,
  payload,
  status = "stored",
  supabase,
  workspaceId,
}: {
  contactId?: string | null;
  conversationId?: string | null;
  error?: string | null;
  eventType: string;
  flowId?: string | null;
  flowRunId?: string | null;
  payload?: Json;
  status?: "error" | "stored";
  supabase: AdminClient;
  workspaceId: string;
}) {
  await supabase.from("flow_events").insert({
    contact_id: contactId ?? null,
    conversation_id: conversationId ?? null,
    error: error ?? null,
    event_type: eventType,
    flow_id: flowId ?? null,
    flow_run_id: flowRunId ?? null,
    payload: payload ?? {},
    status,
    workspace_id: workspaceId,
  });
}

async function queueMessage({
  body,
  contactId,
  conversationId,
  metadata,
  supabase,
  workspaceId,
}: {
  body: string;
  contactId: string;
  conversationId: string;
  metadata?: Json;
  supabase: AdminClient;
  workspaceId: string;
}) {
  await supabase.from("messages").insert({
    body,
    contact_id: contactId,
    conversation_id: conversationId,
    direction: "outbound",
    message_type: "text",
    metadata: metadata ?? {},
    role: "assistant",
    status: "queued",
    workspace_id: workspaceId,
  });
}

async function updateRun(
  supabase: AdminClient,
  run: FlowRunRow,
  patch: Partial<FlowRunRow>,
) {
  await supabase
    .from("flow_runs")
    .update(patch)
    .eq("id", run.id)
    .eq("workspace_id", run.workspace_id);
}

async function runStepActions({
  answers,
  contact,
  flow,
  run,
  step,
  supabase,
}: {
  answers?: Record<string, Json>;
  contact: ContactRow;
  flow: FlowRow;
  run: FlowRunRow;
  step: FlowStep;
  supabase: AdminClient;
}) {
  const actions = (step.actions ?? []) as FlowGhlAction[];

  if (actions.length === 0) {
    return;
  }

  try {
    const results = await runGoHighLevelFlowActions({
      actions,
      answers: answers ?? getAnswers(run.answers),
      contact,
      workspaceId: run.workspace_id,
    });

    await logFlowEvent({
      contactId: run.contact_id,
      conversationId: run.conversation_id,
      eventType: "flow_ghl_actions_completed",
      flowId: flow.id,
      flowRunId: run.id,
      payload: {
        results: results as Json,
        stepId: step.id,
      },
      supabase,
      workspaceId: run.workspace_id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido en accion GHL.";

    await logFlowEvent({
      contactId: run.contact_id,
      conversationId: run.conversation_id,
      error: message,
      eventType: "flow_ghl_actions_failed",
      flowId: flow.id,
      flowRunId: run.id,
      payload: {
        actions: actions as Json,
        stepId: step.id,
      },
      status: "error",
      supabase,
      workspaceId: run.workspace_id,
    });

    await updateRun(supabase, run, {
      last_error: message,
    });
  }
}

async function executeRun({
  contact,
  flow,
  run,
  startStepId,
  supabase,
}: {
  contact: ContactRow;
  flow: FlowRow;
  run: FlowRunRow;
  startStepId?: string | null;
  supabase: AdminClient;
}) {
  const steps = parseFlowSteps(flow.steps);
  let currentStep = findStep(steps, startStepId ?? run.current_step_id);
  let answers = getAnswers(run.answers);
  let history = getHistory(run.history);

  for (let index = 0; index < MAX_STEPS_PER_TICK && currentStep; index += 1) {
    history = [
      ...history,
      {
        at: new Date().toISOString(),
        stepId: currentStep.id,
        stepName: currentStep.name,
        type: currentStep.type,
      },
    ];

    if (currentStep.type === "message") {
      await runStepActions({
        contact,
        flow,
        run,
        step: currentStep,
        supabase,
      });
      const body = renderTemplate(currentStep.message ?? "", contact, answers).trim();

      if (body) {
        await queueMessage({
          body,
          contactId: run.contact_id,
          conversationId: run.conversation_id!,
          metadata: {
            flow_id: flow.id,
            flow_run_id: run.id,
            flow_step_id: currentStep.id,
          },
          supabase,
          workspaceId: run.workspace_id,
        });
      }

      answers = completeCheckpoint(answers, flow, currentStep, steps);
      await syncContactFlowProgress({ answers, contact, flow, supabase });
      const nextStepId = getNextStepId(steps, currentStep);

      if (nextStepId && currentStep.waitForInbound === false) {
        currentStep = findStep(steps, nextStepId);
        continue;
      }

      if (nextStepId) {
        answers = {
          ...answers,
          _next_step_id_after_inbound: nextStepId,
        };
      }

      await updateRun(supabase, run, {
        answers,
        completed_at: nextStepId ? null : new Date().toISOString(),
        current_step_id: currentStep.id,
        history,
        status: nextStepId ? "waiting" : "completed",
      });
      return {
        handled: true,
        status: nextStepId ? "waiting_for_next_inbound" : "completed",
      };
    }

    if (currentStep.type === "question" || currentStep.type === "options") {
      const body = renderTemplate(currentStep.message ?? "", contact, answers).trim();

      if (body) {
        await queueMessage({
          body,
          contactId: run.contact_id,
          conversationId: run.conversation_id!,
          metadata: {
            flow_id: flow.id,
            flow_run_id: run.id,
            flow_step_id: currentStep.id,
            ...(currentStep.type === "options"
              ? { flow_options: getFlowOptionMetadata(currentStep) }
              : {}),
            waits_for_answer: true,
          },
          supabase,
          workspaceId: run.workspace_id,
        });
      }

      await updateRun(supabase, run, {
        answers,
        current_step_id: currentStep.id,
        history,
        status: "waiting",
      });
      return { handled: true, status: "waiting_for_answer" };
    }

    if (currentStep.type === "ghl_action") {
      await runStepActions({
        contact,
        flow,
        run,
        step: currentStep,
        supabase,
      });
      answers = completeCheckpoint(answers, flow, currentStep, steps);
      await syncContactFlowProgress({ answers, contact, flow, supabase });
      currentStep = findNextStep(steps, getNextStepId(steps, currentStep));
      continue;
    }

    if (currentStep.type === "webhook" && currentStep.webhookUrl) {
      await runStepActions({
        contact,
        flow,
        run,
        step: currentStep,
        supabase,
      });
      await fetch(currentStep.webhookUrl, {
        body: JSON.stringify({
          answers,
          contact,
          flowId: flow.id,
          flowRunId: run.id,
          stepId: currentStep.id,
          ...(getRecord(currentStep.webhookBody) as Record<string, unknown>),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      answers = completeCheckpoint(answers, flow, currentStep, steps);
      await syncContactFlowProgress({ answers, contact, flow, supabase });
      currentStep = findNextStep(steps, getNextStepId(steps, currentStep));
      continue;
    }

    if (currentStep.type === "wait") {
      await runStepActions({
        contact,
        flow,
        run,
        step: currentStep,
        supabase,
      });
      answers = {
        ...answers,
        _next_step_id: getNextStepId(steps, currentStep) ?? "",
        _wait_until: waitUntil(currentStep),
      };
      await updateRun(supabase, run, {
        answers,
        current_step_id: currentStep.id,
        history,
        status: "waiting",
      });
      return { handled: true, status: "waiting_for_time" };
    }

    if (currentStep.type === "agent") {
      await runStepActions({
        contact,
        flow,
        run,
        step: currentStep,
        supabase,
      });
      await supabase
        .from("conversations")
        .update({
          agent_id: currentStep.agentId || null,
          ai_enabled: true,
          status: "open",
        })
        .eq("id", run.conversation_id!)
        .eq("workspace_id", run.workspace_id);
      answers = completeCheckpoint(answers, flow, currentStep, steps);
      await syncContactFlowProgress({ answers, contact, flow, supabase });
      await updateRun(supabase, run, {
        answers,
        current_step_id: currentStep.id,
        history,
        status: "transferred",
      });
      await supabase
        .from("contacts")
        .update({
          automation_labels: withLabel(
            withoutLabel(contact.automation_labels ?? [], "onboarding_eligible"),
            "onboarding_completed",
          ),
        })
        .eq("id", run.contact_id)
        .eq("workspace_id", run.workspace_id);
      return { handled: true, status: "transferred_to_agent" };
    }

    if (currentStep.type === "human") {
      await runStepActions({
        contact,
        flow,
        run,
        step: currentStep,
        supabase,
      });
      await supabase
        .from("conversations")
        .update({
          ai_enabled: false,
          status: "pending_handoff",
        })
        .eq("id", run.conversation_id!)
        .eq("workspace_id", run.workspace_id);
      answers = completeCheckpoint(answers, flow, currentStep, steps);
      await syncContactFlowProgress({ answers, contact, flow, supabase });
      await updateRun(supabase, run, {
        answers,
        current_step_id: currentStep.id,
        history,
        status: "transferred",
      });
      await supabase
        .from("contacts")
        .update({
          automation_labels: withLabel(
            withoutLabel(contact.automation_labels ?? [], "onboarding_eligible"),
            "onboarding_completed",
          ),
        })
        .eq("id", run.contact_id)
        .eq("workspace_id", run.workspace_id);
      return { handled: true, status: "transferred_to_human" };
    }

    if (currentStep.type === "finish") {
      await runStepActions({
        contact,
        flow,
        run,
        step: currentStep,
        supabase,
      });
      answers = completeCheckpoint(answers, flow, currentStep, steps);
      await syncContactFlowProgress({ answers, contact, flow, supabase });
      await updateRun(supabase, run, {
        answers,
        completed_at: new Date().toISOString(),
        current_step_id: currentStep.id,
        history,
        status: "completed",
      });
      await supabase
        .from("contacts")
        .update({
          automation_labels: withLabel(
            withoutLabel(contact.automation_labels ?? [], "onboarding_eligible"),
            "onboarding_completed",
          ),
        })
        .eq("id", run.contact_id)
        .eq("workspace_id", run.workspace_id);
      return { handled: true, status: "completed" };
    }

    answers = completeCheckpoint(answers, flow, currentStep, steps);
    await syncContactFlowProgress({ answers, contact, flow, supabase });
    currentStep = findNextStep(steps, getNextStepId(steps, currentStep));
  }

  await updateRun(supabase, run, {
    answers,
    completed_at: new Date().toISOString(),
    current_step_id: currentStep?.id ?? null,
    history,
    status: currentStep ? "paused" : "completed",
  });

  return { handled: true, status: currentStep ? "paused_safety_limit" : "completed" };
}

async function getActiveRun(supabase: AdminClient, context: ConversationContext) {
  const { data } = await supabase
    .from("flow_runs")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("conversation_id", context.conversationId)
    .in("status", ["active", "waiting"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as FlowRunRow | null;
}

async function getMatchingFlow(
  supabase: AdminClient,
  context: ConversationContext,
  contact: ContactRow,
) {
  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const inboundText = (context.inboundText ?? "").toLowerCase();

  for (const flow of (flows ?? []) as FlowRow[]) {
    const config = getRecord(flow.trigger_config);
    const audience = String(config.audience ?? "all");
    const labels = contact.automation_labels ?? [];
    const requiredLabels = Array.isArray(config.requiredLabels)
      ? config.requiredLabels.filter((item): item is string => typeof item === "string")
      : [];
    const excludedLabels = Array.isArray(config.excludedLabels)
      ? config.excludedLabels.filter((item): item is string => typeof item === "string")
      : [];
    const allowRepeat = config.allowRepeat === true;

    if (excludedLabels.some((label) => labels.includes(label))) {
      continue;
    }

    if (requiredLabels.length > 0 && !requiredLabels.every((label) => labels.includes(label))) {
      continue;
    }

    if (audience === "new_contacts" && !labels.includes("onboarding_eligible")) {
      continue;
    }

    if (audience === "labels" && requiredLabels.length === 0) {
      continue;
    }

    if (audience === "manual" && flow.trigger_type !== "manual") {
      continue;
    }

    if (!allowRepeat) {
      const { data: previousRun } = await supabase
        .from("flow_runs")
        .select("id")
        .eq("workspace_id", context.workspaceId)
        .eq("flow_id", flow.id)
        .eq("contact_id", context.contactId)
        .in("status", TERMINAL_RUN_STATUSES)
        .limit(1)
        .maybeSingle();

      if (previousRun) {
        continue;
      }
    }

    if (flow.trigger_type === "first_inbound") {
      return flow;
    }

    if (flow.trigger_type === "keyword") {
      const keyword = String(config.keyword ?? "").toLowerCase().trim();
      if (keyword && inboundText.includes(keyword)) {
        return flow;
      }
    }
  }

  return null;
}

export async function startWebhookFlow({
  contactId,
  conversationId,
  flowKey,
  supabase,
  workspaceId,
}: {
  contactId: string;
  conversationId: string;
  flowKey: string;
  supabase: AdminClient;
  workspaceId: string;
}) {
  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("trigger_type", "webhook")
    .order("created_at", { ascending: true });
  const flow = ((flows ?? []) as FlowRow[]).find((item) => {
    const config = getRecord(item.trigger_config);
    return String(config.flowKey ?? config.messageKey ?? "") === flowKey;
  });

  if (!flow) {
    return { handled: false, status: "webhook_flow_not_found" };
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!contact) {
    return { handled: false, status: "contact_not_found" };
  }

  const { data: run, error } = await supabase
    .from("flow_runs")
    .insert({
      contact_id: contactId,
      conversation_id: conversationId,
      flow_id: flow.id,
      status: "active",
      workspace_id: workspaceId,
    })
    .select("*")
    .single();

  if (error || !run) {
    return { handled: false, status: error?.message ?? "flow_start_error" };
  }

  await logFlowEvent({
    contactId,
    conversationId,
    eventType: "flow_started_from_webhook",
    flowId: flow.id,
    flowRunId: run.id,
    payload: { flowKey },
    supabase,
    workspaceId,
  });

  return executeRun({
    contact,
    flow,
    run: run as FlowRunRow,
    supabase,
  });
}

export async function handleInboundFlow({
  context,
  supabase,
}: {
  context: ConversationContext;
  supabase: AdminClient;
}) {
  if (!context.inboundText?.trim()) {
    return { handled: true, status: "ignored_non_text_message" };
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", context.contactId)
    .eq("workspace_id", context.workspaceId)
    .single();

  if (!contact) {
    return { handled: false, status: "contact_not_found" };
  }

  if (contact.messaging_status === "blocked") {
    return { handled: true, status: "contact_blocked" };
  }

  const activeRun = await getActiveRun(supabase, context);

  if (activeRun) {
    const { data: flow } = await supabase
      .from("flows")
      .select("*")
      .eq("id", activeRun.flow_id)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();

    if (!flow) {
      return { handled: false, status: "flow_not_found" };
    }

    const steps = parseFlowSteps(flow.steps);
    const currentStep = findStep(steps, activeRun.current_step_id);
    let answers = getAnswers(activeRun.answers);
    const resumeAfterInbound =
      typeof answers._next_step_id_after_inbound === "string"
        ? answers._next_step_id_after_inbound
        : null;
    const waitUntilValue =
      typeof answers._wait_until === "string" ? Date.parse(answers._wait_until) : null;

    if (waitUntilValue && waitUntilValue > Date.now()) {
      return { handled: true, status: "waiting_for_time" };
    }

    if (currentStep?.type === "wait" && waitUntilValue) {
      const nextStepId =
        typeof answers._next_step_id === "string" && answers._next_step_id
          ? answers._next_step_id
          : getNextStepId(steps, currentStep);
      answers = completeCheckpoint(answers, flow, currentStep, steps);
      delete answers._next_step_id;
      delete answers._wait_until;
      await syncContactFlowProgress({ answers, contact, flow, supabase });

      return executeRun({
        contact,
        flow,
        run: { ...activeRun, answers, status: "active" },
        startStepId: nextStepId,
        supabase,
      });
    }

    if (resumeAfterInbound) {
      delete answers._next_step_id_after_inbound;
      await updateRun(supabase, activeRun, { answers, status: "active" });

      return executeRun({
        contact,
        flow,
        run: { ...activeRun, answers, status: "active" },
        startStepId: resumeAfterInbound,
        supabase,
      });
    }

    let nextStepId = currentStep ? getNextStepId(steps, currentStep) : null;

    if (currentStep?.type === "question" && currentStep.fieldKey) {
      const originalAnswer = context.inboundText ?? "";
      const validationEnabled = currentStep.validationEnabled !== false;
      const verification = validationEnabled
        ? await verifyFlowAnswer({
            answer: originalAnswer,
            criteria: currentStep.validationCriteria ?? "",
            minimumLength: currentStep.validationMinLength ?? 3,
            question: currentStep.message ?? currentStep.name,
            supabase,
            workspaceId: context.workspaceId,
          })
        : {
            confidence: 1,
            model: null,
            normalizedAnswer: originalAnswer.trim(),
            reason: "Validacion desactivada para esta pregunta.",
            source: "local_fallback" as const,
            valid: true,
          };

      const { data: priorReviews } = await supabase
        .from("flow_answer_reviews")
        .select("status, post_review_attempts")
        .eq("workspace_id", context.workspaceId)
        .eq("flow_run_id", activeRun.id)
        .eq("step_id", currentStep.id)
        .order("created_at", { ascending: true });
      const humanRejected = (priorReviews ?? []).some(
        (review) => review.status === "rejected_by_human",
      );
      const priorAiRejections = (priorReviews ?? []).filter(
        (review) =>
          review.status === "rejected_by_ai" || review.status === "pending_human",
      ).length;
      const priorPostReviewAttempts = Math.max(
        0,
        ...(priorReviews ?? []).map((review) => review.post_review_attempts ?? 0),
      );
      const attemptCount = priorAiRejections + 1;
      const postReviewAttempts = humanRejected ? priorPostReviewAttempts + 1 : 0;

      if (!verification.valid) {
        const shouldBlock = humanRejected && postReviewAttempts >= 2;
        const needsHumanReview = !humanRejected && attemptCount >= 3;
        const reviewStatus = shouldBlock
          ? "blocked"
          : needsHumanReview
            ? "pending_human"
            : "rejected_by_ai";

        await supabase.from("flow_answer_reviews").insert({
          attempt_count: attemptCount,
          confidence: verification.confidence,
          contact_id: context.contactId,
          conversation_id: context.conversationId,
          field_key: currentStep.fieldKey,
          flow_id: flow.id,
          flow_run_id: activeRun.id,
          model: verification.model,
          normalized_answer: verification.normalizedAnswer,
          original_answer: originalAnswer,
          post_review_attempts: postReviewAttempts,
          question: currentStep.message ?? currentStep.name,
          status: reviewStatus,
          step_id: currentStep.id,
          validation_reason: verification.reason,
          workspace_id: context.workspaceId,
        });

        await logFlowEvent({
          contactId: context.contactId,
          conversationId: context.conversationId,
          eventType: "flow_answer_rejected",
          flowId: flow.id,
          flowRunId: activeRun.id,
          payload: {
            attemptCount,
            postReviewAttempts,
            reason: verification.reason,
            stepId: currentStep.id,
          },
          supabase,
          workspaceId: context.workspaceId,
        });

        if (shouldBlock) {
          await Promise.all([
            updateRun(supabase, activeRun, {
              last_error: verification.reason,
              status: "blocked",
            }),
            supabase
              .from("contacts")
              .update({
                automation_labels: withLabel(
                  withoutLabel(
                    contact.automation_labels ?? [],
                    "onboarding_review_pending",
                  ),
                  "blocked_invalid_answers",
                ),
                messaging_status: "blocked",
              })
              .eq("id", contact.id)
              .eq("workspace_id", context.workspaceId),
            supabase
              .from("conversations")
              .update({ ai_enabled: false, status: "pending_handoff" })
              .eq("id", context.conversationId)
              .eq("workspace_id", context.workspaceId),
          ]);
          return { handled: true, status: "blocked_invalid_answers" };
        }

        if (needsHumanReview) {
          await Promise.all([
            updateRun(supabase, activeRun, {
              last_error: verification.reason,
              status: "review_pending",
            }),
            supabase
              .from("contacts")
              .update({
                automation_labels: withLabel(
                  contact.automation_labels ?? [],
                  "onboarding_review_pending",
                ),
              })
              .eq("id", contact.id)
              .eq("workspace_id", context.workspaceId),
            supabase
              .from("conversations")
              .update({ ai_enabled: false, status: "pending_handoff" })
              .eq("id", context.conversationId)
              .eq("workspace_id", context.workspaceId),
          ]);
          return { handled: true, status: "waiting_for_human_review" };
        }

        const retryBody =
          currentStep.retryMessage?.trim() ||
          `Necesito una respuesta mas completa para continuar. ${verification.reason}`;
        await queueMessage({
          body: retryBody,
          contactId: context.contactId,
          conversationId: context.conversationId,
          metadata: {
            flow_id: flow.id,
            flow_run_id: activeRun.id,
            flow_step_id: currentStep.id,
            validation_retry: true,
          },
          supabase,
          workspaceId: context.workspaceId,
        });
        return { handled: true, status: "answer_rejected" };
      }

      answers = {
        ...answers,
        [currentStep.fieldKey]: verification.normalizedAnswer,
      };

      await supabase.from("flow_answer_reviews").insert({
        attempt_count: Math.max(1, attemptCount),
        confidence: verification.confidence,
        contact_id: context.contactId,
        conversation_id: context.conversationId,
        field_key: currentStep.fieldKey,
        flow_id: flow.id,
        flow_run_id: activeRun.id,
        model: verification.model,
        normalized_answer: verification.normalizedAnswer,
        original_answer: originalAnswer,
        post_review_attempts: postReviewAttempts,
        question: currentStep.message ?? currentStep.name,
        status: "accepted",
        step_id: currentStep.id,
        validation_reason: verification.reason,
        workspace_id: context.workspaceId,
      });
    }

    if (currentStep?.type === "options") {
      const cleanInbound = (context.inboundText ?? "").trim().toLowerCase();
      const selected = currentStep.options?.find(
        (option) =>
          option.value.toLowerCase() === cleanInbound ||
          option.label.toLowerCase() === cleanInbound,
      );

      if (!selected) {
        await queueMessage({
          body: "Selecciona una de las opciones para continuar.",
          contactId: context.contactId,
          conversationId: context.conversationId,
          metadata: {
            flow_id: flow.id,
            flow_options: getFlowOptionMetadata(currentStep),
            flow_run_id: activeRun.id,
            flow_step_id: currentStep.id,
            validation_retry: true,
            waits_for_answer: true,
          },
          supabase,
          workspaceId: context.workspaceId,
        });
        return { handled: true, status: "option_rejected" };
      }

      nextStepId = selected?.nextStepId ?? currentStep.nextStepId ?? null;
      if (currentStep.fieldKey) {
        answers = {
          ...answers,
          [currentStep.fieldKey]: selected.value,
        };
      }
    }

    if (currentStep?.type === "question" || currentStep?.type === "options") {
      answers = completeCheckpoint(answers, flow, currentStep, steps);
      await runStepActions({
        answers,
        contact: { ...contact, metadata: { ...getRecord(contact.metadata), flow_answers: answers } },
        flow,
        run: activeRun,
        step: currentStep,
        supabase,
      });
    }

    await syncContactFlowProgress({ answers, contact, flow, supabase });
    const metadata = getRecord(contact.metadata);

    await supabase
      .from("flow_runs")
      .update({
        answers,
        status: "active",
      })
      .eq("id", activeRun.id)
      .eq("workspace_id", context.workspaceId);

    await logFlowEvent({
      contactId: context.contactId,
      conversationId: context.conversationId,
      eventType: "flow_answer_received",
      flowId: activeRun.flow_id,
      flowRunId: activeRun.id,
      payload: { answer: context.inboundText, stepId: currentStep?.id },
      supabase,
      workspaceId: context.workspaceId,
    });

    return executeRun({
      contact: { ...contact, metadata: { ...metadata, flow_answers: answers } },
      flow,
      run: { ...activeRun, answers, status: "active" },
      startStepId: nextStepId,
      supabase,
    });
  }

  const { data: suspendedRun } = await supabase
    .from("flow_runs")
    .select("status")
    .eq("workspace_id", context.workspaceId)
    .eq("contact_id", context.contactId)
    .in("status", ["review_pending", "blocked"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (suspendedRun) {
    return {
      handled: true,
      status:
        suspendedRun.status === "blocked"
          ? "contact_blocked"
          : "waiting_for_human_review",
    };
  }

  const flow = await getMatchingFlow(supabase, context, contact);

  if (!flow) {
    return { handled: false, status: "no_flow" };
  }

  const { data: run, error } = await supabase
    .from("flow_runs")
    .insert({
      contact_id: context.contactId,
      conversation_id: context.conversationId,
      current_step_id: null,
      flow_id: flow.id,
      status: "active",
      workspace_id: context.workspaceId,
    })
    .select("*")
    .single();

  if (error || !run) {
    await logFlowEvent({
      contactId: context.contactId,
      conversationId: context.conversationId,
      error: error?.message ?? "No se pudo iniciar el flujo.",
      eventType: "flow_start_error",
      flowId: flow.id,
      status: "error",
      supabase,
      workspaceId: context.workspaceId,
    });
    return { handled: false, status: "flow_start_error" };
  }

  await logFlowEvent({
    contactId: context.contactId,
    conversationId: context.conversationId,
    eventType: "flow_started",
    flowId: flow.id,
    flowRunId: run.id,
    payload: { trigger: flow.trigger_type },
    supabase,
    workspaceId: context.workspaceId,
  });

  return executeRun({
    contact,
    flow,
    run: run as FlowRunRow,
    supabase,
  });
}

export async function decideFlowAnswerReview({
  decision,
  decidedBy,
  reviewId,
  supabase,
  workspaceId,
}: {
  decision: "approve" | "reject";
  decidedBy: string;
  reviewId: string;
  supabase: AdminClient;
  workspaceId: string;
}) {
  const { data: review } = await supabase
    .from("flow_answer_reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending_human")
    .maybeSingle();

  if (!review) {
    throw new Error("La revision ya no esta pendiente.");
  }

  const [{ data: run }, { data: flow }, { data: contact }] = await Promise.all([
    supabase
      .from("flow_runs")
      .select("*")
      .eq("id", review.flow_run_id)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .from("flows")
      .select("*")
      .eq("id", review.flow_id)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .from("contacts")
      .select("*")
      .eq("id", review.contact_id)
      .eq("workspace_id", workspaceId)
      .single(),
  ]);

  if (!run || !flow || !contact) {
    throw new Error("No se encontro el contexto completo de la revision.");
  }

  const steps = parseFlowSteps(flow.steps);
  const step = steps.find((item) => item.id === review.step_id);

  if (!step || step.type !== "question" || !step.fieldKey) {
    throw new Error("La pregunta de esta revision ya no existe en el flujo.");
  }

  const decidedAt = new Date().toISOString();
  const cleanLabels = withoutLabel(
    contact.automation_labels ?? [],
    "onboarding_review_pending",
  );

  if (decision === "reject") {
    await Promise.all([
      supabase
        .from("flow_answer_reviews")
        .update({
          decided_at: decidedAt,
          decided_by: decidedBy,
          status: "rejected_by_human",
        })
        .eq("id", review.id)
        .eq("workspace_id", workspaceId),
      updateRun(supabase, run as FlowRunRow, {
        last_error: review.validation_reason,
        status: "waiting",
      }),
      supabase
        .from("contacts")
        .update({ automation_labels: cleanLabels })
        .eq("id", contact.id)
        .eq("workspace_id", workspaceId),
    ]);

    await queueMessage({
      body:
        "La respuesta anterior no permite completar el diagnostico. Te quedan dos intentos serios antes de pausar toda la atencion.\n\n" +
        (step.retryMessage || step.message || step.name),
      contactId: review.contact_id,
      conversationId: review.conversation_id!,
      metadata: {
        flow_id: flow.id,
        flow_run_id: run.id,
        flow_step_id: step.id,
        human_rejected_answer: true,
      },
      supabase,
      workspaceId,
    });

    return { status: "rejected" };
  }

  let answers = getAnswers(run.answers);
  answers = {
    ...answers,
    [step.fieldKey]: review.normalized_answer || review.original_answer,
  };
  answers = completeCheckpoint(answers, flow as FlowRow, step, steps);

  await Promise.all([
    supabase
      .from("flow_answer_reviews")
      .update({
        decided_at: decidedAt,
        decided_by: decidedBy,
        status: "approved_by_human",
      })
      .eq("id", review.id)
      .eq("workspace_id", workspaceId),
    supabase
      .from("contacts")
      .update({ automation_labels: cleanLabels })
      .eq("id", contact.id)
      .eq("workspace_id", workspaceId),
  ]);
  await runStepActions({
    answers,
    contact,
    flow: flow as FlowRow,
    run: run as FlowRunRow,
    step,
    supabase,
  });
  await syncContactFlowProgress({
    answers,
    contact,
    flow: flow as FlowRow,
    supabase,
  });
  await updateRun(supabase, run as FlowRunRow, {
    answers,
    last_error: null,
    status: "active",
  });

  return executeRun({
    contact: {
      ...contact,
      automation_labels: cleanLabels,
      metadata: {
        ...getRecord(contact.metadata),
        flow_answers: answers,
      },
    },
    flow: flow as FlowRow,
    run: { ...(run as FlowRunRow), answers, status: "active" },
    startStepId: getNextStepId(steps, step),
    supabase,
  });
}

export async function unblockFlowContact({
  contactId,
  supabase,
  workspaceId,
}: {
  contactId: string;
  supabase: AdminClient;
  workspaceId: string;
}) {
  const { data: contact } = await supabase
    .from("contacts")
    .select("automation_labels")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!contact) {
    throw new Error("Contacto no encontrado.");
  }

  const labels = withLabel(
    withoutLabel(
      withoutLabel(contact.automation_labels ?? [], "blocked_invalid_answers"),
      "onboarding_eligible",
    ),
    "onboarding_completed",
  );
  const now = new Date().toISOString();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("workspace_id", workspaceId)
    .neq("status", "closed");

  await Promise.all([
    supabase
      .from("contacts")
      .update({ automation_labels: labels, messaging_status: "active" })
      .eq("id", contactId)
      .eq("workspace_id", workspaceId),
    supabase
      .from("flow_runs")
      .update({ completed_at: now, status: "transferred" })
      .eq("contact_id", contactId)
      .eq("workspace_id", workspaceId)
      .eq("status", "blocked"),
    supabase
      .from("conversations")
      .update({ ai_enabled: false, status: "pending_handoff" })
      .eq("contact_id", contactId)
      .eq("workspace_id", workspaceId)
      .neq("status", "closed"),
  ]);

  return { conversationIds: (conversations ?? []).map((item) => item.id), status: "active" };
}

export async function resumeDueFlowRuns({
  supabase,
  workspaceId,
}: {
  supabase: AdminClient;
  workspaceId?: string | null;
}) {
  let query = supabase
    .from("flow_runs")
    .select("*, flows(*)")
    .eq("status", "waiting")
    .not("answers->>_wait_until", "is", null)
    .lte("answers->>_wait_until", new Date().toISOString())
    .limit(10);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data: runs, error } = await query;

  if (error) {
    throw error;
  }

  const results = [];

  for (const row of runs ?? []) {
    const run = row as FlowRunRow & { flows?: FlowRow };
    const flow = run.flows;
    const answers = getAnswers(run.answers);
    const nextStepId = typeof answers._next_step_id === "string" ? answers._next_step_id : null;

    if (!flow || !nextStepId) {
      results.push({ runId: run.id, status: "missing_flow_or_next_step" });
      continue;
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", run.contact_id)
      .eq("workspace_id", run.workspace_id)
      .single();

    if (!contact) {
      results.push({ runId: run.id, status: "missing_contact" });
      continue;
    }

    const waitStep = findStep(parseFlowSteps(flow.steps), run.current_step_id);
    const cleanAnswers: Record<string, Json> =
      waitStep?.type === "wait"
        ? completeCheckpoint(answers, flow, waitStep, parseFlowSteps(flow.steps))
        : { ...answers };
    delete cleanAnswers._next_step_id;
    delete cleanAnswers._wait_until;
    await syncContactFlowProgress({
      answers: cleanAnswers,
      contact,
      flow,
      supabase,
    });

    await supabase
      .from("flow_runs")
      .update({ answers: cleanAnswers, status: "active" })
      .eq("id", run.id)
      .eq("workspace_id", run.workspace_id);

    const result = await executeRun({
      contact,
      flow,
      run: { ...run, answers: cleanAnswers, status: "active" },
      startStepId: nextStepId,
      supabase,
    });

    results.push({ runId: run.id, status: result.status });
  }

  return results;
}
