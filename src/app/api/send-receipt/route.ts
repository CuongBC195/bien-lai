import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface ReceiptInfo {
  hoTenNguoiNhan: string;
  hoTenNguoiGui: string;
  donViNguoiNhan: string;
  donViNguoiGui: string;
  lyDoNop: string;
  soTien: number;
  bangChu: string;
  ngayThang: string;
  diaDiem: string;
}

interface RequestBody {
  imageBase64: string;
  receiptData: ReceiptInfo;
}

// Helper: Convert base64 to Buffer
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

// Helper: Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

// Task 1: Send Email with Nodemailer
async function sendEmail(imageBuffer: Buffer, receiptInfo: ReceiptInfo): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"E-Receipt System" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Biên lai mới - ${receiptInfo.hoTenNguoiGui} đã ký xác nhận`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #2a2520; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #faf8f5;">
        <!-- Card Container -->
        <div style="background: #ffffff; border: 1px solid #e8e4dc; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(42, 37, 32, 0.06);">
          
          <!-- Header -->
          <div style="padding: 24px; text-align: center; border-bottom: 1px solid #e8e4dc; background: #fdfcfa;">
            <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: normal; color: #2a2520; margin: 0 0 4px 0;">
              Thông báo Biên lai mới
            </h1>
            <p style="font-size: 13px; color: #b8963e; margin: 0;">
              Đã ký xác nhận thành công
            </p>
          </div>
          
          <!-- Body -->
          <div style="padding: 28px;">
            <!-- Receipt Info Box -->
            <div style="background: #fdfcfa; border: 1px solid #e8e4dc; border-left: 3px solid #b8963e; padding: 18px; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 14px 0; color: #2a2520; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                Thông tin biên lai
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 7px 0; color: #8a8279; width: 110px;">Người nhận</td>
                  <td style="padding: 7px 0; color: #2a2520; font-weight: bold;">${receiptInfo.hoTenNguoiNhan || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #8a8279;">Đơn vị nhận</td>
                  <td style="padding: 7px 0; color: #2a2520;">${receiptInfo.donViNguoiNhan || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #8a8279;">Người gửi</td>
                  <td style="padding: 7px 0; color: #2a2520; font-weight: bold;">${receiptInfo.hoTenNguoiGui || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #8a8279;">Đơn vị gửi</td>
                  <td style="padding: 7px 0; color: #2a2520;">${receiptInfo.donViNguoiGui || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #8a8279;">Lý do</td>
                  <td style="padding: 7px 0; color: #2a2520;">${receiptInfo.lyDoNop || 'N/A'}</td>
                </tr>
                <tr style="background: #faf6eb;">
                  <td style="padding: 10px 6px; color: #2a2520; font-weight: bold;">Số tiền</td>
                  <td style="padding: 10px 6px; font-weight: bold; color: #b8963e; font-size: 17px;">
                    ${formatCurrency(receiptInfo.soTien)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #8a8279;">Bằng chữ</td>
                  <td style="padding: 7px 0; color: #5c574f; font-style: italic;">${receiptInfo.bangChu || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #8a8279;">Ngày</td>
                  <td style="padding: 7px 0; color: #2a2520;">${receiptInfo.ngayThang}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #8a8279;">Địa điểm</td>
                  <td style="padding: 7px 0; color: #2a2520;">${receiptInfo.diaDiem}</td>
                </tr>
              </table>
            </div>

            <p style="color: #5c574f; font-size: 14px; margin-bottom: 16px;">
              Khách hàng <strong>${receiptInfo.hoTenNguoiGui}</strong> đã ký xác nhận biên lai.
            </p>
            
            <p style="color: #8a8279; font-size: 13px; margin-bottom: 12px;">
              Ảnh biên lai đính kèm:
            </p>
            
            <img src="cid:receipt-image" alt="Biên lai" style="max-width: 100%; border: 1px solid #e8e4dc; border-radius: 4px;" />
          </div>
          
          <!-- Footer -->
          <div style="border-top: 1px solid #e8e4dc; padding: 16px; background: #fdfcfa; text-align: center;">
            <p style="color: #a8a29e; font-size: 12px; margin: 0;">
              Email tự động từ hệ thống E-Receipt<br/>
              ${new Date().toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: `bien-lai-${Date.now()}.jpg`,
        content: imageBuffer,
        cid: 'receipt-image',
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}

// Task 2: Send to Telegram
async function sendTelegram(imageBuffer: Buffer, receiptInfo: ReceiptInfo): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Telegram credentials not configured');
  }

  const caption = `BIÊN LAI MỚI

Người gửi: ${receiptInfo.hoTenNguoiGui || 'N/A'}
Đơn vị: ${receiptInfo.donViNguoiGui || 'N/A'}

Người nhận: ${receiptInfo.hoTenNguoiNhan || 'N/A'}
Đơn vị: ${receiptInfo.donViNguoiNhan || 'N/A'}

Số tiền: ${formatCurrency(receiptInfo.soTien)}
Lý do: ${receiptInfo.lyDoNop || 'N/A'}

${receiptInfo.ngayThang}
${receiptInfo.diaDiem}

Đã ký xác nhận`;

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);
  
  const uint8Array = new Uint8Array(imageBuffer);
  const blob = new Blob([uint8Array], { type: 'image/jpeg' });
  formData.append('photo', blob, 'receipt.jpg');

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
    const body: RequestBody = await request.json();
    const { imageBase64, receiptData } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: 'Image is required' },
        { status: 400 }
      );
    }

    const imageBuffer = base64ToBuffer(imageBase64);

    const results = await Promise.allSettled([
      sendEmail(imageBuffer, receiptData),
      sendTelegram(imageBuffer, receiptData),
    ]);

    const emailResult = results[0];
    const telegramResult = results[1];

    const emailSuccess = emailResult.status === 'fulfilled';
    const telegramSuccess = telegramResult.status === 'fulfilled';

    console.log('Email:', emailSuccess ? 'SUCCESS' : `FAILED - ${(emailResult as PromiseRejectedResult).reason}`);
    console.log('Telegram:', telegramSuccess ? 'SUCCESS' : `FAILED - ${(telegramResult as PromiseRejectedResult).reason}`);

    if (emailSuccess || telegramSuccess) {
      return NextResponse.json({
        success: true,
        message: 'Biên lai đã được gửi thành công!',
        details: {
          email: emailSuccess,
          telegram: telegramSuccess,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Không thể gửi thông báo',
        details: {
          email: emailSuccess ? null : (emailResult as PromiseRejectedResult).reason?.message,
          telegram: telegramSuccess ? null : (telegramResult as PromiseRejectedResult).reason?.message,
        },
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error in send-receipt API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
