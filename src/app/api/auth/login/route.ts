import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';
import { getRedisClient } from '@/lib/kv';

// 🔒 SECURITY: Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds

/**
 * Check rate limit for login attempts using sliding window
 * Returns { success: boolean, remaining: number, reset: number }
 */
async function checkLoginRateLimit(ip: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const redis = getRedisClient();
  const key = `ratelimit:login:${ip}`;
  const now = Date.now();
  const windowStart = now - (RATE_LIMIT_WINDOW * 1000);

  // Use sorted set for sliding window
  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count current attempts in window
  const count = await redis.zcard(key);

  if (count >= MAX_LOGIN_ATTEMPTS) {
    // Get oldest entry to calculate reset time
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetTime = oldest[1] ? parseInt(oldest[1]) + (RATE_LIMIT_WINDOW * 1000) : now + (RATE_LIMIT_WINDOW * 1000);
    
    return {
      success: false,
      limit: MAX_LOGIN_ATTEMPTS,
      remaining: 0,
      reset: resetTime,
    };
  }

  // Add current attempt
  await redis.zadd(key, now, `${now}:${Math.random()}`);
  await redis.expire(key, RATE_LIMIT_WINDOW);

  return {
    success: true,
    limit: MAX_LOGIN_ATTEMPTS,
    remaining: MAX_LOGIN_ATTEMPTS - count - 1,
    reset: now + (RATE_LIMIT_WINDOW * 1000),
  };
}

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

    // 🔒 SECURITY: Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'anonymous';

    // 🔒 SECURITY: Check rate limit BEFORE password verification (prevent timing attacks)
    const { success: rateLimitOk, limit, remaining, reset } = await checkLoginRateLimit(ip);

    if (!rateLimitOk) {
      const resetDate = new Date(reset);
      const minutesUntilReset = Math.ceil((reset - Date.now()) / 1000 / 60);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutesUntilReset} phút.`,
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
          resetAt: resetDate.toISOString()
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          }
        }
      );
    }

    // Verify password against server-side env var
    if (!verifyPassword(password)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mật khẩu không đúng',
          remainingAttempts: remaining - 1,
          warning: remaining <= 2 ? `⚠️ Còn ${remaining - 1} lần thử. Sau đó sẽ bị khóa 15 phút!` : undefined
        },
        { status: 401 }
      );
    }

    // 🎉 SUCCESS: Password correct

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
