import { NextResponse } from 'next/server';
import { getAllUsers } from '@/lib/kv';
import { verifyAuth } from '@/lib/auth';

export async function GET() {
  try {
    // Check admin authentication
    const isAdmin = await verifyAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const users = await getAllUsers();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list users' 
      },
      { status: 500 }
    );
  }
}

