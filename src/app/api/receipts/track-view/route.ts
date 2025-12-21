import { NextRequest, NextResponse } from 'next/server';
import { getReceipt, updateReceipt } from '@/lib/kv';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // 🔒 SECURITY: Only track view if user is NOT authenticated (customer clicking email link)
    // If admin/user is viewing, don't track (they're just checking, not customer viewing)
    const token = getTokenFromRequest(request);
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        // User is authenticated (admin or user) - don't track view
        // This is just them checking the document, not a customer viewing
        return NextResponse.json({
          success: true,
          viewedAt: null, // Not tracked for authenticated users
          message: 'View not tracked for authenticated users',
        });
      }
    }

    // Get receipt
    const receipt = await getReceipt(id);
    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Only track first view (don't update if already viewed)
    // This is a customer clicking the email link
    if (!receipt.viewedAt) {
      await updateReceipt(id, {
        viewedAt: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      viewedAt: receipt.viewedAt || Date.now(),
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to track view' 
      },
      { status: 500 }
    );
  }
}

