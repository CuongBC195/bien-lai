/**
 * Server-side PDF Generator with Puppeteer
 * High-quality PDF rendering with Vietnamese font support
 * Optimized for Vercel Serverless
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import type { Signer, SignatureData, SignaturePoint } from './kv';

interface PDFGeneratorOptions {
  title: string;
  content: string; // HTML string
  signers: Signer[];
  metadata: {
    contractNumber?: string;
    createdDate: string;
    location: string;
  };
  includeHeader?: boolean;
  includeFooter?: boolean;
}

/**
 * Get Chromium executable path
 * - Development: Use local Chrome
 * - Production: Use @sparticuz/chromium-min
 */
async function getChromiumPath(): Promise<string> {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Local Chrome path (from env or default Mac path)
    const localChrome =
      process.env.CHROME_EXECUTABLE_PATH ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return localChrome;
  }

  // Production: Use chromium-min
  return await chromium.executablePath(
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
  );
}

/**
 * Convert SignatureData to inline SVG string
 */
function signatureToSVG(signatureData: SignatureData, width = 200, height = 80): string {
  if (signatureData.type === 'type' && signatureData.typedText) {
    // Typed signature
    const fontFamily = signatureData.fontFamily || 'Dancing Script, cursive';
    const color = signatureData.color || '#000000';
    const escapedText = signatureData.typedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${color}" font-size="32" font-family="${fontFamily}">
        ${escapedText}
      </text>
    </svg>`;
  } else if (
    signatureData.type === 'draw' &&
    signatureData.signaturePoints &&
    signatureData.signaturePoints.length > 0
  ) {
    // Drawn signature - convert points to SVG paths
    const points = signatureData.signaturePoints;
    
    // 🔒 SECURITY: Filter out empty strokes (prevent invalid signatures)
    const validStrokes = points.filter(stroke => stroke && stroke.length > 0);
    
    if (validStrokes.length === 0) {
      // All strokes are empty - return "Chưa ký"
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
              fill="#9ca3af" font-size="14" font-family="sans-serif">Chưa ký</text>
      </svg>`;
    }
    
    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of validStrokes) {
      for (const point of stroke) {
        // 🔒 SECURITY: Validate point coordinates (prevent NaN/Infinity)
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || 
            !isFinite(point.x) || !isFinite(point.y)) {
          continue;
        }
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    // 🔒 SECURITY: Check if we found valid bounds
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
              fill="#9ca3af" font-size="14" font-family="sans-serif">Chưa ký</text>
      </svg>`;
    }

    const originalWidth = maxX - minX;
    const originalHeight = maxY - minY;
    
    // Handle zero dimensions (single point signature)
    if (originalWidth === 0 || originalHeight === 0) {
      const color = signatureData.color || '#000000';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <circle cx="${width/2}" cy="${height/2}" r="2" fill="${color}" />
      </svg>`;
    }
    
    const scaleX = (width * 0.8) / originalWidth;
    const scaleY = (height * 0.8) / originalHeight;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;
    const offsetX = (width - scaledWidth) / 2 - minX * scale;
    const offsetY = (height - scaledHeight) / 2 - minY * scale;

    const paths = validStrokes.map((stroke) => {
      const pathData = stroke
        .filter(point => point && isFinite(point.x) && isFinite(point.y))
        .map((point, j) => {
          const x = point.x * scale + offsetX;
          const y = point.y * scale + offsetY;
          return j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

      if (!pathData) return ''; // Skip empty paths

      const color = signatureData.color || '#000000';
      return `<path d="${pathData}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).filter(p => p).join('\n');

    if (!paths) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
              fill="#9ca3af" font-size="14" font-family="sans-serif">Chưa ký</text>
      </svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${paths}
    </svg>`;
  }

  // No signature
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          fill="#9ca3af" font-size="14" font-family="sans-serif">Chưa ký</text>
  </svg>`;
}

/**
 * Generate HTML template for PDF
 */
function generateHTMLTemplate(options: PDFGeneratorOptions): string {
  const { title, content, signers, metadata, includeHeader = true, includeFooter = true } = options;

  // Build signature sections
  const signatureHTML = includeFooter
    ? `
      <div class="signatures">
        <p style="text-align: center; font-style: italic; margin: 40px 0 30px 0;">
          ${metadata.location}, ${metadata.createdDate}
        </p>
        <div class="signature-grid" style="display: grid; grid-template-columns: repeat(${Math.min(signers.length, 2)}, 1fr); gap: 40px; margin-top: 20px;">
          ${signers
            .map((signer) => {
              const signatureSVG = signer.signatureData
                ? signatureToSVG(signer.signatureData)
                : signatureToSVG({ type: 'draw', signaturePoints: null });

              return `
                <div class="signer-box" style="text-align: center;">
                  <p style="font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">${signer.role}</p>
                  <p style="font-size: 12px; font-style: italic; color: #666; margin-bottom: 16px;">(Ký và ghi rõ họ tên)</p>
                  <div class="signature-container" style="min-height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                    ${signatureSVG}
                  </div>
                  <div style="border-top: 1px dotted #666; padding-top: 8px; display: inline-block; padding-left: 30px; padding-right: 30px;">
                    ${signer.name || '...........................'}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Import Vietnamese-compatible font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tinos:wght@400;700&family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet">
  
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tinos', 'Times New Roman', serif;
      font-size: 14px;
      line-height: 1.8;
      color: #000;
      background: #fff;
      padding: 0;
    }
    
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    
    .header p {
      font-weight: bold;
      text-transform: uppercase;
      margin: 4px 0;
    }
    
    .header .divider {
      margin: 12px 0;
      color: #666;
    }
    
    .title {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      margin: 24px 0 8px 0;
    }
    
    .contract-number {
      text-align: center;
      font-style: italic;
      font-size: 13px;
      margin-bottom: 24px;
    }
    
    .content {
      margin-bottom: 40px;
      text-align: justify;
    }
    
    .content p {
      margin: 8px 0;
    }
    
    .content strong {
      font-weight: bold;
    }
    
    .signatures {
      margin-top: 60px;
      page-break-inside: avoid;
    }
    
    .signature-grid {
      margin-top: 20px;
    }
    
    .signer-box p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  ${
    includeHeader
      ? `
    <div class="header">
      <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
      <p>Độc lập - Tự do - Hạnh phúc</p>
      <p class="divider">---------------oOo---------------</p>
    </div>
  `
      : ''
  }
  
  <h1 class="title">${title}</h1>
  ${metadata.contractNumber ? `<p class="contract-number">Số: ${metadata.contractNumber}</p>` : ''}
  
  <div class="content">
    <p><em>${metadata.createdDate}, tại ${metadata.location}</em></p>
    <br>
    ${content}
  </div>
  
  ${signatureHTML}
</body>
</html>
  `.trim();
}

/**
 * Generate Contract PDF using Puppeteer
 * Returns Buffer for email attachment or download
 */
export async function generateContractPDF(
  options: PDFGeneratorOptions
): Promise<Buffer> {
  let browser;

  try {
    const executablePath = await getChromiumPath();
    const isDev = process.env.NODE_ENV === 'development';

    console.log('[PDF Generator] Starting browser...');
    console.log('[PDF Generator] Environment:', isDev ? 'Development' : 'Production');
    console.log('[PDF Generator] Executable path:', executablePath);

    // Launch browser
    browser = await puppeteer.launch({
      args: isDev
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    // 🔒 SECURITY: Set navigation timeout (30 seconds max)
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);

    // Generate HTML
    const html = generateHTMLTemplate(options);

    // Set content with timeout
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 20000, // 20 seconds max
    });

    // Wait for fonts to load (with timeout)
    await Promise.race([
      page.evaluateHandle('document.fonts.ready'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Font loading timeout')), 10000)
      ),
    ]);

    console.log('[PDF Generator] Generating PDF...');

    // Generate PDF with timeout
    const pdfBuffer = await Promise.race([
      page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm',
        },
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('PDF generation timeout after 30 seconds')), 30000)
      ),
    ]);

    console.log('[PDF Generator] PDF generated successfully');
    console.log('[PDF Generator] Size:', pdfBuffer.length, 'bytes');

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('[PDF Generator] Error:', error);
    throw new Error(
      `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    if (browser) {
      await browser.close();
      console.log('[PDF Generator] Browser closed');
    }
  }
}

/**
 * Generate filename for PDF
 */
export function generatePDFFilename(
  type: 'receipt' | 'contract',
  id: string,
  title?: string
): string {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = type === 'receipt' ? 'Bien_Nhan' : 'Hop_Dong';
  const safeName = title
    ? title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30)
    : '';

  return `${prefix}_${id}_${safeName}_${timestamp}.pdf`;
}

/**
 * Generate PDF preview (base64) for client-side display
 */
export async function generatePDFPreview(
  options: PDFGeneratorOptions
): Promise<string> {
  const buffer = await generateContractPDF(options);
  return buffer.toString('base64');
}
