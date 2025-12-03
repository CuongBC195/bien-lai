import { NextRequest, NextResponse } from 'next/server';
import { updateReceipt, ReceiptInfo, ReceiptData, SignaturePoint } from '@/lib/kv';

interface UpdateReceiptRequest {
  id: string;
  // Support both old and new format
  info?: ReceiptInfo;      // Legacy format
  data?: ReceiptData;      // New format
  signaturePoints?: SignaturePoint[][] | null;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  status?: 'pending' | 'signed';
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateReceiptRequest = await request.json();
    const { id, info, data, signatureNguoiNhan, signatureNguoiGui, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Build updates object
    const updateData: Record<string, unknown> = { ...updates };
    
    if (data) {
      updateData.data = data;
      // Clear legacy info if using new format
      updateData.info = undefined;
    } else if (info) {
      updateData.info = info;
    }
    
    if (signatureNguoiNhan !== undefined) {
      updateData.signatureNguoiNhan = signatureNguoiNhan;
    }
    if (signatureNguoiGui !== undefined) {
      updateData.signatureNguoiGui = signatureNguoiGui;
    }

    const receipt = await updateReceipt(id, updateData);

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
