import { NextRequest, NextResponse } from 'next/server';
import { updateReceipt, ReceiptInfo, SignaturePoint } from '@/lib/kv';

interface UpdateReceiptRequest {
  id: string;
  info?: ReceiptInfo;
  signaturePoints?: SignaturePoint[][] | null;
  status?: 'pending' | 'signed';
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateReceiptRequest = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    const receipt = await updateReceipt(id, updates);

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error('Error updating receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update receipt' 
      },
      { status: 500 }
    );
  }
}
