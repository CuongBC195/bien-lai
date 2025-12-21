import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, updateUser } from '@/lib/kv';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin xác thực.' },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Người dùng không tồn tại.' },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { success: true, message: 'Email đã được xác thực trước đó.' },
        { status: 200 }
      );
    }

    if (user.emailVerificationToken !== token) {
      return NextResponse.json(
        { success: false, error: 'Token xác thực không hợp lệ.' },
        { status: 400 }
      );
    }

    if (user.emailVerificationExpiry && Date.now() > user.emailVerificationExpiry) {
      return NextResponse.json(
        { success: false, error: 'Token xác thực đã hết hạn. Vui lòng yêu cầu gửi lại email.' },
        { status: 400 }
      );
    }

    // Verify email
    await updateUser(user.id, {
      emailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpiry: undefined,
    });

    return NextResponse.json(
      { success: true, message: 'Email đã được xác thực thành công!' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Đã xảy ra lỗi khi xác thực email.',
      },
      { status: 500 }
    );
  }
}

