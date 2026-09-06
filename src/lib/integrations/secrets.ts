import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";

import { decryptSecret, encryptSecret } from "./crypto";

export type IntegrationProvider = "gohighlevel" | "openai" | "ycloud";

type SecretRow = {
  ciphertext: string;
};

export function maskSecret(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.length <= 8
    ? `${value.slice(0, 2)}...`
    : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Compara hashes en tiempo constante. Con `!==` el tiempo de respuesta depende
 * de cuantos caracteres coinciden, que es justo lo que explota un ataque de
 * temporizacion para adivinar el secreto byte a byte.
 */
export function secretMatchesHash(value: string, expectedHash: string) {
  const received = Buffer.from(hashSecret(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function generateWebhookSecret() {
  return randomBytes(24).toString("base64url");
}

export async function saveIntegrationSecret({
  kind,
  provider,
  value,
  workspaceId,
}: {
  kind: string;
  provider: IntegrationProvider;
  value: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("integration_secrets")
    .upsert(
      {
        ciphertext: encryptSecret(value),
        kind,
        provider,
        workspace_id: workspaceId,
      },
      { onConflict: "workspace_id,provider,kind" },
    );

  if (error) {
    throw error;
  }
}

export async function getIntegrationSecret({
  kind,
  provider,
  workspaceId,
}: {
  kind: string;
  provider: IntegrationProvider;
  workspaceId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_secrets")
    .select("ciphertext")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("kind", kind)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? decryptSecret((data as SecretRow).ciphertext) : null;
}
