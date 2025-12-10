import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';
import { getRedisClient } from '@/lib/kv';

// 🔒 SECURITY: Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds
const LOCKOUT_DURATION = 30 * 60; // 30 minutes in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // 🔒 SECURITY: Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const rateLimitKey = `login_attempts:${ip}`;
    const lockoutKey = `login_locked:${ip}`;

    const redis = getRedisClient();

    // Check if IP is locked out
    const isLockedOut = await redis.get(lockoutKey);
    if (isLockedOut) {
      const ttl = await redis.ttl(lockoutKey);
      return NextResponse.json(
        { 
          success: false, 
          error: `Too many failed login attempts. Please try again in ${Math.ceil(ttl / 60)} minutes.`,
          code: 'RATE_LIMITED',
          retryAfter: ttl
        },
        { status: 429 }
      );
    }

    // Check current attempt count
    const attempts = await redis.get(rateLimitKey);
    const currentAttempts = attempts ? parseInt(attempts as string) : 0;

    if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
      // Lock out the IP
      await redis.setex(lockoutKey, LOCKOUT_DURATION, '1');
      await redis.del(rateLimitKey);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Maximum login attempts exceeded. Account locked for ${LOCKOUT_DURATION / 60} minutes.`,
          code: 'ACCOUNT_LOCKED'
        },
        { status: 429 }
      );
    }

    // Verify password against server-side env var
    if (!verifyPassword(password)) {
      // Increment failed attempts
      const newAttempts = currentAttempts + 1;
      await redis.setex(rateLimitKey, RATE_LIMIT_WINDOW, newAttempts.toString());
      
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid password',
          remainingAttempts: Math.max(0, remainingAttempts),
          warning: remainingAttempts <= 2 ? `Warning: Only ${remainingAttempts} attempts remaining before lockout` : undefined
        },
        { status: 401 }
      );
    }

    // 🎉 SUCCESS: Clear rate limiting on successful login
    await redis.del(rateLimitKey);
    await redis.del(lockoutKey);

    // Create JWT token
    const token = await createToken();

    // Create response with success message
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
    });

    // Set HttpOnly cookie
    response.headers.set('Set-Cookie', setAuthCookie(token));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      },
      { status: 500 }
    );
  }
}
