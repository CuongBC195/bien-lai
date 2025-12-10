import { NextRequest, NextResponse } from 'next/server';
import { getReceipt, updateReceipt } from '@/lib/kv';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Get receipt
    const receipt = await getReceipt(id);
    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Only track first view (don't update if already viewed)
    if (!receipt.viewedAt) {
      await updateReceipt(id, {
        viewedAt: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      viewedAt: receipt.viewedAt || Date.now(),
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to track view' 
      },
      { status: 500 }
    );
  }
}

