import { NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/projects",
  "/milestones",
  "/tasks",
  "/reports",
];

const authRoutes = ["/auth", "/auth/sign-in"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthenticated =
    request.cookies.has("pms-session") ||
    process.env.NODE_ENV === "development";

  if (isProtected && !isAuthenticated) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
