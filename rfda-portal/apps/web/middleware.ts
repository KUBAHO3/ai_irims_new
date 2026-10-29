import { NextRequest, NextResponse } from 'next/server';

/** Cheap first check: no session cookie means sign in. The API verifies the session on every call. */
export function middleware(req: NextRequest) {
  if (req.cookies.has('rfda_session')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/signin';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

// Only portal pages: /api is excluded so uploads are not subject to middleware body limits.
export const config = { matcher: ['/dashboard', '/applications/:path*', '/payments', '/help', '/intray', '/enquiries', '/review/:path*'] };
