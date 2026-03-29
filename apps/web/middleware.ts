// middleware.ts - Next.js 14 Route Protection Middleware
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Edge-safe secret bytes — computed once at module load
const secret = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

if (!secret) {
  console.error('[middleware] JWT_SECRET is not set — middleware will fail closed (all dashboard requests redirect to login)');
}

// Role-based route permissions (complete audit of all admin + user surfaces)
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Admin routes
  '/dashboard/admin': ['ADMIN'],
  '/dashboard/admin/books': ['ADMIN'],
  '/dashboard/admin/borrows': ['ADMIN'],
  '/dashboard/admin/branches': ['ADMIN'],
  '/dashboard/admin/fines': ['ADMIN'],
  '/dashboard/admin/import-books': ['ADMIN'],
  '/dashboard/admin/materials': ['ADMIN'],
  '/dashboard/admin/policies': ['ADMIN'],
  '/dashboard/admin/reading-lists': ['ADMIN'],
  '/dashboard/admin/reports': ['ADMIN'],
  '/dashboard/admin/reservations': ['ADMIN'],
  '/dashboard/admin/settings': ['ADMIN'],
  '/dashboard/admin/statistics': ['ADMIN'],
  '/dashboard/admin/upload': ['ADMIN'],
  '/dashboard/admin/users': ['ADMIN'],
  // User routes
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
  '/dashboard/reading-lists': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
  '/dashboard/instructors': ['STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN'],
};

// Map roles to their default dashboards
const ROLE_DASHBOARDS: Record<string, string> = {
  ADMIN: '/dashboard/admin',
  STUDENT: '/dashboard/student',
  INSTRUCTOR: '/dashboard/instructor',
  STAFF: '/dashboard/staff',
};

async function verifyToken(token: string): Promise<{ role?: string; sub?: string } | null> {
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload as { role?: string; sub?: string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
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

  // Verify JWT signature and extract payload
  const payload = await verifyToken(token);
  if (!payload || !payload.role) {
    // Invalid or tampered token — redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = payload.role;

  // Find the most specific matching route permission (boundary-safe)
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => pathname === route || pathname.startsWith(route + '/'))
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
