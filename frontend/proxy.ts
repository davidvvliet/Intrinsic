import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

// In middleware auth mode, each page is protected by default.
// Exceptions are configured via the `unauthenticatedPaths` option.
export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      '/login',
      '/signup',
      '/callback',
      '/logout',
      '/onboarding',
      '/pricing',
      '/blog',
      '/blog/:path*',
      '/api/auth/:path*',
      '/:path*.png',
      '/:path*.jpg',
      '/:path*.jpeg',
      '/:path*.gif',
      '/:path*.svg',
      '/:path*.ico',
      '/:path*.webp',
      '/llms.txt',
      '/sitemap.xml',
      '/robots.txt',
    ],
  },
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt).*)',
  ],
};
