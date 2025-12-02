import { NextRequest, NextResponse } from 'next/server';
import { deleteReceipt } from '@/lib/kv';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    await deleteReceipt(id);

    return NextResponse.json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete receipt' 
      },
      { status: 500 }
    );
  }
}
