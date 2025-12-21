import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail } from '@/lib/kv';
import { createUserToken, setAuthCookie } from '@/lib/auth';
import { customAlphabet } from 'nanoid';
import nodemailer from 'nodemailer';

const generateToken = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 32);

// Custom rate limiting (simple in-memory, can be improved)
const registerAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRegisterRateLimit(ip: string): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const attempt = registerAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    registerAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 minutes
    return { success: true, remaining: 4, reset: now + 15 * 60 * 1000 };
  }

  if (attempt.count >= 5) {
    return { success: false, remaining: 0, reset: attempt.resetAt };
  }

  attempt.count++;
  return { success: true, remaining: 5 - attempt.count, reset: attempt.resetAt };
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRegisterRateLimit(ip);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau 15 phút.',
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
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng điền đầy đủ thông tin.' },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ.' },
        { status: 400 }
      );
    }

    // Password strength
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email này đã được sử dụng.' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = generateToken();

    // Create user
    const user = await createUser(email, passwordHash, name, verificationToken);

    // Send verification email
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                      'http://localhost:3000';
      const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

      await transporter.sendMail({
        from: `"Hệ thống Hợp đồng điện tử" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Xác thực email đăng ký',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 30px;">
              <h1 style="color: #2c3e50; margin-bottom: 20px;">Xác thực email</h1>
              <p>Xin chào <strong>${name}</strong>,</p>
              <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng click vào link bên dưới để xác thực email của bạn:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Xác thực email
                </a>
              </p>
              <p>Hoặc copy link này vào trình duyệt:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${verifyUrl}</p>
              <p style="margin-top: 30px; color: #999; font-size: 12px;">
                Link này sẽ hết hạn sau 24 giờ.
              </p>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Continue even if email fails - user can request resend
    }

    // ❌ DO NOT create token or set cookie - user must verify email first
    // Only return success message

    return NextResponse.json(
      {
        success: true,
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản trước khi đăng nhập.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: false, // Not verified yet
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Đã xảy ra lỗi khi đăng ký.',
      },
      { status: 500 }
    );
  }
}

