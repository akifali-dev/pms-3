import ProjectDetailView from "@/components/projects/ProjectDetailView";
import { getSession } from "@/lib/session";
import { canCreateMilestones, normalizeRoleId } from "@/lib/roles";

export default async function ProjectDetailPage({ params }) {
  const { projectId } = await params;
  const session = await getSession();
  const roleId = normalizeRoleId(session?.role);
  const canManageMilestones = canCreateMilestones(roleId);

  return (
    <ProjectDetailView
      projectId={projectId}
      canManageMilestones={canManageMilestones}
    />
  );
}
