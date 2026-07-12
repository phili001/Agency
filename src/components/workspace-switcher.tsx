"use client";

import { Building2 } from "lucide-react";
import { useState } from "react";

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

  async function selectWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) {
      return;
    }

    setSaving(true);
    await fetch("/api/workspaces", {
      body: JSON.stringify({ action: "select", workspaceId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    window.location.href = "/";
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-xs font-medium uppercase text-[#94a39a]">
        Empresa activa
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Building2
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a39a]"
              size={15}
            />
            <select
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm normal-case text-white outline-none"
              disabled={saving}
              onChange={(event) => selectWorkspace(event.target.value)}
              value={activeWorkspaceId ?? ""}
            >
              {workspaces.map((workspace) => (
                <option className="text-[#20231f]" key={workspace.id} value={workspace.id}>
                  {workspace.name}
                  {workspace.companyCode ? ` (${workspace.companyCode})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </label>
    </div>
  );
}
