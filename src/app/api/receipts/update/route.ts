import { NextRequest, NextResponse } from 'next/server';
import { updateReceipt, ReceiptInfo, ReceiptData, DocumentData, SignaturePoint, SignatureData } from '@/lib/kv';

interface UpdateReceiptRequest {
  id: string;
  // Support all formats
  info?: ReceiptInfo;      // Legacy format
  data?: ReceiptData;      // Receipt format
  document?: DocumentData; // Contract format
  signaturePoints?: SignaturePoint[][] | null;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  signatureDataNguoiNhan?: SignatureData;
  signatureDataNguoiGui?: SignatureData;
  status?: 'pending' | 'signed' | 'partially_signed';
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateReceiptRequest = await request.json();
    const { id, info, data, document, signatureNguoiNhan, signatureNguoiGui, signatureDataNguoiNhan, signatureDataNguoiGui, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Build updates object
    const updateData: Record<string, unknown> = { ...updates };
    
    if (document) {
      // Contract update
      updateData.document = document;
      // Clear other formats
      updateData.info = undefined;
      updateData.data = undefined;
    } else if (data) {
      // Receipt update
      updateData.data = data;
      // Clear legacy info if using new format
      updateData.info = undefined;
      // Extract signature data to top level for easy access
      if (data.signatureDataNguoiNhan) {
        updateData.signatureDataNguoiNhan = data.signatureDataNguoiNhan;
      }
      if (data.signatureDataNguoiGui) {
        updateData.signatureDataNguoiGui = data.signatureDataNguoiGui;
      }
    } else if (info) {
      // Legacy update
      updateData.info = info;
    }
    
    // Also handle top-level signature data if passed directly
    if (signatureDataNguoiNhan !== undefined) {
      updateData.signatureDataNguoiNhan = signatureDataNguoiNhan;
    }
    if (signatureDataNguoiGui !== undefined) {
      updateData.signatureDataNguoiGui = signatureDataNguoiGui;
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
