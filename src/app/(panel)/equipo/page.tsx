import { WorkspaceSectionPage } from "@/components/panel/workspace-section-page";
import type { Metadata } from "next";
import { sectionTitles } from "@/lib/panel-data";

export const metadata: Metadata = { title: sectionTitles.team.title };

export default function TeamPage() {
  return <WorkspaceSectionPage tab="team" />;
}
