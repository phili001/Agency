import { BillingCard } from "@/components/billing/billing-card";
import { WorkspaceSectionPage } from "@/components/panel/workspace-section-page";
import { getPanelContext } from "@/lib/panel-context";
import type { Metadata } from "next";
import { sectionTitles } from "@/lib/panel-data";

export const metadata: Metadata = { title: sectionTitles.business.title };

export default async function BusinessPage() {
  const { activeRole, user, workspaceId } = await getPanelContext();

  return (
    <WorkspaceSectionPage
      before={workspaceId ? <BillingCard email={user.email ?? null} role={activeRole} workspaceId={workspaceId} /> : null}
      tab="business"
    />
  );
}
