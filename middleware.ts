import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// Routes that require admin authentication
const ADMIN_ROUTES = [
  '/admin',
  '/admin/create',
  '/admin/editor',
  '/admin/users',
  '/api/receipts/delete',
  '/api/receipts/list',
  '/api/admin/users',
];

// Routes that require user authentication
const USER_ROUTES = [
  '/user/dashboard',
  '/user/create',
  '/user/editor',
  '/api/user/receipts',
];

// Routes that require authentication (either admin or user)
const AUTHENTICATED_ROUTES = [
  '/api/receipts/create',
  '/api/receipts/update',
];

// Public API routes (no auth needed)
const PUBLIC_API_ROUTES = [
  '/api/receipts/get',
  '/api/receipts/sign',
  '/api/receipts/track-view',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/user/register',
  '/api/user/login',
  '/api/user/logout',
  '/api/user/verify-email',
  '/api/user/check',
  '/api/send-email',
  '/api/send-invitation',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip public API routes
  if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check if the route requires admin authentication
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
  const isUserRoute = USER_ROUTES.some(route => pathname.startsWith(route));
  const isAuthenticatedRoute = AUTHENTICATED_ROUTES.some(route => pathname.startsWith(route));
  
  // Skip if not a protected route
  if (!isAdminRoute && !isUserRoute && !isAuthenticatedRoute) {
    return NextResponse.next();
  }
  
  // Get token from cookie
  const token = getTokenFromRequest(request);
  
  if (!token) {
    // No token - redirect to appropriate login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please login first' },
        { status: 401 }
      );
    }
    if (isUserRoute) {
      return NextResponse.redirect(new URL('/user/login', request.url));
    }
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  
  // Verify token
  const payload = await verifyToken(token);
  
  if (!payload) {
    // Invalid token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or expired token' },
        { status: 401 }
      );
    }
    if (isUserRoute) {
      return NextResponse.redirect(new URL('/user/login', request.url));
    }
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  
  // Check role authorization
  if (isAdminRoute && payload.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  
  if (isUserRoute && payload.role !== 'user') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - User access required' },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL('/user/login', request.url));
  }
  
  // For authenticated routes (create/update), allow both admin and user
  if (isAuthenticatedRoute) {
    if (payload.role !== 'admin' && payload.role !== 'user') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized - Authentication required' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/user/login', request.url));
    }
  }
  
  // Token is valid and role matches, continue
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Admin routes - match all paths under /admin
    '/admin/:path*',
    '/api/receipts/create',
    '/api/receipts/delete',
    '/api/receipts/update',
    '/api/receipts/list',
    '/api/admin/users/:path*',
    // User routes - match all paths under /user
    '/user/:path*',
    '/api/user/receipts/:path*',
  ],
};
