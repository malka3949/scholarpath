import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    if (
      req.nextUrl.pathname.startsWith('/admin') &&
      req.nextauth.token?.role !== 'ADMIN'
    ) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        const protectedPaths = [
          '/profile',
          '/applications',
          '/admin',
          '/recommendations',
          '/notifications',
        ];
        if (protectedPaths.some((p) => path.startsWith(p))) {
          return !!token;
        }
        return true;
      },
    },
  },
);

export const config = {
  matcher: [
    '/profile/:path*',
    '/applications',
    '/applications/:path*',
    '/admin/:path*',
    '/recommendations/:path*',
    '/notifications',
    '/notifications/:path*',
  ],
};
