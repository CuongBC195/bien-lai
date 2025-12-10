import { NextRequest, NextResponse } from 'next/server';
import { getReceipt, updateReceipt, signReceipt, Receipt, DynamicField, SignatureData } from '@/lib/kv';
import nodemailer from 'nodemailer';
import { generateContractPDF, generatePDFFilename } from '@/lib/pdf-generator';

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
async function sendEmailNotification(receipt: Receipt, pdfBuffer?: Buffer, receiptImageBase64?: string): Promise<void> {
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

  const mailOptions = {
    from: `"Hệ thống ${docType} điện tử" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
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
        pdfBuffer = await generateContractPDF({
          title: receipt.document.title,
          content: receipt.document.content,
          signers: updatedReceipt.document!.signers,
          metadata: receipt.document.metadata,
          includeHeader: true,
          includeFooter: true,
        });
      }
    } else {
      // LEGACY RECEIPT FLOW: Use image
      if (!receiptImage) {
        return NextResponse.json(
          { success: false, error: 'Receipt image is required for legacy receipts' },
          { status: 400 }
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

    // Send notifications
    const notificationResults = await Promise.allSettled([
      sendEmailNotification(updatedReceipt, pdfBuffer, receiptImage),
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
