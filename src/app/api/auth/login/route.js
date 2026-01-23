import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeRoleId } from "@/lib/roles";
import { buildSessionCookie, createSessionToken } from "@/lib/session";

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: "User account is inactive." },
      { status: 403 }
    );
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const roleId = normalizeRoleId(user.role) ?? user.role;
  const token = await createSessionToken({
    email: user.email,
    name: user.name,
    role: roleId,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      email: user.email,
      name: user.name,
      role: roleId,
    },
  });

  response.cookies.set(buildSessionCookie(token));
  return response;
}
