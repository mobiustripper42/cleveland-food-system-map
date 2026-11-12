import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

// Default-deny: anything not listed here requires a session. This is an
// optimistic cookie check only — pages and actions verify with getSession(),
// and public pages rely on query filters, not this, to hide editor-only data.
function isPublic(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/locations' ||
    // /locations/new is editor-only: let it fall through to the session check.
    (pathname.startsWith('/locations/') && pathname !== '/locations/new') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/api/auth/')
  );
}

export function proxy(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname) || getSessionCookie(request)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next internals and static images.
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
