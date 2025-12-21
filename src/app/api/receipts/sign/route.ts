import { NextRequest, NextResponse } from 'next/server';
import { getReceipt, updateReceipt, signReceipt, Receipt, DynamicField, SignatureData, getRedisClient } from '@/lib/kv';
import nodemailer from 'nodemailer';
import { generateContractPDF, generatePDFFilename } from '@/lib/pdf-generator';

// 🔒 SECURITY: Rate limiting configuration for signing
const MAX_SIGN_ATTEMPTS = 3;
const SIGN_RATE_WINDOW = 60; // 1 minute in seconds

/**
 * Check rate limit for signing attempts using sliding window
 * Returns { success: boolean, remaining: number, reset: number }
 */
async function checkSignRateLimit(identifier: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const redis = getRedisClient();
  const key = `ratelimit:sign:${identifier}`;
  const now = Date.now();
  const windowStart = now - (SIGN_RATE_WINDOW * 1000);

  // Use sorted set for sliding window
  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count current attempts in window
  const count = await redis.zcard(key);

  if (count >= MAX_SIGN_ATTEMPTS) {
    // Get oldest entry to calculate reset time
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetTime = oldest[1] ? parseInt(oldest[1]) + (SIGN_RATE_WINDOW * 1000) : now + (SIGN_RATE_WINDOW * 1000);
    
    return {
      success: false,
      limit: MAX_SIGN_ATTEMPTS,
      remaining: 0,
      reset: resetTime,
    };
  }

  // Add current attempt
  await redis.zadd(key, now, `${now}:${Math.random()}`);
  await redis.expire(key, SIGN_RATE_WINDOW);

  return {
    success: true,
    limit: MAX_SIGN_ATTEMPTS,
    remaining: MAX_SIGN_ATTEMPTS - count - 1,
    reset: now + (SIGN_RATE_WINDOW * 1000),
  };
}

interface SignReceiptRequest {
  id: string;
  receiptImage?: string; // Base64 PNG image captured from client (for legacy receipts)
  signatureNguoiNhan?: string; // Optional: signature preview for storage
  signatureNguoiGui?: string;
  // NEW: For contracts with signature data
  signatureDataNguoiGui?: SignatureData;
  signatureDataNguoiNhan?: SignatureData;
  signerId?: string; // ID of the signer (for contracts with multiple signers)
}

// Helper: Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

// Extract receipt info from new or legacy format
function extractReceiptInfo(receipt: Receipt): {
  hoTenNguoiNhan: string;
  hoTenNguoiGui: string;
  donViNguoiNhan: string;
  donViNguoiGui: string;
  lyDoNop: string;
  soTien: number;
  ngayThang: string;
  diaDiem: string;
} {
  if (receipt.data) {
    const getFieldValue = (id: string): string => {
      const field = receipt.data?.fields.find((f: DynamicField) => f.id === id);
      return field?.value || '';
    };
    
    const soTienField = receipt.data.fields.find((f: DynamicField) => f.type === 'money');
    const soTien = soTienField ? parseInt(soTienField.value.replace(/\D/g, '')) || 0 : 0;
    
    return {
      hoTenNguoiNhan: getFieldValue('hoTenNguoiNhan'),
      hoTenNguoiGui: getFieldValue('hoTenNguoiGui'),
      donViNguoiNhan: getFieldValue('donViNguoiNhan'),
      donViNguoiGui: getFieldValue('donViNguoiGui'),
      lyDoNop: getFieldValue('lyDoNop'),
      soTien,
      ngayThang: receipt.data.ngayThang,
      diaDiem: receipt.data.diaDiem,
    };
  } else if (receipt.info) {
    return receipt.info;
  }
  
  return {
    hoTenNguoiNhan: '',
    hoTenNguoiGui: '',
    donViNguoiNhan: '',
    donViNguoiGui: '',
    lyDoNop: '',
    soTien: 0,
    ngayThang: '',
    diaDiem: '',
  };
}

// Send Email notification - with PDF for contracts, image for legacy receipts
async function sendEmailNotification(
  receipt: Receipt, 
  pdfBuffer?: Buffer, 
  receiptImageBase64?: string,
  customerEmail?: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const isContract = !!receipt.document;
  const info = extractReceiptInfo(receipt);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000';
  const viewUrl = `${baseUrl}/?id=${receipt.id}`;
  
  // Prepare attachments
  const attachments: any[] = [];
  
  if (pdfBuffer) {
    // PDF attachment for contracts
    const filename = generatePDFFilename(
      isContract ? 'contract' : 'receipt',
      receipt.id,
      receipt.document?.title || receipt.data?.title
    );
    attachments.push({
      filename,
      content: pdfBuffer,
    });
  } else if (receiptImageBase64) {
    // Image attachment for legacy receipts
    const base64Data = receiptImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    attachments.push({
      filename: `bien-lai-${receipt.id}.png`,
      content: imageBuffer,
      cid: 'receipt_image',
    });
  }

  const docType = isContract ? 'Hợp đồng' : 'Biên lai';
  const docTitle = receipt.document?.title || receipt.data?.title || 'Văn bản';

  // Collect all recipient emails
  const recipientEmails: string[] = [];
  
  // 1. Add document creator email (if exists)
  if (receipt.userId) {
    const { getUserById } = await import('@/lib/kv');
    const user = await getUserById(receipt.userId);
    if (user && user.email) {
      recipientEmails.push(user.email);
    }
  }
  
  // 2. Add admin email (fallback if no creator)
  if (process.env.ADMIN_EMAIL && !recipientEmails.includes(process.env.ADMIN_EMAIL)) {
    recipientEmails.push(process.env.ADMIN_EMAIL);
  }
  
  // 3. Add customer email (if provided and different from creator)
  if (customerEmail && !recipientEmails.includes(customerEmail)) {
    recipientEmails.push(customerEmail);
  }

  // If no recipients, skip sending
  if (recipientEmails.length === 0) {
    console.warn('No recipient emails found, skipping email notification');
    return;
  }

  const mailOptions = {
    from: `"Hệ thống ${docType} điện tử" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '), // Send to all recipients
    subject: `📝 ${docType} #${receipt.id} - ${info.hoTenNguoiGui || docTitle} đã ký xác nhận`,
    attachments,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: #ffffff; border: 1px solid #d4d4d4; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <div style="padding: 24px; text-align: center; border-bottom: 2px solid #c9a227; background: linear-gradient(135deg, #fefefe 0%, #f8f6f0 100%);">
            <h1 style="font-size: 22px; font-weight: bold; color: #1a1a1a; margin: 0 0 8px 0;">
              ✅ ${docType.toUpperCase()} ĐÃ ĐƯỢC KÝ XÁC NHẬN
            </h1>
            <p style="font-size: 14px; color: #666; margin: 0;">
              ${isContract ? 'Mã hợp đồng' : 'Mã biên lai'}: <strong style="color: #c9a227;">${receipt.id}</strong>
            </p>
            ${isContract ? `<p style="font-size: 13px; color: #666; margin: 4px 0 0 0;">${docTitle}</p>` : ''}
          </div>
          
          <!-- Quick Info -->
          <div style="padding: 20px 24px; background: #fafafa; border-bottom: 1px solid #eee;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              ${isContract ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Tiêu đề:</td>
                  <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">${docTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Số hợp đồng:</td>
                  <td style="padding: 8px 0; color: #1a1a1a;">${receipt.document?.metadata.contractNumber || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Địa điểm:</td>
                  <td style="padding: 8px 0; color: #1a1a1a;">${receipt.document?.metadata.location || 'N/A'}</td>
                </tr>
              ` : `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Người gửi tiền:</td>
                  <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">${info.hoTenNguoiGui || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Người nhận tiền:</td>
                  <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">${info.hoTenNguoiNhan || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Số tiền:</td>
                  <td style="padding: 8px 0; color: #b8860b; font-weight: bold; font-size: 16px;">${formatCurrency(info.soTien)}</td>
                </tr>
              `}
              <tr>
                <td style="padding: 8px 0; color: #666;">Thời gian ký:</td>
                <td style="padding: 8px 0; color: #1a1a1a;">${new Date().toLocaleString('vi-VN')}</td>
              </tr>
            </table>
          </div>
          
          <!-- Content Preview -->
          <div style="padding: 24px; text-align: center;">
            ${pdfBuffer ? `
              <p style="font-size: 13px; color: #888; margin: 0 0 16px 0;">📄 File PDF đã được đính kèm</p>
              <div style="padding: 20px; background: #f0f9ff; border: 2px dashed #3b82f6; border-radius: 8px;">
                <p style="font-size: 16px; margin: 0 0 8px 0;">📎 <strong>${generatePDFFilename(isContract ? 'contract' : 'receipt', receipt.id, docTitle)}</strong></p>
                <p style="font-size: 13px; color: #666; margin: 0;">Vui lòng tải xuống file đính kèm để xem chi tiết</p>
              </div>
            ` : `
              <p style="font-size: 13px; color: #888; margin: 0 0 16px 0;">📄 Hình ảnh biên lai đã ký:</p>
              <img src="cid:receipt_image" alt="Biên lai đã ký" style="max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
            `}
          </div>

          <!-- View Link -->
          <div style="padding: 20px 24px; text-align: center; border-top: 1px solid #eee;">
            <a href="${viewUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
              Xem ${docType} trực tuyến →
            </a>
          </div>
          
          <!-- Footer -->
          <div style="padding: 16px 24px; background: #fafafa; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #888; font-size: 12px; margin: 0;">
              Email tự động từ <strong>Hệ thống ${docType} điện tử</strong>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// Send Telegram notification - sendDocument for PDF, sendPhoto for image
async function sendTelegramNotification(receipt: Receipt, pdfBuffer?: Buffer, receiptImageBase64?: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Telegram credentials not configured');
  }

  const isContract = !!receipt.document;
  const info = extractReceiptInfo(receipt);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000';
  const viewUrl = `${baseUrl}/?id=${receipt.id}`;

  const docType = isContract ? 'HỢP ĐỒNG' : 'BIÊN LAI';
  const docTitle = receipt.document?.title || receipt.data?.title || 'Văn bản';
  
  // Create caption
  const caption = isContract 
    ? `📝 *${docType} #${receipt.id}*
━━━━━━━━━━━━━━
📋 *${docTitle}*
${receipt.document?.metadata.contractNumber ? `📄 Số: ${receipt.document.metadata.contractNumber}` : ''}
📍 ${receipt.document?.metadata.location || 'N/A'}
✅ *Đã ký xác nhận*
⏰ ${new Date().toLocaleString('vi-VN')}
━━━━━━━━━━━━━━
🔗 [Xem chi tiết](${viewUrl})`
    : `📝 *${docType} #${receipt.id}*
━━━━━━━━━━━━━━
👤 *Người gửi:* ${info.hoTenNguoiGui || 'N/A'}
👤 *Người nhận:* ${info.hoTenNguoiNhan || 'N/A'}
💰 *Số tiền:* ${formatCurrency(info.soTien)}
✅ *Đã ký xác nhận*
⏰ ${new Date().toLocaleString('vi-VN')}
━━━━━━━━━━━━━━
🔗 [Xem chi tiết](${viewUrl})`;

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);
  formData.append('parse_mode', 'Markdown');

  let endpoint = '';
  
  if (pdfBuffer) {
    // Send PDF document
    const filename = generatePDFFilename(
      isContract ? 'contract' : 'receipt',
      receipt.id,
      docTitle
    );
    // Convert Buffer to Uint8Array for Blob compatibility
    const pdfArray = new Uint8Array(pdfBuffer);
    formData.append('document', new Blob([pdfArray], { type: 'application/pdf' }), filename);
    endpoint = `https://api.telegram.org/bot${botToken}/sendDocument`;
  } else if (receiptImageBase64) {
    // Send photo (legacy)
    const base64Data = receiptImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    // Convert Buffer to Uint8Array for Blob compatibility
    const imageArray = new Uint8Array(imageBuffer);
    formData.append('photo', new Blob([imageArray], { type: 'image/png' }), 'receipt.png');
    endpoint = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  } else {
    throw new Error('No PDF or image data provided');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SignReceiptRequest = await request.json();
    const { 
      id, 
      receiptImage, 
      signatureNguoiNhan, 
      signatureNguoiGui,
      signatureDataNguoiGui,
      signatureDataNguoiNhan,
      signerId,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // 🔒 SECURITY: Validate signature data (prevent empty submissions)
    const hasContractSignature = signatureDataNguoiGui || signatureDataNguoiNhan;
    const hasLegacySignature = receiptImage;
    
    if (!hasContractSignature && !hasLegacySignature) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Signature data is required. Please draw or type your signature.',
          code: 'EMPTY_SIGNATURE'
        },
        { status: 400 }
      );
    }

    // 🔒 CRITICAL: Deep validation for contract signatures
    if (hasContractSignature) {
      const sigData = signatureDataNguoiGui || signatureDataNguoiNhan;
      
      if (!sigData) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Signature data is missing.',
            code: 'EMPTY_SIGNATURE'
          },
          { status: 400 }
        );
      }

      // Validate DRAW signature
      if (sigData.type === 'draw') {
        // 1. Existence Check
        if (!sigData.signaturePoints) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Signature points are missing. Please draw your signature.',
              code: 'EMPTY_SIGNATURE'
            },
            { status: 400 }
          );
        }

        // 2. Type Check
        if (!Array.isArray(sigData.signaturePoints)) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invalid signature format. Please try again.',
              code: 'INVALID_SIGNATURE_FORMAT'
            },
            { status: 400 }
          );
        }

        // 3. Length Check (CRITICAL!)
        // Filter valid strokes (non-empty)
        const validStrokes = sigData.signaturePoints.filter(stroke => Array.isArray(stroke) && stroke.length > 0);
        
        if (validStrokes.length === 0) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Chữ ký trống. Vui lòng vẽ chữ ký của bạn.',
              code: 'EMPTY_SIGNATURE'
            },
            { status: 400 }
          );
        }

        // Count total points across all strokes
        const totalPoints = validStrokes.reduce((sum, stroke) => sum + stroke.length, 0);
        
        // Require at least 10 points OR 2 strokes for valid signature
        const MIN_POINTS = 10;
        const MIN_STROKES = 2;
        
        if (totalPoints < MIN_POINTS && validStrokes.length < MIN_STROKES) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Chữ ký quá ngắn hoặc không hợp lệ. Vui lòng ký rõ ràng hơn.',
              code: 'SIGNATURE_TOO_SHORT',
              details: {
                minPoints: MIN_POINTS,
                minStrokes: MIN_STROKES,
                actualPoints: totalPoints,
                actualStrokes: validStrokes.length
              }
            },
            { status: 400 }
          );
        }

        // 4. Data Integrity Check
        for (const stroke of validStrokes) {
          for (const point of stroke) {
            if (!point || typeof point !== 'object') {
              return NextResponse.json(
                { 
                  success: false, 
                  error: 'Invalid signature data structure.',
                  code: 'INVALID_SIGNATURE_FORMAT'
                },
                { status: 400 }
              );
            }

            const { x, y } = point;

            // Check if x and y exist and are numbers
            if (typeof x !== 'number' || typeof y !== 'number') {
              return NextResponse.json(
                { 
                  success: false, 
                  error: 'Invalid signature coordinates. Please try again.',
                  code: 'INVALID_SIGNATURE_FORMAT'
                },
                { status: 400 }
              );
            }

            // Check for Infinity, NaN, or invalid values
            if (!isFinite(x) || !isFinite(y)) {
              return NextResponse.json(
                { 
                  success: false, 
                  error: 'Tọa độ chữ ký không hợp lệ (Infinity/NaN). Vui lòng ký lại.',
                  code: 'INVALID_SIGNATURE_COORDINATES'
                },
                { status: 400 }
              );
            }

            // Check for suspicious values (all zeros, negative, etc.)
            if (x < 0 || y < 0 || (x === 0 && y === 0)) {
              return NextResponse.json(
                { 
                  success: false, 
                  error: 'Chữ ký không hợp lệ. Vui lòng vẽ lại chữ ký của bạn.',
                  code: 'SUSPICIOUS_SIGNATURE'
                },
                { status: 400 }
              );
            }
          }
        }
      } 
      // Validate TYPE signature
      else if (sigData.type === 'type') {
        if (!sigData.typedText || typeof sigData.typedText !== 'string' || sigData.typedText.trim() === '') {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Please type your signature name.',
              code: 'EMPTY_SIGNATURE'
            },
            { status: 400 }
          );
        }

        // Minimum length for typed signature
        if (sigData.typedText.trim().length < 2) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Chữ ký quá ngắn. Vui lòng nhập tên đầy đủ.',
              code: 'SIGNATURE_TOO_SHORT'
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid signature type.',
            code: 'INVALID_SIGNATURE_TYPE'
          },
          { status: 400 }
        );
      }
    }

    // 🔒 SECURITY: Rate limiting by IP (prevent spam/abuse)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'anonymous';

    const { success: rateLimitOk, limit, remaining, reset } = await checkSignRateLimit(`${ip}:${id}`);

    if (!rateLimitOk) {
      const secondsUntilReset = Math.ceil((reset - Date.now()) / 1000);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Vui lòng đợi ${secondsUntilReset} giây trước khi ký lại.`,
          code: 'RATE_LIMITED',
          retryAfter: secondsUntilReset
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(secondsUntilReset),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          }
        }
      );
    }

    // Get existing receipt
    const receipt = await getReceipt(id);
    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    const isContract = !!receipt.document;
    let updatedReceipt: Receipt;
    let pdfBuffer: Buffer | undefined;
    let customerEmail: string | undefined; // Email of the customer who signed

    if (isContract && receipt.document) {
      // CONTRACT FLOW: Use signature data API
      if (signerId && (signatureDataNguoiGui || signatureDataNguoiNhan)) {
        // Update specific signer
        const signerIndex = receipt.document.signers.findIndex((s) => s.id === signerId);
        if (signerIndex === -1) {
          return NextResponse.json(
            { success: false, error: 'Signer not found' },
            { status: 404 }
          );
        }

        // 🔒 SECURITY: Prevent double signing (race condition protection)
        const currentSigner = receipt.document.signers[signerIndex];
        if (currentSigner.signed) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'This signer has already signed this document',
              code: 'ALREADY_SIGNED'
            },
            { status: 403 }
          );
        }

        // Get customer email from the signer before updating
        customerEmail = currentSigner.email;

        const updatedSigners = [...receipt.document.signers];
        updatedSigners[signerIndex] = {
          ...updatedSigners[signerIndex],
          signed: true,
          signedAt: Date.now(),
          signatureData: signatureDataNguoiGui || signatureDataNguoiNhan,
        };

        // Check if all signers have signed
        const allSigned = updatedSigners.every((s) => s.signed);

        const updates: Partial<Receipt> = {
          document: {
            ...receipt.document,
            signers: updatedSigners,
          },
          status: allSigned ? 'signed' : 'partially_signed',
          signedAt: allSigned ? Date.now() : undefined,
        };

        updatedReceipt = (await updateReceipt(id, updates))!;
      } else {
        // Legacy: Sign with signReceipt API
        updatedReceipt = (await signReceipt(id, signatureDataNguoiGui, signatureDataNguoiNhan))!;
      }

      // Generate PDF for contract (only if all signed)
      if (updatedReceipt.status === 'signed') {
        try {
          pdfBuffer = await generateContractPDF({
            title: receipt.document.title,
            content: receipt.document.content,
            signers: updatedReceipt.document!.signers,
            metadata: receipt.document.metadata,
            includeHeader: true,
            includeFooter: true,
          });
        } catch (pdfError) {
          // 🔒 SECURITY: Rollback if PDF generation fails
          console.error('[PDF Generation] Failed:', pdfError);
          
          // Rollback: Mark as partially signed instead of fully signed
          const rollbackUpdates: Partial<Receipt> = {
            status: 'partially_signed',
            signedAt: undefined,
          };
          await updateReceipt(id, rollbackUpdates);
          
          return NextResponse.json(
            { 
              success: false, 
              error: 'PDF generation failed. Please try again.',
              code: 'PDF_GENERATION_FAILED',
              details: pdfError instanceof Error ? pdfError.message : 'Unknown error'
            },
            { status: 500 }
          );
        }
      }
    } else {
      // LEGACY RECEIPT FLOW: Use image
      if (!receiptImage) {
        return NextResponse.json(
          { success: false, error: 'Receipt image is required for legacy receipts' },
          { status: 400 }
        );
      }

      // 🔒 SECURITY: Prevent signing an already signed receipt
      if (receipt.status === 'signed') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'This receipt has already been signed',
            code: 'ALREADY_SIGNED'
          },
          { status: 403 }
        );
      }

      const updates: Partial<Receipt> = {
        status: 'signed',
        signedAt: Date.now(),
      };

      if (signatureNguoiNhan) {
        updates.signatureNguoiNhan = signatureNguoiNhan;
      }
      if (signatureNguoiGui) {
        updates.signatureNguoiGui = signatureNguoiGui;
      }

      updatedReceipt = (await updateReceipt(id, updates))!;
    }

    if (!updatedReceipt) {
      return NextResponse.json(
        { success: false, error: 'Failed to update receipt' },
        { status: 500 }
      );
    }

    // Send notifications (include customer email if available)
    const notificationResults = await Promise.allSettled([
      sendEmailNotification(updatedReceipt, pdfBuffer, receiptImage, customerEmail),
      sendTelegramNotification(updatedReceipt, pdfBuffer, receiptImage),
    ]);

    const emailSuccess = notificationResults[0].status === 'fulfilled';
    const telegramSuccess = notificationResults[1].status === 'fulfilled';

    console.log('Sign document:', id);
    console.log('Type:', isContract ? 'CONTRACT' : 'RECEIPT');
    console.log('Email notification:', emailSuccess ? 'SUCCESS' : `FAILED - ${(notificationResults[0] as PromiseRejectedResult).reason}`);
    console.log('Telegram notification:', telegramSuccess ? 'SUCCESS' : `FAILED - ${(notificationResults[1] as PromiseRejectedResult).reason}`);

    return NextResponse.json({
      success: true,
      receipt: updatedReceipt,
      hasPDF: !!pdfBuffer,
      notifications: {
        email: emailSuccess,
        telegram: telegramSuccess,
      },
    });
  } catch (error) {
    console.error('Error signing receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to sign receipt' 
      },
      { status: 500 }
    );
  }
}
