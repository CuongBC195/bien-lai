import { NextRequest, NextResponse } from 'next/server';
import { getReceipt, getPdfData } from '@/lib/kv';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Receipt ID is required' },
                { status: 400 }
            );
        }

        // Verify receipt exists
        const receipt = await getReceipt(id);
        if (!receipt) {
            return NextResponse.json(
                { success: false, error: 'Receipt not found' },
                { status: 404 }
            );
        }

        // Check if it's a PDF upload
        if (!receipt.document?.metadata?.isPdfUpload) {
            return NextResponse.json(
                { success: false, error: 'Not a PDF upload document' },
                { status: 400 }
            );
        }

        // Get PDF data from separate Redis key
        const pdfBase64 = await getPdfData(id);

        // Fallback: check legacy storage in metadata (for old documents)
        const fallbackPdf = pdfBase64 || (receipt.document.metadata.pdfBase64 as string | undefined);

        if (!fallbackPdf) {
            return NextResponse.json(
                { success: false, error: 'PDF data not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            pdfBase64: fallbackPdf,
        });
    } catch (error) {
        console.error('Error getting PDF data:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get PDF data',
            },
            { status: 500 }
        );
    }
}
