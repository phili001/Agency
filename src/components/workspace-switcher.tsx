"use client";

import { Building2 } from "lucide-react";
import { useState } from "react";
import { readApiError } from "@/components/onboarding/shared";
import { clientFetch } from "@/lib/client-fetch";

type WorkspaceOption = {
  companyCode?: string | null;
  id: string;
  name: string;
  role?: string;
  slug?: string;
};

export function WorkspaceSwitcher({
  activeWorkspaceId,
  workspaces,
}: {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceOption[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function selectWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) {
      return;
    }

    setSaving(true);
    setError("");
    const response = await clientFetch("/api/workspaces", {
      body: JSON.stringify({ action: "select", workspaceId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    // Si falla, recargar enseñaría la empresa anterior sin decir por qué.
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo cambiar de empresa."));
      setSaving(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5 text-xs font-bold tracking-[0.6px] uppercase text-muted">
        Empresa activa
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Building2
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={15}
            />
            <select
              className="h-10 w-full rounded-lg border-[1.5px] border-line bg-paper pl-9 pr-3 text-sm font-semibold normal-case tracking-normal text-ink outline-none focus:border-ink"
              disabled={saving}
              onChange={(event) => selectWorkspace(event.target.value)}
              value={activeWorkspaceId ?? ""}
            >
              {workspaces.map((workspace) => (
                <option className="text-ink" key={workspace.id} value={workspace.id}>
                  {workspace.name}
                  {workspace.companyCode ? ` (${workspace.companyCode})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </label>
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
