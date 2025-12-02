import { NextRequest, NextResponse } from 'next/server';
import { signReceipt, SignaturePoint } from '@/lib/kv';

interface SignReceiptRequest {
  id: string;
  signaturePoints?: SignaturePoint[][];
  signatureNguoiGui?: string; // Chữ ký khách base64
}

export async function POST(request: NextRequest) {
  try {
    const body: SignReceiptRequest = await request.json();
    const { id, signaturePoints, signatureNguoiGui } = body;

    if (!id || (!signaturePoints && !signatureNguoiGui)) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID and signature are required' },
        { status: 400 }
      );
    }

    const receipt = await signReceipt(id, signaturePoints || [], signatureNguoiGui);

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found or already signed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error('Error signing receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to sign receipt' 
      },
      { status: 500 }
    );
  }
}
