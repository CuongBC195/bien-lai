import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';
import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

// 🔒 SECURITY: Rate limiting with @upstash/ratelimit
// Limit: 5 attempts per 15 minutes per IP (sliding window)
const loginRateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'ratelimit:login',
});

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
    const { success: rateLimitOk, limit, remaining, reset } = await loginRateLimit.limit(ip);

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
