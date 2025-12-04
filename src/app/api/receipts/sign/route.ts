import { NextRequest, NextResponse } from 'next/server';
import { getReceipt, updateReceipt, Receipt, DynamicField } from '@/lib/kv';
import nodemailer from 'nodemailer';

interface SignReceiptRequest {
  id: string;
  receiptImage: string; // Base64 PNG image captured from client
  signatureNguoiNhan?: string; // Optional: signature preview for storage
  signatureNguoiGui?: string;
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

// Send Email notification with the captured receipt image
async function sendEmailNotification(receipt: Receipt, receiptImageBase64: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const info = extractReceiptInfo(receipt);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000';
  const viewUrl = `${baseUrl}/?id=${receipt.id}`;
  
  // Convert base64 data URL to buffer
  const base64Data = receiptImageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  const mailOptions = {
    from: `"Hệ thống Biên lai điện tử" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `📝 Biên lai #${receipt.id} - ${info.hoTenNguoiGui || 'Khách hàng'} đã ký xác nhận`,
    attachments: [
      {
        filename: `bien-lai-${receipt.id}.png`,
        content: imageBuffer,
        cid: 'receipt_image',
      },
    ],
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
              ✅ BIÊN LAI ĐÃ ĐƯỢC KÝ XÁC NHẬN
            </h1>
            <p style="font-size: 14px; color: #666; margin: 0;">
              Mã biên lai: <strong style="color: #c9a227;">${receipt.id}</strong>
            </p>
          </div>
          
          <!-- Quick Info -->
          <div style="padding: 20px 24px; background: #fafafa; border-bottom: 1px solid #eee;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
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
              <tr>
                <td style="padding: 8px 0; color: #666;">Thời gian ký:</td>
                <td style="padding: 8px 0; color: #1a1a1a;">${new Date().toLocaleString('vi-VN')}</td>
              </tr>
            </table>
          </div>
          
          <!-- Receipt Image -->
          <div style="padding: 24px; text-align: center;">
            <p style="font-size: 13px; color: #888; margin: 0 0 16px 0;">📄 Hình ảnh biên lai đã ký:</p>
            <img src="cid:receipt_image" alt="Biên lai đã ký" style="max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>

          <!-- View Link -->
          <div style="padding: 20px 24px; text-align: center; border-top: 1px solid #eee;">
            <a href="${viewUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
              Xem biên lai trực tuyến →
            </a>
          </div>
          
          <!-- Footer -->
          <div style="padding: 16px 24px; background: #fafafa; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #888; font-size: 12px; margin: 0;">
              Email tự động từ <strong>Hệ thống Biên lai điện tử</strong>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// Send Telegram notification with the captured receipt image
async function sendTelegramNotification(receipt: Receipt, receiptImageBase64: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Telegram credentials not configured');
  }

  const info = extractReceiptInfo(receipt);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000';
  const viewUrl = `${baseUrl}/?id=${receipt.id}`;

  // Convert base64 data URL to buffer
  const base64Data = receiptImageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');
  
  // Create caption
  const caption = `📝 *BIÊN LAI #${receipt.id}*
━━━━━━━━━━━━━━
👤 *Người gửi:* ${info.hoTenNguoiGui || 'N/A'}
👤 *Người nhận:* ${info.hoTenNguoiNhan || 'N/A'}
💰 *Số tiền:* ${formatCurrency(info.soTien)}
✅ *Đã ký xác nhận*
⏰ ${new Date().toLocaleString('vi-VN')}
━━━━━━━━━━━━━━
🔗 [Xem chi tiết](${viewUrl})`;

  // Send photo with caption using multipart form data
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'receipt.png');
  formData.append('caption', caption);
  formData.append('parse_mode', 'Markdown');

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SignReceiptRequest = await request.json();
    const { id, receiptImage, signatureNguoiNhan, signatureNguoiGui } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    if (!receiptImage) {
      return NextResponse.json(
        { success: false, error: 'Receipt image is required' },
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

    // Update receipt status and signatures
    const updates: Partial<Receipt> = {
      status: 'signed',
      signedAt: Date.now(),
    };

    // Store signature previews if provided
    if (signatureNguoiNhan) {
      updates.signatureNguoiNhan = signatureNguoiNhan;
    }
    if (signatureNguoiGui) {
      updates.signatureNguoiGui = signatureNguoiGui;
    }

    const updatedReceipt = await updateReceipt(id, updates);
    if (!updatedReceipt) {
      return NextResponse.json(
        { success: false, error: 'Failed to update receipt' },
        { status: 500 }
      );
    }

    // Send notifications with the captured image
    const notificationResults = await Promise.allSettled([
      sendEmailNotification(updatedReceipt, receiptImage),
      sendTelegramNotification(updatedReceipt, receiptImage),
    ]);

    const emailSuccess = notificationResults[0].status === 'fulfilled';
    const telegramSuccess = notificationResults[1].status === 'fulfilled';

    console.log('Sign receipt:', id);
    console.log('Email notification:', emailSuccess ? 'SUCCESS' : `FAILED - ${(notificationResults[0] as PromiseRejectedResult).reason}`);
    console.log('Telegram notification:', telegramSuccess ? 'SUCCESS' : `FAILED - ${(notificationResults[1] as PromiseRejectedResult).reason}`);

    return NextResponse.json({
      success: true,
      receipt: updatedReceipt,
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
