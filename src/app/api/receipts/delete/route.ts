import { NextRequest, NextResponse } from 'next/server';
import { deleteReceipt, getReceipt } from '@/lib/kv';
import { getCurrentUserId, verifyAuth } from '@/lib/auth';

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

    // Get current receipt to check permissions and status
    const currentReceipt = await getReceipt(id);
    if (!currentReceipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete
    const userId = await getCurrentUserId();
    const isAdmin = await verifyAuth();
    
    // Only owner (userId matches) or admin can delete
    if (!isAdmin && currentReceipt.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xóa văn bản này.' },
        { status: 403 }
      );
    }

    // Check if document is fully signed (2 signatures) - prevent deletion
    if (currentReceipt.document) {
      const signedCount = currentReceipt.document.signers.filter(s => s.signed).length;
      if (signedCount >= 2) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Văn bản đã được ký đầy đủ bởi cả 2 bên. Không thể xóa.',
            code: 'FULLY_SIGNED'
          },
          { status: 403 }
        );
      }
    } else if (currentReceipt.status === 'signed') {
      // Legacy receipt - if fully signed, prevent deletion
      return NextResponse.json(
        { 
          success: false, 
          error: 'Văn bản đã được ký đầy đủ. Không thể xóa.',
          code: 'FULLY_SIGNED'
        },
        { status: 403 }
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
