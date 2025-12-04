import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// JWT Configuration
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRES_IN = '24h'; // 24 hours
const COOKIE_NAME = 'auth_token';

export interface AuthPayload extends JWTPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

/**
 * Create a JWT token for admin authentication
 */
export async function createToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const token = await new SignJWT({ role: 'admin' as const })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Verify a JWT token
 */
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });
    
    return payload as AuthPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Get auth cookie options for setting HttpOnly cookie
 */
export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24, // 24 hours in seconds
    path: '/',
  };
}

/**
 * Set auth cookie (for use in API routes)
 */
export function setAuthCookie(token: string) {
  const options = getAuthCookieOptions();
  
  // Return cookie string for Set-Cookie header
  const cookieParts = [
    `${options.name}=${token}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    options.httpOnly ? 'HttpOnly' : '',
    options.secure ? 'Secure' : '',
    `SameSite=${options.sameSite}`,
  ].filter(Boolean);
  
  return cookieParts.join('; ');
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie() {
  const options = getAuthCookieOptions();
  
  const cookieParts = [
    `${options.name}=`,
    'Max-Age=0',
    `Path=${options.path}`,
    options.httpOnly ? 'HttpOnly' : '',
    options.secure ? 'Secure' : '',
    `SameSite=${options.sameSite}`,
  ].filter(Boolean);
  
  return cookieParts.join('; ');
}

/**
 * Get token from request (for middleware)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}

/**
 * Get token from cookies (for server components/API routes)
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Verify admin authentication from cookies
 */
export async function verifyAuth(): Promise<boolean> {
  const token = await getTokenFromCookies();
  if (!token) return false;
  
  const payload = await verifyToken(token);
  return payload?.role === 'admin';
}

/**
 * Verify admin password
 */
export function verifyPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable is not set');
    return false;
  }
  
  return password === adminPassword;
}
