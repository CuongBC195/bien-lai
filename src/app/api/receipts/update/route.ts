import { NextRequest, NextResponse } from 'next/server';
import { updateReceipt, getReceipt, ReceiptInfo, ReceiptData, DocumentData, SignaturePoint, SignatureData } from '@/lib/kv';
import { getCurrentUserId, verifyAuth } from '@/lib/auth';

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

    // Get current receipt to check permissions and status
    const currentReceipt = await getReceipt(id);
    if (!currentReceipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to edit
    const userId = await getCurrentUserId();
    const isAdmin = await verifyAuth();
    
    // Only owner (userId matches) or admin can edit
    if (!isAdmin && currentReceipt.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa văn bản này.' },
        { status: 403 }
      );
    }

    // Check if document is fully signed (2 signatures) - prevent editing
    if (currentReceipt.document) {
      const signedCount = currentReceipt.document.signers.filter(s => s.signed).length;
      if (signedCount >= 2) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Văn bản đã được ký đầy đủ bởi cả 2 bên. Không thể chỉnh sửa.',
            code: 'FULLY_SIGNED'
          },
          { status: 403 }
        );
      }
    } else if (currentReceipt.status === 'signed') {
      // Legacy receipt - if fully signed, prevent editing
      return NextResponse.json(
        { 
          success: false, 
          error: 'Văn bản đã được ký đầy đủ. Không thể chỉnh sửa.',
          code: 'FULLY_SIGNED'
        },
        { status: 403 }
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
