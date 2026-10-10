"use client";

import {
  Activity,
  BookOpenText,
  Bot,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  GitBranch,
  type LucideIcon,
  MessageSquareText,
  PlugZap,
  Shield,
  UsersRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const sidebarItems = [
  { href: "/", icon: MessageSquareText, label: "Inbox" },
  { href: "/agentes", icon: Bot, label: "Agentes" },
  { href: "/clientes", icon: UsersRound, label: "Clientes" },
  { href: "/integraciones", icon: PlugZap, label: "Integraciones" },
  { href: "/negocio", icon: BriefcaseBusiness, label: "Negocio" },
  { href: "/tools", icon: Wrench, label: "Tools" },
  { href: "/flujos", icon: GitBranch, label: "Flujos" },
  { href: "/templates", icon: ClipboardList, label: "Templates" },
  { href: "/knowledge-base", icon: BookOpenText, label: "Knowledge Base" },
  { href: "/equipo", icon: UsersRound, label: "Equipo" },
  { href: "/automatizaciones", icon: Check, label: "Automatizaciones" },
  { href: "/observabilidad", icon: Activity, label: "Observabilidad" },
];

/**
 * Enlace que precarga la pagina completa solo cuando hay intencion (raton
 * encima, foco o dedo). Con `prefetch` en todos, cada carga del panel
 * renderizaba en el servidor las 12 secciones con todas sus consultas.
 */
function IntentLink({
  className,
  current,
  href,
  icon: Icon,
  label,
}: {
  className: string;
  current?: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  const [intent, setIntent] = useState(false);
  const showIntent = () => setIntent(true);

  return (
    <Link
      aria-current={current ? "page" : undefined}
      className={className}
      href={href}
      onFocus={showIntent}
      onMouseEnter={showIntent}
      onTouchStart={showIntent}
      prefetch={intent}
    >
      <Icon size={17} />
      <span>{label}</span>
    </Link>
  );
}

export function SidebarNav({ platformAdmin }: { platformAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="mt-5 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-8 lg:grid lg:overflow-visible lg:pb-0"
    >
      {platformAdmin ? (
        <IntentLink
          className="flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-[#dbe5df] transition hover:bg-white/10"
          href="/admin"
          icon={Shield}
          label="Superadmin"
        />
      ) : null}
      {sidebarItems.map((item) => {
        const current = item.href === pathname;

        return (
          <IntentLink
            className={`flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-left transition ${
              current ? "bg-white/10 text-white" : "text-[#dbe5df] hover:bg-white/10"
            }`}
            current={current}
            href={item.href}
            icon={item.icon}
            key={item.label}
            label={item.label}
          />
        );
      })}
    </nav>
  );
}
