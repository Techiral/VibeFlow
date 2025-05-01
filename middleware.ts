
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Skip middleware for the root landing page
  if (request.nextUrl.pathname === '/') {
    return undefined; // Allow request to pass through without session update
  }

  // update user's auth session for other pages
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - / (root landing page) - Added exclusion
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Explicitly include paths requiring auth, if needed, but the above negative lookahead should cover most cases.
    // '/dashboard/:path*', // Example: If dashboard structure changes
  ],
}
