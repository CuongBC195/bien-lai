import { NextResponse } from 'next/server';
import { getUserReceipts } from '@/lib/kv';
import { getCurrentUserId } from '@/lib/auth';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const receipts = await getUserReceipts(userId);

    return NextResponse.json({
      success: true,
      receipts,
    });
  } catch (error) {
    console.error('Error listing user receipts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list receipts' 
      },
      { status: 500 }
    );
  }
}

