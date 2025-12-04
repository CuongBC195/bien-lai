/**
 * Server-side signature utilities
 * Converts signature points to SVG/PNG for emails and notifications
 * NO base64 images stored - only coordinates
 */

import sharp from 'sharp';

export interface SignaturePoint {
  x: number;
  y: number;
  time?: number;
  color?: string;
}

/**
 * Convert signature points (from react-signature-canvas) to SVG path
 * @param points - Array of strokes, each stroke is an array of points
 * @param options - Configuration options
 */
export function signaturePointsToSvg(
  points: SignaturePoint[][] | null,
  options: {
    width?: number;
    height?: number;
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string;
  } = {}
): string {
  const {
    width = 300,
    height = 100,
    strokeColor = '#000000',
    strokeWidth = 2,
    backgroundColor = '#ffffff',
  } = options;

  if (!points || points.length === 0) {
    // Return empty signature placeholder
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="${backgroundColor}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="14" font-family="sans-serif">Chưa ký</text>
    </svg>`;
  }

  // Find bounding box of all points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const stroke of points) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  // Calculate scaling to fit in target dimensions with padding
  const padding = 10;
  const originalWidth = maxX - minX;
  const originalHeight = maxY - minY;
  
  // Avoid division by zero
  const scaleX = originalWidth > 0 ? (width - padding * 2) / originalWidth : 1;
  const scaleY = originalHeight > 0 ? (height - padding * 2) / originalHeight : 1;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
  
  // Calculate offset to center the signature
  const scaledWidth = originalWidth * scale;
  const scaledHeight = originalHeight * scale;
  const offsetX = (width - scaledWidth) / 2 - minX * scale;
  const offsetY = (height - scaledHeight) / 2 - minY * scale;

  // Convert each stroke to SVG path
  const paths = points.map(stroke => {
    if (stroke.length === 0) return '';
    
    const pathData = stroke.map((point, index) => {
      const x = point.x * scale + offsetX;
      const y = point.y * scale + offsetY;
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    const color = stroke[0]?.color || strokeColor;
    
    return `<path d="${pathData}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    ${paths.join('\n    ')}
  </svg>`;
}

/**
 * Convert SVG string to base64 data URL (for embedding in HTML emails)
 */
export function svgToDataUrl(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Convert signature points directly to base64 data URL
 */
export function signaturePointsToDataUrl(
  points: SignaturePoint[][] | null,
  options?: {
    width?: number;
    height?: number;
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string;
  }
): string {
  const svg = signaturePointsToSvg(points, options);
  return svgToDataUrl(svg);
}

/**
 * Generate HTML for signature display in emails
 */
export function generateSignatureHtml(
  points: SignaturePoint[][] | null,
  label: string,
  name: string
): string {
  const svgDataUrl = signaturePointsToDataUrl(points, {
    width: 200,
    height: 80,
    strokeColor: '#000000',
    strokeWidth: 2,
    backgroundColor: '#ffffff',
  });

  return `
    <div style="text-align: center; margin: 20px 0;">
      <p style="font-weight: bold; margin-bottom: 8px;">${label}</p>
      <p style="font-size: 12px; color: #666; font-style: italic; margin-bottom: 16px;">(Ký và ghi rõ họ tên)</p>
      <img src="${svgDataUrl}" alt="Chữ ký ${label}" style="max-width: 200px; height: 80px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 8px;" />
      <p style="border-top: 1px dotted #9ca3af; padding-top: 8px; display: inline-block; padding-left: 32px; padding-right: 32px;">
        ${name || '...........................'}
      </p>
    </div>
  `;
}

/**
 * Validate signature points structure
 */
export function validateSignaturePoints(points: unknown): points is SignaturePoint[][] {
  if (!Array.isArray(points)) return false;
  
  return points.every(stroke => {
    if (!Array.isArray(stroke)) return false;
    return stroke.every(point => {
      return (
        typeof point === 'object' &&
        point !== null &&
        typeof point.x === 'number' &&
        typeof point.y === 'number'
      );
    });
  });
}

/**
 * Generate SVG for typed signature (text-based)
 */
export function typedSignatureToSvg(
  text: string,
  options: {
    width?: number;
    height?: number;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  } = {}
): string {
  const {
    width = 300,
    height = 100,
    fontFamily = 'Dancing Script, cursive',
    fontSize = 36,
    color = '#000000',
    backgroundColor = '#ffffff',
  } = options;

  // Escape text for SVG
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          fill="${color}" font-size="${fontSize}" font-family="${fontFamily}">
      ${escapedText}
    </text>
  </svg>`;
}

/**
 * Convert typed signature to base64 data URL
 */
export function typedSignatureToDataUrl(
  text: string,
  options?: {
    width?: number;
    height?: number;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  }
): string {
  const svg = typedSignatureToSvg(text, options);
  return svgToDataUrl(svg);
}

/**
 * Convert SVG to PNG Buffer using sharp
 */
export async function svgToPngBuffer(svg: string): Promise<Buffer> {
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Convert signature points to PNG Buffer (for email attachments)
 */
export async function signaturePointsToPngBuffer(
  points: SignaturePoint[][] | null,
  options?: {
    width?: number;
    height?: number;
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string;
  }
): Promise<Buffer> {
  const svg = signaturePointsToSvg(points, options);
  return await svgToPngBuffer(svg);
}

/**
 * Convert typed signature to PNG Buffer
 */
export async function typedSignatureToPngBuffer(
  text: string,
  options?: {
    width?: number;
    height?: number;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  }
): Promise<Buffer> {
  const svg = typedSignatureToSvg(text, options);
  return await svgToPngBuffer(svg);
}
