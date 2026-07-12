import { notFound, redirect } from "next/navigation";

import { AdminConsole } from "@/components/admin-console";
import { getBootstrapSuperadminEmails, isPlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await isPlatformAdmin(user))) {
    notFound();
  }

  const admin = createAdminClient();
  const [
    { data: workspaces },
    { data: members },
    { data: integrations },
  ] = await Promise.all([
    admin
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false }),
    admin.from("workspace_members").select("workspace_id, user_id, role"),
    admin.from("integrations").select("workspace_id, provider, status"),
  ]);
  const { data: authUsers } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const ownerIds = [...new Set((workspaces ?? []).map((workspace) => workspace.owner_id))];
  const ownerProfiles = await Promise.all(
    ownerIds.map(async (ownerId) => {
      const { data } = await admin.auth.admin.getUserById(ownerId);
      return [ownerId, data.user?.email ?? ""] as const;
    }),
  );
  const ownerEmailById = new Map(ownerProfiles);
  const companies =
    workspaces?.map((workspace) => {
      const workspaceMembers = (members ?? []).filter(
        (member) => member.workspace_id === workspace.id,
      );
      const activeProviders = (integrations ?? [])
        .filter(
          (integration) =>
            integration.workspace_id === workspace.id && integration.status === "active",
        )
        .map((integration) => integration.provider);

      return {
        activeProviders,
        companyCode:
          "company_code" in workspace && typeof workspace.company_code === "string"
            ? workspace.company_code
            : null,
        id: workspace.id,
        memberCount: workspaceMembers.length,
        name: workspace.name,
        ownerEmail: ownerEmailById.get(workspace.owner_id) ?? "",
        slug: workspace.slug,
        status: workspace.status,
        onboardingCompletedAt:
          "onboarding_completed_at" in workspace
            ? workspace.onboarding_completed_at
            : null,
      };
    }) ?? [];
  const bootstrapSuperadmins = getBootstrapSuperadminEmails();
  const superadmins = [
    ...new Set([
      ...bootstrapSuperadmins,
      ...((authUsers?.users ?? [])
        .filter((authUser) => authUser.app_metadata?.platform_admin === true)
        .map((authUser) => authUser.email ?? "")
        .filter(Boolean) as string[]),
    ]),
  ];

  return (
    <AdminConsole
      bootstrapSuperadmins={bootstrapSuperadmins}
      companies={companies}
      superadmins={superadmins}
    />
  );
}
