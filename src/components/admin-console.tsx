"use client";

import {
  Building2,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Company = {
  activeProviders: string[];
  companyCode: string | null;
  id: string;
  memberCount: number;
  name: string;
  onboardingCompletedAt: string | null;
  ownerEmail: string;
  slug: string;
  status: string;
};

export function AdminConsole({
  bootstrapSuperadmins,
  companies,
  superadmins,
}: {
  bootstrapSuperadmins: string[];
  companies: Company[];
  superadmins: string[];
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [linkWorkspaceId, setLinkWorkspaceId] = useState(companies[0]?.id ?? "");
  const [linkOwnerEmail, setLinkOwnerEmail] = useState("");
  const [linkOwnerPassword, setLinkOwnerPassword] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState("");

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudo completar la acción.");
    }
  }

  async function deleteJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudo completar la acción.");
    }
  }

  async function createCompany() {
    setSaving("company");
    setStatus("");

    try {
      await postJson("/api/admin/companies", {
        companyName,
        ownerEmail,
        temporaryPassword,
      });
      setStatus("Empresa creada. El owner ya puede entrar y completar onboarding.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setSaving("");
    }
  }

  async function linkOwner() {
    setSaving("link");
    setStatus("");

    try {
      await postJson("/api/admin/companies/link-owner", {
        ownerEmail: linkOwnerEmail,
        temporaryPassword: linkOwnerPassword,
        workspaceId: linkWorkspaceId,
      });
      setStatus(
        "Owner vinculado a la empresa existente. Si el usuario no existia, ya puede entrar con la contraseña temporal.",
      );
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setSaving("");
    }
  }

  async function addSuperadmin() {
    setSaving("superadmin");
    setStatus("");

    try {
      await postJson("/api/admin/superadmins", {
        email: newAdminEmail,
        temporaryPassword: newAdminPassword,
      });
      setStatus(
        "Superadmin agregado. Si el usuario no existia, ya puede entrar con la contraseña temporal.",
      );
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setSaving("");
    }
  }

  async function removeSuperadmin(email: string) {
    setSaving(`remove:${email}`);
    setStatus("");

    try {
      await deleteJson("/api/admin/superadmins", { email });
      setStatus("Superadmin removido.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setSaving("");
    }
  }

  async function openCompany(workspaceId: string) {
    setSaving(`open:${workspaceId}`);
    await postJson("/api/workspaces", { action: "select", workspaceId });
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f3] p-5 text-[#20231f]">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="rounded-lg border border-[#d9ded3] bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#647067]">
                Consola privada
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Superadmin</h1>
              <p className="mt-1 text-sm text-[#647067]">
                Crea empresas, asigna owners y revisa el onboarding de clientes.
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium"
              href="/"
            >
              Volver al panel
            </Link>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Plus size={17} />
              Crear empresa
            </h2>
            <div className="mt-4 grid gap-3">
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Nombre de empresa"
                value={companyName}
              />
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="correo@empresa.com"
                type="email"
                value={ownerEmail}
              />
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder="Contraseña temporal"
                type="password"
                value={temporaryPassword}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                disabled={saving === "company"}
                onClick={createCompany}
                type="button"
              >
                {saving === "company" ? <Loader2 className="animate-spin" size={16} /> : <Building2 size={16} />}
                Crear
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <UserPlus size={17} />
              Vincular owner
            </h2>
            <div className="mt-4 grid gap-3">
              <select
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setLinkWorkspaceId(event.target.value)}
                value={linkWorkspaceId}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setLinkOwnerEmail(event.target.value)}
                placeholder="owner@empresa.com"
                type="email"
                value={linkOwnerEmail}
              />
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setLinkOwnerPassword(event.target.value)}
                placeholder="Contraseña temporal si no existe"
                type="password"
                value={linkOwnerPassword}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                disabled={saving === "link" || !linkWorkspaceId}
                onClick={linkOwner}
                type="button"
              >
                {saving === "link" ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                Vincular
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck size={17} />
              Superadmins
            </h2>
            <div className="mt-4 grid gap-2">
              {superadmins.map((email) => (
                <span
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#eef2eb] px-3 py-2 text-sm"
                  key={email}
                >
                  <span className="min-w-0 truncate">{email}</span>
                  <button
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[#4d5a51] hover:bg-white disabled:opacity-40"
                    disabled={
                      bootstrapSuperadmins.includes(email) ||
                      saving === `remove:${email}`
                    }
                    onClick={() => removeSuperadmin(email)}
                    title="Quitar superadmin"
                    type="button"
                  >
                    {saving === `remove:${email}` ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </span>
              ))}
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setNewAdminEmail(event.target.value)}
                placeholder="nuevo@admin.com"
                type="email"
                value={newAdminEmail}
              />
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => setNewAdminPassword(event.target.value)}
                placeholder="Contraseña temporal si no existe"
                type="password"
                value={newAdminPassword}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                disabled={saving === "superadmin"}
                onClick={addSuperadmin}
                type="button"
              >
                Agregar superadmin
              </button>
            </div>
          </div>
        </section>

        {status ? (
          <p className="rounded-lg bg-[#eef2eb] px-3 py-2 text-sm text-[#4d5a51]">
            {status}
          </p>
        ) : null}

        <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Empresas</h2>
            <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
              {companies.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {companies.map((company) => (
              <div
                className="grid gap-3 rounded-lg border border-[#e2e6df] p-3 md:grid-cols-[1fr_auto]"
                key={company.id}
              >
                <div className="min-w-0">
                  <p className="font-semibold">{company.name}</p>
                  <p className="mt-1 text-sm text-[#647067]">
                    {company.ownerEmail || "Sin owner visible"} - {company.companyCode ?? company.slug}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs">
                      {company.onboardingCompletedAt ? "Onboarding completo" : "Pendiente"}
                    </span>
                    <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs">
                      {company.memberCount} miembros
                    </span>
                    {["openai", "ycloud"].map((provider) => (
                      <span
                        className={`rounded-lg px-2 py-1 text-xs ${
                          company.activeProviders.includes(provider)
                            ? "bg-[#e7f6ce] text-[#31521d]"
                            : "bg-[#eef2eb] text-[#647067]"
                        }`}
                        key={provider}
                      >
                        {provider}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium"
                  disabled={saving === `open:${company.id}`}
                  onClick={() => openCompany(company.id)}
                  type="button"
                >
                  {saving === `open:${company.id}` ? <Loader2 className="animate-spin" size={16} /> : null}
                  Abrir empresa
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
