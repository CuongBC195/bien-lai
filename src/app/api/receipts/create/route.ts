import { NextRequest, NextResponse } from 'next/server';
import { createReceipt, ReceiptInfo, ReceiptData, DocumentData, SignaturePoint, SignatureData } from '@/lib/kv';
import { getCurrentUserId } from '@/lib/auth';

interface CreateReceiptRequest {
  // Support both old and new format
  info?: ReceiptInfo;      // Legacy format
  data?: ReceiptData;      // New format (receipts)
  document?: DocumentData; // NEW: Contract/Document format
  signaturePoints?: SignaturePoint[][] | null;
  signatureNguoiNhan?: string; // Chữ ký người nhận (admin) - base64 preview
  signatureNguoiGui?: string;  // Chữ ký người gửi (admin) - base64 preview
  signatureDataNguoiNhan?: SignatureData; // Actual signature data
  signatureDataNguoiGui?: SignatureData;  // Actual signature data
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateReceiptRequest = await request.json();
    const { info, data, document, signaturePoints, signatureNguoiNhan, signatureNguoiGui, signatureDataNguoiNhan, signatureDataNguoiGui } = body;

    // Need either info (legacy), data (new receipt), or document (contract)
    if (!info && !data && !document) {
      return NextResponse.json(
        { success: false, error: 'Receipt info, data, or document is required' },
        { status: 400 }
      );
    }

    // Determine which format to use
    const receiptData = document || data || info;
    
    // Get user ID (if user is logged in, otherwise undefined = admin)
    const userId = await getCurrentUserId();
    
    // Create receipt with base64 previews
    const receipt = await createReceipt(
      receiptData!, 
      signaturePoints, 
      signatureNguoiNhan || data?.signatureNguoiNhan,
      signatureNguoiGui || data?.signatureNguoiGui,
      userId || undefined // Pass userId (convert null to undefined)
    );
    
    // If SignatureData was provided, update the receipt with it
    // (This handles admin signatures created with the new format)
    if (data?.signatureDataNguoiNhan || data?.signatureDataNguoiGui || signatureDataNguoiNhan || signatureDataNguoiGui) {
      const { updateReceipt } = await import('@/lib/kv');
      await updateReceipt(receipt.id, {
        signatureDataNguoiNhan: signatureDataNguoiNhan || data?.signatureDataNguoiNhan,
        signatureDataNguoiGui: signatureDataNguoiGui || data?.signatureDataNguoiGui,
      });
      // Update local receipt object
      receipt.signatureDataNguoiNhan = signatureDataNguoiNhan || data?.signatureDataNguoiNhan;
      receipt.signatureDataNguoiGui = signatureDataNguoiGui || data?.signatureDataNguoiGui;
    }

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
