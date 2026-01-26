import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

// In middleware auth mode, each page is protected by default.
// Exceptions are configured via the `unauthenticatedPaths` option.
export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      '/login',
      '/callback',
      '/logout',
      '/api/auth/:path*',
      '/:path*.png',
      '/:path*.jpg',
      '/:path*.jpeg',
      '/:path*.gif',
      '/:path*.svg',
      '/:path*.ico',
      '/:path*.webp',
    ],
  },
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
