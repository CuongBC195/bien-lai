import { NextResponse } from 'next/server';
import { getAllReceipts, getUserReceipts } from '@/lib/kv';
import { getCurrentUserId, verifyAuth } from '@/lib/auth';

export async function GET() {
  try {
    // 🔒 SECURITY: Require authentication
    const userId = await getCurrentUserId();
    const isAdmin = await verifyAuth();
    
    // If not authenticated, return empty array (don't expose any data)
    if (!isAdmin && !userId) {
      return NextResponse.json({
        success: true,
        receipts: [],
      });
    }
    
    // Admin sees all receipts, users see only their own
    const receipts = isAdmin ? await getAllReceipts() : (userId ? await getUserReceipts(userId) : []);

    return NextResponse.json({
      success: true,
      receipts,
    });
  } catch (error) {
    console.error('Error listing receipts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list receipts' 
      },
      { status: 500 }
    );
  }
}
