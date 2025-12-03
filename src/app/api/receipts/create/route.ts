import { NextRequest, NextResponse } from 'next/server';
import { createReceipt, ReceiptInfo, ReceiptData, SignaturePoint } from '@/lib/kv';

interface CreateReceiptRequest {
  // Support both old and new format
  info?: ReceiptInfo;      // Legacy format
  data?: ReceiptData;      // New format
  signaturePoints?: SignaturePoint[][] | null;
  signatureNguoiNhan?: string; // Chữ ký người nhận (admin)
  signatureNguoiGui?: string;  // Chữ ký người gửi (admin)
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateReceiptRequest = await request.json();
    const { info, data, signaturePoints, signatureNguoiNhan, signatureNguoiGui } = body;

    // Need either info (legacy) or data (new format)
    if (!info && !data) {
      return NextResponse.json(
        { success: false, error: 'Receipt info or data is required' },
        { status: 400 }
      );
    }

    // Use new format if available, otherwise use legacy
    const receiptData = data || info;
    const receipt = await createReceipt(
      receiptData!, 
      signaturePoints, 
      signatureNguoiNhan || data?.signatureNguoiNhan,
      signatureNguoiGui || data?.signatureNguoiGui
    );

    // Generate signing URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
    const signingUrl = `${baseUrl}/?id=${receipt.id}`;

    return NextResponse.json({
      success: true,
      receipt,
      url: signingUrl,
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create receipt' 
      },
      { status: 500 }
    );
  }
}
