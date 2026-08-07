import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root naar /admin (login pagina)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Voeg pathname toe als header zodat layout.tsx hem kan lezen
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const token = request.cookies.get("admin_token")?.value;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const ingelogd = !!adminPassword && !!token && token === adminPassword;

  // Admin auth — sla login pagina en login API over
  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin" &&
    !pathname.startsWith("/api/admin/login")
  ) {
    if (!ingelogd) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // De verkopers-API kan namens JG Mobility mail versturen en AI-tegoed verbruiken.
  // Let op: /api/... begint NIET met /admin, dus de controle hierboven raakt hem niet.
  // Uitgezonderd is de cron-ingang: die wordt door Vercel aangeroepen zonder
  // browsersessie en controleert zelf de CRON_SECRET.
  if (
    pathname.startsWith("/api/admin/verkopers") &&
    pathname !== "/api/admin/verkopers/autopilot/cron"
  ) {
    if (!ingelogd) {
      // Geen redirect maar een nette 401: de aanroeper is fetch(), geen browser.
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
