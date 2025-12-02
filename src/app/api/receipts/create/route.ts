import { NextRequest, NextResponse } from 'next/server';
import { createReceipt, ReceiptInfo, SignaturePoint } from '@/lib/kv';

interface CreateReceiptRequest {
  info: ReceiptInfo;
  signaturePoints?: SignaturePoint[][] | null;
  signatureNguoiNhan?: string; // Chữ ký admin
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateReceiptRequest = await request.json();
    const { info, signaturePoints, signatureNguoiNhan } = body;

    if (!info) {
      return NextResponse.json(
        { success: false, error: 'Receipt info is required' },
        { status: 400 }
      );
    }

    const receipt = await createReceipt(info, signaturePoints, signatureNguoiNhan);

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
