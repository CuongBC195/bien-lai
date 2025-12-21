import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateUser, getRedisClient } from '@/lib/kv';
import { createUserToken, setAuthCookie } from '@/lib/auth';

// Custom Redis-based rate limiting
async function checkLoginRateLimit(ip: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const redis = getRedisClient();
  const key = `rate_limit:user_login:${ip}`;
  const limit = 5;
  const window = 15 * 60; // 15 minutes in seconds

  const now = Date.now();
  const windowStart = now - window * 1000;

  // Get current count
  const countStr = await redis.get(key);
  const count = countStr ? parseInt(countStr, 10) : 0;

  if (count >= limit) {
    const ttl = await redis.ttl(key);
    return {
      success: false,
      limit,
      remaining: 0,
      reset: now + (ttl * 1000),
    };
  }

  // Increment count
  const multi = redis.multi();
  multi.incr(key);
  multi.expire(key, window);
  await multi.exec();

  return {
    success: true,
    limit,
    remaining: limit - count - 1,
    reset: now + window * 1000,
  };
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkLoginRateLimit(ip);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Bạn đã nhập sai quá nhiều lần. Thử lại sau ${Math.ceil((rateLimit.reset - Date.now()) / 1000 / 60)} phút.`,
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email và mật khẩu.' },
        { status: 400 }
      );
    }

    // Get user
    const user = await getUserByEmail(email.toLowerCase());
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Email hoặc mật khẩu không đúng.' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Email hoặc mật khẩu không đúng.' },
        { status: 401 }
      );
    }

    // 🔒 SECURITY: Check email verification
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vui lòng xác thực email trước khi đăng nhập. Kiểm tra hộp thư của bạn.',
          code: 'EMAIL_NOT_VERIFIED'
        },
        { status: 403 }
      );
    }

    // Clear rate limit on success
    const redis = getRedisClient();
    await redis.del(`rate_limit:user_login:${ip}`);

    // Update last login
    await updateUser(user.id, { lastLoginAt: Date.now() });

    // Create token and set cookie
    const token = await createUserToken(user.id);
    const cookieHeader = setAuthCookie(token);

    return NextResponse.json(
      {
        success: true,
        message: 'Đăng nhập thành công!',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Đã xảy ra lỗi khi đăng nhập.',
      },
      { status: 500 }
    );
  }
}

