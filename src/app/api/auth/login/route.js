import { NextResponse } from "next/server";
import { findUserByCredentials } from "@/lib/users";
import { buildSessionCookie, createSessionToken } from "@/lib/session";

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const user = findUserByCredentials({ email, password });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });

  response.cookies.set(buildSessionCookie(token));
  return response;
}
