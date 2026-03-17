import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MARKETING_HOST = "akyra.io";
const APP_HOST = "aky.akyra.io";

// Routes that belong to the marketing site
const MARKETING_PATHS = ["/", "/pricing", "/login", "/signup"];

function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.includes(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host")?.replace(/:\d+$/, "") || "";

  // Skip static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // On akyra.io: only allow marketing paths, redirect app paths to aky.akyra.io
  if (hostname === MARKETING_HOST || hostname === `www.${MARKETING_HOST}`) {
    if (!isMarketingPath(pathname)) {
      const url = new URL(pathname, `https://${APP_HOST}`);
      url.search = request.nextUrl.search;
      return NextResponse.redirect(url);
    }
  }

  // On aky.akyra.io: redirect marketing paths to akyra.io
  if (hostname === APP_HOST) {
    if (isMarketingPath(pathname)) {
      // "/" on the app domain goes to dashboard
      if (pathname === "/") {
        return NextResponse.rewrite(new URL("/dashboard", request.url));
      }
      const url = new URL(pathname, `https://${MARKETING_HOST}`);
      url.search = request.nextUrl.search;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
