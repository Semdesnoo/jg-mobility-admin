import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root naar /admin (login pagina)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Voeg pathname toe als header zodat layout.tsx hem kan lezen
  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });
  response.headers.set("x-pathname", pathname);

  // Admin auth — sla login pagina en login API over
  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin" &&
    !pathname.startsWith("/api/admin/login")
  ) {
    const token = request.cookies.get("admin_token")?.value;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || !token || token !== adminPassword) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
