import type { Json } from "@/lib/supabase/database.types";

export type DefaultConversationMode = "ai" | "handoff";

export function getDefaultConversationMode(
  onboardingState: Json | null | undefined,
): DefaultConversationMode {
  if (
    onboardingState &&
    typeof onboardingState === "object" &&
    !Array.isArray(onboardingState) &&
    onboardingState.default_conversation_mode === "handoff"
  ) {
    return "handoff";
  }

  return "ai";
}

export function withDefaultConversationMode(
  onboardingState: Json | null | undefined,
  mode: DefaultConversationMode,
): Json {
  const current =
    onboardingState && typeof onboardingState === "object" && !Array.isArray(onboardingState)
      ? onboardingState
      : {};

  return {
    ...current,
    default_conversation_mode: mode,
  };
}
