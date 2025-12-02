import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// SMTP Configuration - Sử dụng Environment Variables trong production
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USERNAME || 'cuongbc.work@gmail.com',
    pass: process.env.SMTP_PASSWORD || 'sundbytucuvaqsin',
  },
};

const FROM_EMAIL = process.env.FROM_EMAIL || 'cuongbc.work@gmail.com';

interface SendEmailRequest {
  pdfBase64: string;
  recipientEmail: string;
  subject: string;
  formData: {
    hoTenNguoiNop: string;
    donVi: string;
    lyDoNop: string;
    soTien: number;
    bangChu: string;
    hoTenNguoiNhan: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const { pdfBase64, recipientEmail, subject, formData } = body;

    // Validate required fields
    if (!pdfBase64 || !recipientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: pdfBase64 and recipientEmail are required' },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    // Extract base64 data (remove data:application/pdf;base64, prefix if exists)
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
                                .replace(/^data:image\/png;base64,/, '');

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    // Email content
    const emailHtml = `
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
            <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: normal; color: #2a2520; margin: 0;">
              Giấy Biên Nhận Tiền
            </h1>
          </div>
          
          <!-- Body -->
          <div style="padding: 32px 28px;">
            <p style="font-size: 17px; margin-bottom: 24px; color: #2a2520;">
              Xin chào,
            </p>
            
            <p style="color: #5c574f; margin-bottom: 28px; font-size: 16px;">
              Đính kèm là giấy biên nhận tiền với thông tin như sau:
            </p>
            
            <!-- Receipt Info Box -->
            <div style="background: #fdfcfa; border: 1px solid #e8e4dc; border-left: 3px solid #b8963e; padding: 18px; border-radius: 4px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 0; color: #8a8279; width: 110px; border-bottom: 1px solid #e8e4dc;">Người nộp</td>
                  <td style="padding: 10px 0; color: #2a2520; font-weight: bold; border-bottom: 1px solid #e8e4dc;">${formData.hoTenNguoiNop || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #8a8279; border-bottom: 1px solid #e8e4dc;">Đơn vị</td>
                  <td style="padding: 10px 0; color: #2a2520; border-bottom: 1px solid #e8e4dc;">${formData.donVi || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #8a8279; border-bottom: 1px solid #e8e4dc;">Lý do nộp</td>
                  <td style="padding: 10px 0; color: #2a2520; border-bottom: 1px solid #e8e4dc;">${formData.lyDoNop || 'N/A'}</td>
                </tr>
                <tr style="background: #faf6eb;">
                  <td style="padding: 12px 8px; color: #2a2520; font-weight: bold;">Số tiền</td>
                  <td style="padding: 12px 8px; font-weight: bold; color: #b8963e; font-size: 17px;">
                    ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(formData.soTien)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #8a8279; border-bottom: 1px solid #e8e4dc;">Bằng chữ</td>
                  <td style="padding: 10px 0; color: #5c574f; font-style: italic; border-bottom: 1px solid #e8e4dc;">${formData.bangChu || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #8a8279;">Người nhận</td>
                  <td style="padding: 10px 0; color: #2a2520; font-weight: bold;">${formData.hoTenNguoiNhan || 'N/A'}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #5c574f; font-size: 15px;">
              Vui lòng xem file PDF đính kèm để biết thêm chi tiết.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="border-top: 1px solid #e8e4dc; padding: 16px; background: #fdfcfa; text-align: center;">
            <p style="color: #a8a29e; font-size: 12px; margin: 0;">
              Email này được gửi tự động từ hệ thống Giấy Biên Nhận Tiền
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const mailOptions = {
      from: `"Giấy Biên Nhận" <${FROM_EMAIL}>`,
      to: recipientEmail,
      subject: subject || 'Giấy Biên Nhận Tiền',
      html: emailHtml,
      attachments: [
        {
          filename: `bien-nhan-${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    // NOTE: Uncomment the following lines when you want to actually send emails
    // await transporter.sendMail(mailOptions);

    // For development, just log and return success
    console.log('Email would be sent to:', recipientEmail);
    console.log('Mail options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      attachmentSize: pdfBuffer.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Email prepared successfully (SMTP not connected in development)',
      debug: {
        recipient: recipientEmail,
        subject: subject,
        attachmentSize: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
      },
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'send-email',
    timestamp: new Date().toISOString(),
    config: {
      smtpHost: SMTP_CONFIG.host,
      smtpPort: SMTP_CONFIG.port,
      fromEmail: FROM_EMAIL,
    },
  });
}
