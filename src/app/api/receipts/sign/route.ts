import { NextRequest, NextResponse } from 'next/server';
import { signReceipt, SignaturePoint } from '@/lib/kv';

interface SignReceiptRequest {
  id: string;
  signaturePoints?: SignaturePoint[][];
  signatureNguoiGui?: string; // Chữ ký người gửi tiền (base64)
  signatureNguoiNhan?: string; // Chữ ký người nhận tiền (base64)
}

export async function POST(request: NextRequest) {
  try {
    const body: SignReceiptRequest = await request.json();
    const { id, signaturePoints, signatureNguoiGui, signatureNguoiNhan } = body;

    if (!id || (!signaturePoints && !signatureNguoiGui && !signatureNguoiNhan)) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID and at least one signature are required' },
        { status: 400 }
      );
    }

    const receipt = await signReceipt(id, signaturePoints, signatureNguoiGui, signatureNguoiNhan);

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
