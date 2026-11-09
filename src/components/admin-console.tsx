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
import { clientFetch } from "@/lib/client-fetch";

type Company = {
  activeProviders: string[];
  billing: { exempt: boolean; status: string | null; stripeCustomerId: string | null };
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
  const [customerDrafts, setCustomerDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await clientFetch(url, {
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
    const response = await clientFetch(url, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudo completar la acción.");
    }
  }

  async function updateBilling(workspaceId: string, change: { billingExempt?: boolean; stripeCustomerId?: string | null }) {
    setSaving(`billing:${workspaceId}`);
    setStatus("");
    try {
      const response = await clientFetch("/api/admin/companies/billing", {
        body: JSON.stringify({ workspaceId, ...change }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar la facturación.");
      setStatus("Facturación actualizada.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar la facturación.");
    } finally {
      setSaving("");
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
        "Owner vinculado a la empresa existente. Si el usuario no existía, ya puede entrar con la contraseña temporal.",
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
        "Superadmin agregado. Si el usuario no existía, ya puede entrar con la contraseña temporal.",
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

  async function deleteCompany(company: Company) {
    const confirmName = window.prompt(
      `Esto borra "${company.name}" con todos sus datos (contactos, agentes, conversaciones, integraciones) y no se puede deshacer.\n\nEscribe el nombre exacto de la empresa para confirmar:`,
    );

    if (confirmName === null) {
      return;
    }

    setSaving(`delete:${company.id}`);
    setStatus("");

    try {
      await deleteJson("/api/admin/companies", {
        confirmName,
        workspaceId: company.id,
      });
      setStatus(`Empresa "${company.name}" eliminada.`);
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setSaving("");
    }
  }

  return (
    <main className="min-h-screen bg-paper-2 p-5 text-ink">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="rounded-lg border border-line bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">
                Consola privada
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Superadmin</h1>
              <p className="mt-1 text-sm text-muted">
                Crea empresas, asigna owners y revisa el onboarding de clientes.
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-3 text-sm font-medium"
              href="/"
            >
              Volver al panel
            </Link>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Plus size={17} />
              Crear empresa
            </h2>
            <div className="mt-4 grid gap-3">
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Nombre de empresa"
                value={companyName}
              />
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="correo@empresa.com"
                type="email"
                value={ownerEmail}
              />
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder="Contraseña temporal"
                type="password"
                value={temporaryPassword}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-3 text-sm font-bold text-ink disabled:opacity-50"
                disabled={saving === "company"}
                onClick={createCompany}
                type="button"
              >
                {saving === "company" ? <Loader2 className="animate-spin" size={16} /> : <Building2 size={16} />}
                Crear
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <UserPlus size={17} />
              Vincular owner
            </h2>
            <div className="mt-4 grid gap-3">
              <select
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
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
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
                onChange={(event) => setLinkOwnerEmail(event.target.value)}
                placeholder="owner@empresa.com"
                type="email"
                value={linkOwnerEmail}
              />
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
                onChange={(event) => setLinkOwnerPassword(event.target.value)}
                placeholder="Contraseña temporal si no existe"
                type="password"
                value={linkOwnerPassword}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-3 text-sm font-bold text-ink disabled:opacity-50"
                disabled={saving === "link" || !linkWorkspaceId}
                onClick={linkOwner}
                type="button"
              >
                {saving === "link" ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                Vincular
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck size={17} />
              Superadmins
            </h2>
            <div className="mt-4 grid gap-2">
              {superadmins.map((email) => (
                <span
                  className="flex items-center justify-between gap-2 rounded-lg bg-paper-2 px-3 py-2 text-sm"
                  key={email}
                >
                  <span className="min-w-0 truncate">{email}</span>
                  <button
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-white disabled:opacity-40"
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
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
                onChange={(event) => setNewAdminEmail(event.target.value)}
                placeholder="nuevo@admin.com"
                type="email"
                value={newAdminEmail}
              />
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm outline-none"
                onChange={(event) => setNewAdminPassword(event.target.value)}
                placeholder="Contraseña temporal si no existe"
                type="password"
                value={newAdminPassword}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-3 text-sm font-bold text-ink disabled:opacity-50"
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
          <p className="rounded-lg bg-paper-2 px-3 py-2 text-sm text-ink-2">
            {status}
          </p>
        ) : null}

        <section className="rounded-lg border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Empresas</h2>
            <span className="rounded-lg bg-paper-2 px-2 py-1 text-xs text-ink-2">
              {companies.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {companies.map((company) => (
              <div
                className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-[1fr_auto]"
                key={company.id}
              >
                <div className="min-w-0">
                  <p className="font-semibold">{company.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {company.ownerEmail || "Sin owner visible"} - {company.companyCode ?? company.slug}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-paper-2 px-2 py-1 text-xs">
                      {company.onboardingCompletedAt ? "Onboarding completo" : "Pendiente"}
                    </span>
                    <span className="rounded-lg bg-paper-2 px-2 py-1 text-xs">
                      {company.memberCount} miembros
                    </span>
                    <span
                      className={`rounded-lg px-2 py-1 text-xs ${
                        company.billing.exempt || company.billing.status === "active" || company.billing.status === "trialing"
                          ? "bg-yellow-soft text-ink"
                          : "bg-[#fbeeea] text-[#7a2a1d]"
                      }`}
                    >
                      {company.billing.exempt ? "Exenta" : `Stripe: ${company.billing.status ?? "sin suscripción"}`}
                    </span>
                    {["openai", "ycloud"].map((provider) => (
                      <span
                        className={`rounded-lg px-2 py-1 text-xs ${
                          company.activeProviders.includes(provider)
                            ? "bg-yellow-soft text-ink"
                            : "bg-paper-2 text-muted"
                        }`}
                        key={provider}
                      >
                        {provider}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        checked={company.billing.exempt}
                        disabled={saving === `billing:${company.id}`}
                        onChange={(event) => updateBilling(company.id, { billingExempt: event.target.checked })}
                        type="checkbox"
                      />
                      Exenta de pago
                    </label>
                    <input
                      className="h-9 w-56 rounded-lg border border-line px-2 text-sm"
                      onChange={(event) => setCustomerDrafts((current) => ({ ...current, [company.id]: event.target.value }))}
                      placeholder="cus_… (cliente de Stripe)"
                      value={customerDrafts[company.id] ?? company.billing.stripeCustomerId ?? ""}
                    />
                    <button
                      className="h-9 rounded-lg border border-line px-3 text-sm font-medium disabled:opacity-60"
                      disabled={saving === `billing:${company.id}` || customerDrafts[company.id] === undefined}
                      onClick={() => updateBilling(company.id, { stripeCustomerId: (customerDrafts[company.id] ?? "").trim() || null })}
                      type="button"
                    >
                      Enlazar cliente
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:items-stretch">
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-medium"
                    disabled={saving === `open:${company.id}`}
                    onClick={() => openCompany(company.id)}
                    type="button"
                  >
                    {saving === `open:${company.id}` ? <Loader2 className="animate-spin" size={16} /> : null}
                    Abrir empresa
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e7c3bb] px-3 text-sm font-medium text-[#7a2a1d] hover:bg-[#fbeeea] disabled:opacity-50"
                    disabled={saving === `delete:${company.id}`}
                    onClick={() => deleteCompany(company)}
                    type="button"
                  >
                    {saving === `delete:${company.id}` ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
