import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  normalizeRole,
  parseBoolean,
} from "@/lib/api";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ADMIN_ROLES);
  if (roleError) {
    return roleError;
  }

  const { searchParams } = new URL(request.url);
  const roleParam = normalizeRole(searchParams.get("role"));
  const isActiveParam = parseBoolean(searchParams.get("isActive"));

  const where = {};
  if (roleParam) {
    where.role = roleParam;
  }
  if (isActiveParam !== null) {
    where.isActive = isActiveParam;
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return buildSuccess("Users loaded.", { users });
}
