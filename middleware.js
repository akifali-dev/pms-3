import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getDefaultRouteForRole, roleHasRouteAccess } from "@/lib/roles";

const protectedRoutes = [
  "/dashboard",
  "/projects",
  "/milestones",
  "/tasks",
  "/activity",
  "/reports",
];

const authRoutes = ["/auth", "/auth/sign-in"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);

  if (!session) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    signInUrl.searchParams.set("denied", "1");
    signInUrl.searchParams.set("reason", "Please sign in to continue.");
    return NextResponse.redirect(signInUrl);
  }

  if (!roleHasRouteAccess(session.role, pathname)) {
    const fallbackUrl = request.nextUrl.clone();
    fallbackUrl.pathname = getDefaultRouteForRole(session.role);
    fallbackUrl.searchParams.set("denied", "1");
    fallbackUrl.searchParams.set(
      "reason",
      "You do not have access to that area."
    );
    return NextResponse.redirect(fallbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
