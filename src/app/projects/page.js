import ProjectListView from "@/components/projects/ProjectListView";
import { getSession } from "@/lib/session";
import { normalizeRoleId, roles } from "@/lib/roles";

export default async function ProjectsPage() {
  const session = await getSession();
  const roleId = normalizeRoleId(session?.role);
  const canManageProjects = [roles.CEO, roles.PM, roles.CTO].includes(roleId);

  return <ProjectListView canManageProjects={canManageProjects} />;
}
