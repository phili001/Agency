import {
  Activity,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Headphones,
  MessageSquareText,
  Mic,
  PlugZap,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";

const conversations = [
  {
    name: "Sofia Ramirez",
    business: "Clinica Dental Norte",
    status: "IA activa",
    summary: "Quiere limpieza dental y envio un audio con disponibilidad.",
    time: "09:42",
  },
  {
    name: "Carlos Medina",
    business: "Inmobiliaria Delta",
    status: "Handoff",
    summary: "Pide hablar con asesor por credito hipotecario.",
    time: "09:31",
  },
  {
    name: "Laura Prieto",
    business: "Academia FitPro",
    status: "Agendada",
    summary: "Cita guardada en GHL para clase de prueba.",
    time: "09:18",
  },
];

const metrics = [
  { label: "Workspaces", value: "3", detail: "clientes activos", icon: UsersRound },
  { label: "Conversaciones", value: "128", detail: "ultimos 7 dias", icon: MessageSquareText },
  { label: "Citas", value: "24", detail: "creadas en GHL", icon: CalendarCheck },
  { label: "Costo IA", value: "$18.40", detail: "OpenRouter estimado", icon: WalletCards },
];

const modules = [
  { name: "Inbox WhatsApp Web", state: "Mock listo", icon: MessageSquareText },
  { name: "IA + humano con handoff", state: "Flujo disenado", icon: Headphones },
  { name: "Buffer inteligente", state: "Pendiente", icon: Clock3 },
  { name: "Audios transcritos", state: "Pendiente", icon: Mic },
  { name: "Supabase multi-tenant", state: "Siguiente paso", icon: Database },
  { name: "YCloud oficial", state: "Pendiente", icon: PlugZap },
];

const roadmap = [
  "Base Next.js + Tailwind creada",
  "Dashboard operativo inicial",
  "Modelo de datos multi-tenant",
  "Auth y workspaces en Supabase",
  "Webhook entrante de YCloud",
  "Agente IA con OpenRouter",
  "Agenda y leads en GoHighLevel",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f3] text-[#20231f]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#d9ded3] bg-[#10231c] p-5 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#d2f36b] text-[#10231c]">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold">WhatsApp SaaS</p>
              <p className="text-xs text-[#b7c4bd]">Imperio Agentico</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-1 text-sm">
            {[
              ["Inbox", MessageSquareText],
              ["Agentes", Bot],
              ["Clientes", UsersRound],
              ["Integraciones", PlugZap],
              ["Observabilidad", Activity],
            ].map(([label, Icon]) => (
              <button
                className="flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[#dbe5df] transition hover:bg-white/10"
                key={label as string}
                type="button"
              >
                <Icon size={17} />
                <span>{label as string}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs font-medium uppercase text-[#94a39a]">
              Workspace activo
            </p>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold">Clinica Dental Norte</p>
              <p className="mt-1 text-xs text-[#b7c4bd]">+57 300 000 0000</p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-[#d9ded3] bg-white px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#647067]">
                  Paso 1 del curso
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                  Dashboard de agentes de WhatsApp
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium">
                  <GitBranch size={16} />
                  Git listo
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white">
                  <ShieldCheck size={16} />
                  Conectar Supabase
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
            <div className="grid gap-5">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((item) => (
                  <div
                    className="rounded-lg border border-[#d9ded3] bg-white p-4"
                    key={item.label}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#647067]">{item.label}</p>
                      <item.icon className="text-[#35735b]" size={18} />
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-xs text-[#7a847c]">{item.detail}</p>
                  </div>
                ))}
              </section>

              <section className="rounded-lg border border-[#d9ded3] bg-white">
                <div className="flex items-center justify-between border-b border-[#e2e6df] px-4 py-3">
                  <div>
                    <h2 className="text-base font-semibold">Inbox vivo</h2>
                    <p className="text-sm text-[#647067]">
                      Vista inicial para probar IA, humano y agenda.
                    </p>
                  </div>
                  <span className="rounded-lg bg-[#e7f6ce] px-2.5 py-1 text-xs font-semibold text-[#31521d]">
                    Mock
                  </span>
                </div>
                <div className="divide-y divide-[#edf0ea]">
                  {conversations.map((conversation) => (
                    <article
                      className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center"
                      key={conversation.name}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{conversation.name}</h3>
                          <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                            {conversation.business}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#5d685f]">
                          {conversation.summary}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 md:justify-end">
                        <span className="rounded-lg border border-[#d9ded3] px-2.5 py-1 text-xs">
                          {conversation.status}
                        </span>
                        <span className="w-12 text-right text-xs text-[#7a847c]">
                          {conversation.time}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
                <div className="flex items-center gap-2">
                  <Bot className="text-[#35735b]" size={19} />
                  <h2 className="text-base font-semibold">Agente configurado</h2>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {["Setter", "Agendamiento", "Servicio al cliente"].map(
                    (agent) => (
                      <div
                        className="rounded-lg border border-[#e2e6df] p-3"
                        key={agent}
                      >
                        <p className="text-sm font-semibold">{agent}</p>
                        <p className="mt-1 text-xs text-[#647067]">
                          Prompt, herramientas y limites por workspace.
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </section>
            </div>

            <aside className="grid content-start gap-5">
              <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
                <h2 className="text-base font-semibold">Modulos del sistema</h2>
                <div className="mt-4 grid gap-3">
                  {modules.map((module) => (
                    <div
                      className="flex items-center justify-between gap-3"
                      key={module.name}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef2eb] text-[#35735b]">
                          <module.icon size={17} />
                        </div>
                        <p className="truncate text-sm font-medium">
                          {module.name}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-[#f3f4ef] px-2 py-1 text-xs text-[#647067]">
                        {module.state}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
                <h2 className="text-base font-semibold">Ruta paso a paso</h2>
                <ol className="mt-4 grid gap-3">
                  {roadmap.map((step, index) => (
                    <li className="flex gap-3 text-sm" key={step}>
                      <CheckCircle2
                        className={index < 2 ? "text-[#35735b]" : "text-[#a8b0aa]"}
                        size={18}
                      />
                      <span className={index < 2 ? "font-medium" : "text-[#647067]"}>
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
