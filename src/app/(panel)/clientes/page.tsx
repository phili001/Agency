import { PanelPage } from "@/components/panel/panel-header";
import { getPanelContext } from "@/lib/panel-context";

export default async function ClientsPage() {
  const { supabase, workspace, workspaceId } = await getPanelContext();
  const { data } = workspaceId
    ? await supabase
        .from("contacts")
        .select("id, full_name, phone_e164, email")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const contacts = data ?? [];

  return (
    <PanelPage hasWorkspace={Boolean(workspace)} section="clients">
      <section
        className="scroll-mt-5 rounded-lg border border-[#d9ded3] bg-white p-4"
        id="clients"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Clientes</h2>
            <p className="mt-1 text-sm text-[#647067]">
              Contactos guardados para esta empresa.
            </p>
          </div>
          <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
            {contacts.length}
          </span>
        </div>
        <div className="mt-4 grid gap-2">
          {contacts.map((contact) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e6df] p-3 text-sm"
              key={contact.id}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {contact.full_name ?? "Sin nombre"}
                </p>
                <p className="mt-1 text-xs text-[#647067]">
                  {contact.phone_e164}
                </p>
              </div>
              <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                {contact.email ?? "WhatsApp"}
              </span>
            </div>
          ))}
          {contacts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
              Aun no hay contactos. Cuando entren mensajes por YCloud van
              a aparecer aquí.
            </p>
          ) : null}
        </div>
      </section>
    </PanelPage>
  );
}
