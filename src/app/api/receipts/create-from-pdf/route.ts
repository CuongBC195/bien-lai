import { NextRequest, NextResponse } from 'next/server';
import { createReceipt, DocumentData, SignatureData, storePdfData } from '@/lib/kv';
import { getCurrentUserId } from '@/lib/auth';

interface SignaturePlacement {
    id: string;
    signerIndex: number;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Signer {
    id: string;
    role: string;
    name: string;
    signed: boolean;
    signedAt?: number;
    signatureData?: SignatureData;
}

interface CreateFromPdfRequest {
    title: string;
    pdfBase64: string;
    signers: Signer[];
    placements: SignaturePlacement[];
    metadata: {
        createdDate: string;
        location: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        const body: CreateFromPdfRequest = await request.json();
        const { title, pdfBase64, signers, placements, metadata } = body;

        // Validation
        if (!title || !pdfBase64) {
            return NextResponse.json(
                { success: false, error: 'Thiếu tiêu đề hoặc file PDF' },
                { status: 400 }
            );
        }

        if (!placements || placements.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Vui lòng đặt ít nhất một vị trí chữ ký trên PDF' },
                { status: 400 }
            );
        }

        // Build document data - NO pdfBase64 here (stored separately to avoid Redis 1MB limit)
        const documentData: DocumentData = {
            type: 'contract',
            title,
            content: '', // No HTML content - the PDF itself is the document
            signers: signers.map((s) => ({
                id: s.id,
                role: s.role,
                name: s.name,
                signed: !!s.signed,
                signedAt: s.signedAt,
                signatureData: s.signatureData,
            })),
            metadata: {
                createdDate: metadata.createdDate,
                location: metadata.location,
                signaturePlacements: placements,
                isPdfUpload: true, // Flag to identify PDF upload documents
                // NOTE: pdfBase64 stored in separate Redis key to avoid 1MB limit
            },
        };

        // Get user ID
        const userId = await getCurrentUserId();

        // Create receipt (without pdfBase64 to keep JSON small)
        const receipt = await createReceipt(
            documentData,
            null,
            undefined,
            undefined,
            userId || undefined
        );

        // Store PDF data separately in its own Redis key
        await storePdfData(receipt.id, pdfBase64);

        // Generate URL
        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            (process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : 'http://localhost:3000');
        const signingUrl = `${baseUrl}/?id=${receipt.id}`;

        return NextResponse.json({
            success: true,
            receipt: {
                id: receipt.id,
                status: receipt.status,
                createdAt: receipt.createdAt,
            },
            url: signingUrl,
        });
    } catch (error) {
        console.error('Error creating PDF receipt:', error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : 'Failed to create PDF receipt',
            },
            { status: 500 }
        );
    }
}
