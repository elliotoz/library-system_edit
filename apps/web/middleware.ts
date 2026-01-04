// middleware.ts - Next.js 14 Route Protection Middleware
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Role-based route permissions
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/admin': ['ADMIN'],
  '/dashboard/admin/books': ['ADMIN'],
  '/dashboard/admin/users': ['ADMIN'],
  '/dashboard/admin/reservations': ['ADMIN'],
  '/dashboard/admin/settings': ['ADMIN'],
  '/dashboard/admin/upload': ['ADMIN'],
  '/dashboard/student': ['STUDENT', 'ADMIN'],
  '/dashboard/instructor': ['INSTRUCTOR', 'ADMIN'],
  '/dashboard/staff': ['STAFF', 'ADMIN'],
  '/dashboard/catalog': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
  '/dashboard/borrowed': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
  '/dashboard/reservations': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
  '/dashboard/ai-assistant': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
  '/dashboard/profile': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
  '/dashboard/settings': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
  '/dashboard/notifications': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
};

// Map roles to their default dashboards
const ROLE_DASHBOARDS: Record<string, string> = {
  ADMIN: '/dashboard/admin',
  STUDENT: '/dashboard/student',
  INSTRUCTOR: '/dashboard/instructor',
  STAFF: '/dashboard/staff',
};

// Decode JWT payload (without verification - verification happens on API)
function decodeJwtPayload(token: string): { role?: string; sub?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-dashboard routes and static files
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  // Get token from HttpOnly cookie
  const token = request.cookies.get('access_token')?.value;

  // No token = redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode JWT to get role
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.role) {
    // Invalid token format - redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = payload.role;

  // Find the most specific matching route permission
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => pathname.startsWith(route))
    .sort((a, b) => b.length - a.length)[0]; // Longest match first

  if (matchedRoute) {
    const allowedRoles = ROUTE_PERMISSIONS[matchedRoute];

    // Check if user's role is allowed
    if (!allowedRoles.includes(userRole)) {
      // Redirect to user's appropriate dashboard
      const redirectUrl = new URL(
        ROLE_DASHBOARDS[userRole] || '/dashboard',
        request.url
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Allow the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all dashboard routes
    '/dashboard/:path*',
  ],
};
