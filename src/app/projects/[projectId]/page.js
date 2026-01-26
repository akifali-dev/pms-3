import ProjectDetailView from "@/components/projects/ProjectDetailView";
import { getSession } from "@/lib/session";
import { normalizeRoleId, roles } from "@/lib/roles";

export default async function ProjectDetailPage({ params }) {
  const { projectId } = await params;
  console.log("projectId",projectId)
  const session = await getSession();
  const roleId = normalizeRoleId(session?.role);
  const canManageMilestones = [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV].includes(
    roleId
  );

  return (
    <ProjectDetailView
      projectId={projectId}
      canManageMilestones={canManageMilestones}
    />
  );
}
