import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // No longer redirecting authenticated users from home page
  // as the home page now serves as the dashboard

  // Protected paths that require authentication
  const protectedPaths = [
    "/dashboard",
    "/profile",
    "/api/protected",
    "/upload",
    "/project",
  ];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect unauthenticated users to sign in page
  if (isProtected && !token) {
    const signInUrl = new URL("/auth/signin", request.url);
    // Add the original URL as a callback parameter
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/profile/:path*",
    "/api/protected/:path*",
    "/upload/:path*",
    "/project/:path*",
  ],
};
