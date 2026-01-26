import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const ADMIN_ROLES = ["CEO", "PM", "CTO", "SENIOR_DEVELOPER"];
export const PROJECT_MANAGEMENT_ROLES = ["CEO", "PM", "CTO"];
export const USER_CREATION_ROLES = ["CEO", "PM", "CTO"];
export const ALL_ROLES = [...ADMIN_ROLES, "DEVELOPER"];

export function normalizeRole(role) {
  if (!role) {
    return null;
  }

  const cleaned = role
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();

  if (cleaned === "SENIOR_DEV") {
    return "SENIOR_DEVELOPER";
  }

  if (cleaned === "DEV") {
    return "DEVELOPER";
  }

  return cleaned;
}

export async function getAuthContext() {
  const session = await getSession();

  if (!session) {
    return { session: null, user: null, role: null };
  }

  const role = normalizeRole(session.role);
  const user = session.email
    ? await prisma.user.findUnique({ where: { email: session.email } })
    : null;

  return { session, user, role };
}

export function buildError(message, status = 400, details = null) {
  return NextResponse.json(
    {
      ok: false,
      message,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export function buildSuccess(message, data = {}, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      message,
      ...data,
    },
    { status }
  );
}

export function ensureAuthenticated(context) {
  if (!context.session) {
    return buildError("Authentication required.", 401);
  }

  if (!context.user) {
    return buildError("User account not found.", 401);
  }

  if (!context.user.isActive) {
    return buildError("User account is inactive.", 403);
  }

  return null;
}

export function ensureRole(role, allowedRoles) {
  if (!role || !allowedRoles.includes(role)) {
    return buildError("You do not have permission to perform this action.", 403);
  }

  return null;
}

export function parseBoolean(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return null;
}

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}
