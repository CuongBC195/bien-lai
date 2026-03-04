import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { SignatureData, Signer } from './kv';

interface SignaturePlacement {
    id: string;
    signerIndex: number;
    page: number;
    x: number; // % position
    y: number;
    width: number; // % size
    height: number;
}

/**
 * Renders signature data (draw or type) to a PNG buffer.
 * Used server-side to embed signatures into PDFs.
 */
function renderSignatureToSvg(signatureData: SignatureData, width = 200, height = 80): string | null {
    if (!signatureData) return null;

    if (signatureData.type === 'type' && signatureData.typedText) {
        const fontFamily = signatureData.fontFamily || 'cursive';
        const color = signatureData.color || '#000000';
        const escapedText = signatureData.typedText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="transparent"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${color}" font-size="24" font-family="${fontFamily}">
        ${escapedText}
      </text>
    </svg>`;
    }

    if (signatureData.type === 'draw' && signatureData.signaturePoints && signatureData.signaturePoints.length > 0) {
        const points = signatureData.signaturePoints;
        const validStrokes = points.filter(stroke => stroke && stroke.length > 0);
        if (validStrokes.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const stroke of validStrokes) {
            for (const point of stroke) {
                if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') continue;
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
        }

        if (!isFinite(minX)) return null;

        const originalWidth = maxX - minX || 1;
        const originalHeight = maxY - minY || 1;
        const padding = 10;
        const scaleX = (width - padding * 2) / originalWidth;
        const scaleY = (height - padding * 2) / originalHeight;
        const scale = Math.min(scaleX, scaleY);
        const scaledWidth = originalWidth * scale;
        const scaledHeight = originalHeight * scale;
        const offsetX = (width - scaledWidth) / 2 - minX * scale;
        const offsetY = (height - scaledHeight) / 2 - minY * scale;

        const paths = validStrokes.map(stroke => {
            const d = stroke
                .filter(p => p && isFinite(p.x) && isFinite(p.y))
                .map((p, j) => {
                    const x = p.x * scale + offsetX;
                    const y = p.y * scale + offsetY;
                    return j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                }).join(' ');
            const color = signatureData.color || '#000000';
            return d ? `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : '';
        }).filter(p => p).join('\n');

        if (!paths) return null;

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="transparent"/>
      ${paths}
    </svg>`;
    }

    return null;
}

/**
 * Convert SVG string to PNG buffer using built-in canvas-like approach.
 * Since we're server-side, we use a simple SVG-to-PNG conversion via pdf-lib's own rendering.
 */
function svgToDataUrl(svg: string): string {
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Embeds signatures into a PDF using pdf-lib.
 * Takes the original PDF base64, signers with signature data, and placements.
 * Returns a Buffer with the modified PDF.
 */
export async function embedSignaturesInPdf(
    pdfBase64: string,
    signers: Signer[],
    placements: SignaturePlacement[]
): Promise<Buffer> {
    // Decode original PDF
    const base64Data = pdfBase64.split(',')[1] || pdfBase64;
    const pdfBytes = Buffer.from(base64Data, 'base64');

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const placement of placements) {
        const signer = signers[placement.signerIndex];
        if (!signer || !signer.signed || !signer.signatureData) continue;

        if (placement.page >= pages.length) continue;
        const page = pages[placement.page];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Convert % to absolute coordinates
        const x = (placement.x / 100) * pageWidth;
        const boxWidth = (placement.width / 100) * pageWidth;
        const boxHeight = (placement.height / 100) * pageHeight;
        // PDF y-coordinate is from bottom, placement.y is from top
        const y = pageHeight - (placement.y / 100) * pageHeight - boxHeight;

        if (signer.signatureData.type === 'type' && signer.signatureData.typedText) {
            // Draw typed signature text
            const text = signer.signatureData.typedText;
            const fontSize = Math.min(boxHeight * 0.6, 18);
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const textX = x + (boxWidth - textWidth) / 2;
            const textY = y + (boxHeight - fontSize) / 2;

            // Parse color
            const color = parseColor(signer.signatureData.color || '#000000');

            page.drawText(text, {
                x: textX,
                y: textY,
                size: fontSize,
                font,
                color,
            });
        } else if (signer.signatureData.type === 'draw' && signer.signatureData.signaturePoints) {
            // Draw signature strokes directly on the PDF
            const points = signer.signatureData.signaturePoints;
            const validStrokes = points.filter(stroke => stroke && stroke.length > 0);
            if (validStrokes.length === 0) continue;

            // Find bounding box of signature
            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for (const stroke of validStrokes) {
                for (const point of stroke) {
                    if (!point || typeof point.x !== 'number') continue;
                    sMinX = Math.min(sMinX, point.x);
                    sMinY = Math.min(sMinY, point.y);
                    sMaxX = Math.max(sMaxX, point.x);
                    sMaxY = Math.max(sMaxY, point.y);
                }
            }

            if (!isFinite(sMinX)) continue;

            const sigWidth = sMaxX - sMinX || 1;
            const sigHeight = sMaxY - sMinY || 1;
            const padding = 4;
            const scaleX = (boxWidth - padding * 2) / sigWidth;
            const scaleY = (boxHeight - padding * 2) / sigHeight;
            const scale = Math.min(scaleX, scaleY);

            const scaledW = sigWidth * scale;
            const scaledH = sigHeight * scale;
            const offsetX = x + (boxWidth - scaledW) / 2;
            const offsetY = y + (boxHeight - scaledH) / 2;

            const color = parseColor(signer.signatureData.color || '#000000');

            // Draw each stroke as lines
            for (const stroke of validStrokes) {
                for (let i = 1; i < stroke.length; i++) {
                    const p1 = stroke[i - 1];
                    const p2 = stroke[i];
                    if (!p1 || !p2 || !isFinite(p1.x) || !isFinite(p2.x)) continue;

                    const x1 = (p1.x - sMinX) * scale + offsetX;
                    const y1p = (p1.y - sMinY) * scale;
                    const y1 = offsetY + scaledH - y1p; // flip Y axis for PDF

                    const x2 = (p2.x - sMinX) * scale + offsetX;
                    const y2p = (p2.y - sMinY) * scale;
                    const y2 = offsetY + scaledH - y2p;

                    page.drawLine({
                        start: { x: x1, y: y1 },
                        end: { x: x2, y: y2 },
                        thickness: 1.5,
                        color,
                    });
                }
            }
        }
    }

    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes);
}

/**
 * Parse hex color string to pdf-lib RGB color
 */
function parseColor(hexColor: string) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
}
