import { NextRequest, NextResponse } from 'next/server';
import { getReceipt } from '@/lib/kv';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    const receipt = await getReceipt(id);

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found or has been revoked' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error('Error getting receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get receipt' 
      },
      { status: 500 }
    );
  }
}
