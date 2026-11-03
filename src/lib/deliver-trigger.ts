import "server-only";

/**
 * Pide a `cron/deliver` que mande ya lo encolado en estas conversaciones
 * (mensajes de flujos o avisos). Sin esto esperarían al cron diario de Vercel.
 * Mismo mecanismo que usa `ycloud-webhook`.
 */
export async function triggerDeliver(
  origin: string,
  targets: Array<{ conversationId: string; workspaceId: string }>,
) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return;
  }

  const seen = new Set<string>();

  for (const { conversationId, workspaceId } of targets.slice(0, 50)) {
    if (seen.has(conversationId)) {
      continue;
    }
    seen.add(conversationId);

    const query = new URLSearchParams({ conversationId, workspaceId });
    await fetch(`${origin}/api/cron/deliver?${query.toString()}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      method: "POST",
    }).catch((error) => console.error("[deliver-trigger]", conversationId, error));
  }
}
