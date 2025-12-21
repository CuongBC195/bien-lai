import { NextResponse } from 'next/server';
import { verifyUserAuth } from '@/lib/auth';
import { getTokenFromCookies } from '@/lib/auth';

export async function GET() {
  const token = await getTokenFromCookies();
  if (!token) {
    return NextResponse.json({ authenticated: false, role: null }, { status: 200 });
  }

  const payload = await verifyUserAuth();
  if (!payload) {
    return NextResponse.json({ authenticated: false, role: null }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    role: payload.role,
    userId: payload.userId,
  });
}

