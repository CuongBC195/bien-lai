import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// Routes that require admin authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/api/receipts/create',
  '/api/receipts/delete',
  '/api/receipts/update',
  '/api/receipts/list',
];

// Public API routes (no auth needed)
const PUBLIC_API_ROUTES = [
  '/api/receipts/get',
  '/api/receipts/sign',
  '/api/receipts/track-view',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/send-email',
  '/api/send-invitation',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  );
  
  // Skip if not a protected route
  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  
  // Get token from cookie
  const token = getTokenFromRequest(request);
  
  if (!token) {
    // No token - redirect to login for pages, return 401 for APIs
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please login first' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Verify token
  const payload = await verifyToken(token);
  
  if (!payload || payload.role !== 'admin') {
    // Invalid token - redirect to login for pages, return 401 for APIs
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or expired token' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Token is valid, continue
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Match all protected routes
    '/dashboard/:path*',
    '/api/receipts/create',
    '/api/receipts/delete',
    '/api/receipts/update',
    '/api/receipts/list',
  ],
};
