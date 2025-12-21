import { NextResponse } from 'next/server';
import { verifyAuth, getTokenFromCookies, verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const token = await getTokenFromCookies();
    let isAuthenticated = false;
    let role: 'admin' | 'user' | null = null;
    let userId: string | undefined = undefined;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        isAuthenticated = true;
        role = payload.role;
        userId = payload.userId;
      }
    }
    
    return NextResponse.json({
      success: true,
      authenticated: isAuthenticated,
      role,
      userId,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        authenticated: false,
        role: null,
        error: error instanceof Error ? error.message : 'Auth check failed' 
      },
      { status: 500 }
    );
  }
}
