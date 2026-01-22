import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  ALL_ROLES,
  buildError,
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

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ADMIN_ROLES);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const role = normalizeRole(body?.role);
  const isActive = body?.isActive ?? true;

  if (!name || !email || !password || !role) {
    return buildError("Name, email, password, and role are required.", 400);
  }

  if (!ALL_ROLES.includes(role)) {
    return buildError("Role is invalid.", 400);
  }

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
        role,
        isActive: Boolean(isActive),
      },
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

    return buildSuccess("User created.", { user }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return buildError("A user with this email already exists.", 409);
      }
    }

    return buildError("Unable to create user.", 500);
  }
}
