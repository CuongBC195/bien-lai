import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() {
  const cookieHeader = clearAuthCookie();

  return NextResponse.json(
    { success: true, message: 'Đăng xuất thành công!' },
    {
      status: 200,
      headers: {
        'Set-Cookie': cookieHeader,
      },
    }
  );
}

