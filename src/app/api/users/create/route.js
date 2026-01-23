import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ALL_ROLES,
  USER_CREATION_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  normalizeRole,
} from "@/lib/api";

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, USER_CREATION_ROLES);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const role = normalizeRole(body?.role);

  if (!name || !email || !password || !role) {
    return buildError("Name, email, password, and role are required.", 400);
  }

  if (!ALL_ROLES.includes(role)) {
    return buildError("Role is invalid.", 400);
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return buildError("A user with this email already exists.", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
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
