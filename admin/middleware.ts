import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes — sign-in page and API proxy only
const isPublic = createRouteMatcher([
  '/login(.*)',
  '/sign-in(.*)',
  '/api/(.*)', // API proxy forwards tokens itself; let page components handle auth
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)',
  ],
};
