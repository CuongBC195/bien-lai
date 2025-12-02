import { NextResponse } from 'next/server';
import { getAllReceipts } from '@/lib/kv';

export async function GET() {
  try {
    const receipts = await getAllReceipts();

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
