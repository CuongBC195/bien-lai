import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/kv';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const isAdmin = await verifyAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: 'User IDs array is required' },
        { status: 400 }
      );
    }

    // Get user info for all userIds
    const users = await Promise.all(
      userIds.map(async (userId: string) => {
        const user = await getUserById(userId);
        if (user) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        }
        return null;
      })
    );

    // Filter out null values and create a map
    const userMap: Record<string, { name: string; email: string }> = {};
    users.forEach((user) => {
      if (user) {
        userMap[user.id] = {
          name: user.name,
          email: user.email,
        };
      }
    });

    return NextResponse.json({
      success: true,
      users: userMap,
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get user info' 
      },
      { status: 500 }
    );
  }
}

