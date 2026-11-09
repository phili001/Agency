"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

import type { ContactCard } from "./types";

type Summary = Pick<ContactCard, "appointments" | "stage" | "tags">;

/** Próxima cita no cancelada que todavía no ha empezado. */
export function nextAppointment(appointments: ContactCard["appointments"], now = Date.now()) {
  return (
    appointments
      .filter((item) => item.status === "scheduled" && new Date(item.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null
  );
}

/** Etapa, etiquetas y próxima cita del contacto, para el lateral de Chats. */
export function ContactCrmSummary({ contactId }: { contactId: string }) {
  const [state, setState] = useState<{ contactId: string; summary: Summary | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/contacts/${contactId}`)
      .then(async (response) => (response.ok ? ((await response.json()) as ContactCard) : null))
      .catch(() => null)
      .then((card) => {
        if (!cancelled) setState({ contactId, summary: card });
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const summary = state?.contactId === contactId ? state.summary : null;
  if (!summary) return null;

  const upcoming = nextAppointment(summary.appointments);

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-line p-2 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-1.5">
        {summary.stage ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-paper-2 px-2 py-1 font-medium text-ink">
            <span className="size-2 rounded-full" style={{ backgroundColor: summary.stage.color }} />
            {summary.stage.name}
          </span>
        ) : null}
        {summary.tags.map((tag) => (
          <span className="rounded-lg border px-2 py-1" key={tag.id} style={{ borderColor: tag.color, color: tag.color }}>
            {tag.name}
          </span>
        ))}
      </div>
      <p className="flex items-center gap-1.5">
        <CalendarDays size={14} />
        {upcoming
          ? `${upcoming.service || "Cita"} · ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(upcoming.starts_at))}`
          : "Sin citas próximas"}
      </p>
      <Link className="font-medium text-ink underline" href="/clientes">
        Ver en Clientes
      </Link>
    </div>
  );
}
