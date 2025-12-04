import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface ReceiptInfo {
  hoTenNguoiNhan?: string;
  hoTenNguoiGui?: string;
  donViNguoiNhan?: string;
  donViNguoiGui?: string;
  lyDoNop?: string;
  soTien?: number;
  bangChu?: string;
  ngayThang?: string;
  diaDiem?: string;
}

interface RequestBody {
  customerEmail: string;
  customerName?: string;
  receiptInfo?: ReceiptInfo;
  signingUrl: string;
}

// Helper: Format currency
function formatCurrency(amount?: number): string {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { customerEmail, customerName, receiptInfo, signingUrl } = body;

    if (!customerEmail || !signingUrl) {
      return NextResponse.json(
        { success: false, error: 'Email và link ký là bắt buộc' },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Build email content based on whether we have receiptInfo or not
    const senderName = receiptInfo?.donViNguoiNhan || 'Biên nhận điện tử';
    const subjectName = receiptInfo?.hoTenNguoiNhan || customerName || 'Biên nhận';
    
    // Simplified email when no receiptInfo
    const hasReceiptInfo = receiptInfo && (receiptInfo.hoTenNguoiNhan || receiptInfo.soTien);
    
    const receiptInfoHtml = hasReceiptInfo ? `
      <!-- Receipt Info Box -->
      <div style="background: #fdfcfa; border: 1px solid #e8e4dc; border-left: 3px solid #c9a962; padding: 20px; border-radius: 6px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #2a2520; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
          Thông tin biên nhận
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
          ${receiptInfo?.hoTenNguoiNhan ? `
          <tr>
            <td style="padding: 8px 0; color: #8a8279; width: 150px;">Họ và tên người nhận</td>
            <td style="padding: 8px 0; color: #2a2520; font-weight: 600;">${receiptInfo.hoTenNguoiNhan}</td>
          </tr>` : ''}
          ${receiptInfo?.donViNguoiNhan ? `
          <tr>
            <td style="padding: 8px 0; color: #8a8279;">Đơn vị người nhận</td>
            <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.donViNguoiNhan}</td>
          </tr>` : ''}
          ${receiptInfo?.hoTenNguoiGui ? `
          <tr>
            <td style="padding: 8px 0; color: #8a8279;">Họ và tên người gửi</td>
            <td style="padding: 8px 0; color: #2a2520; font-weight: 600;">${receiptInfo.hoTenNguoiGui}</td>
          </tr>` : ''}
          ${receiptInfo?.donViNguoiGui ? `
          <tr>
            <td style="padding: 8px 0; color: #8a8279;">Đơn vị người gửi</td>
            <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.donViNguoiGui}</td>
          </tr>` : ''}
          ${receiptInfo?.lyDoNop ? `
          <tr>
            <td style="padding: 8px 0; color: #8a8279;">Lý do nộp</td>
            <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.lyDoNop}</td>
          </tr>` : ''}
          ${receiptInfo?.soTien ? `
          <tr style="background: linear-gradient(135deg, #faf6eb 0%, #fef3c7 100%);">
            <td style="padding: 12px 8px; color: #2a2520; font-weight: 600;">Số tiền</td>
            <td style="padding: 12px 8px; font-weight: bold; color: #b8963e; font-size: 18px;">
              ${formatCurrency(receiptInfo.soTien)}
            </td>
          </tr>` : ''}
        </table>
      </div>
    ` : '';

    const mailOptions = {
      from: `"${senderName}" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Yêu cầu ký xác nhận biên nhận - ${subjectName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Arial, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #2a2520; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #faf8f5;">
          <!-- Card Container -->
          <div style="background: #ffffff; border: 1px solid #e8e4dc; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(42, 37, 32, 0.06);">
            
            <!-- Header -->
            <div style="padding: 28px 24px; text-align: center; border-bottom: 1px solid #e8e4dc; background: #fdfcfa;">
              <h1 style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 26px; font-weight: 600; color: #2a2520; margin: 0 0 6px 0;">
                Biên Nhận Điện Tử
              </h1>
              <p style="font-size: 12px; color: #8a8279; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                Yêu cầu ký xác nhận
              </p>
            </div>
            
            <!-- Body -->
            <div style="padding: 32px 28px;">
              <p style="font-size: 16px; margin-bottom: 24px; color: #2a2520;">
                Kính gửi <strong style="color: #2a2520;">${customerName || 'Quý khách'}</strong>,
              </p>
              
              <p style="color: #5c574f; margin-bottom: 28px; font-size: 15px;">
                Chúng tôi xin gửi đến Quý khách thông tin biên nhận tiền và kính mời Quý khách ký xác nhận.
              </p>
              
              ${receiptInfoHtml}
              
              <!-- CTA Section -->
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #5c574f; margin-bottom: 20px; font-size: 14px;">
                  Vui lòng nhấn vào nút bên dưới để xem và ký xác nhận biên nhận:
                </p>
                <a href="${signingUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #2a2520 0%, #3d3835 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(42, 37, 32, 0.2);">
                  ✍️ Ký xác nhận tại đây
                </a>
              </div>
              
              <!-- Notice Box -->
              <div style="background: #faf6eb; border: 1px solid #e8dcc4; padding: 14px 16px; border-radius: 6px; margin-top: 24px;">
                <p style="margin: 0; color: #8a7a5c; font-size: 13px;">
                  <strong>⚠️ Lưu ý:</strong> Link ký xác nhận này chỉ dành riêng cho Quý khách. 
                  Vui lòng không chia sẻ cho người khác.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="border-top: 1px solid #e8e4dc; padding: 20px; background: #fdfcfa; text-align: center;">
              <p style="color: #a8a29e; font-size: 12px; margin: 0;">
                Email này được gửi tự động từ hệ thống Biên nhận điện tử<br>
                <a href="mailto:${process.env.ADMIN_EMAIL}" style="color: #8a8279;">${process.env.ADMIN_EMAIL}</a>
              </p>
              <p style="color: #c4c0b8; font-size: 11px; margin: 12px 0 0 0;">
                © ${new Date().getFullYear()} ${senderName}
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log(`Invitation email sent to ${customerEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Email đã được gửi thành công!',
    });
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Không thể gửi email' 
      },
      { status: 500 }
    );
  }
}
