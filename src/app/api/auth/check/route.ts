import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function GET() {
  try {
    const isAuthenticated = await verifyAuth();
    
    return NextResponse.json({
      success: true,
      authenticated: isAuthenticated,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        authenticated: false,
        error: error instanceof Error ? error.message : 'Auth check failed' 
      },
      { status: 500 }
    );
  }
}
