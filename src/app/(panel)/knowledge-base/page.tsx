import { WorkspaceSectionPage } from "@/components/panel/workspace-section-page";
import type { Metadata } from "next";
import { sectionTitles } from "@/lib/panel-data";

export const metadata: Metadata = { title: sectionTitles.knowledge.title };

export default function KnowledgeBasePage() {
  return <WorkspaceSectionPage tab="knowledge" />;
}
