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
  customerEmail: string;
  customerName: string;
  receiptInfo: ReceiptInfo;
  signingUrl: string;
}

// Helper: Format currency
function formatCurrency(amount: number): string {
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

    const mailOptions = {
      from: `"${receiptInfo.donViNguoiNhan || 'Biên nhận điện tử'}" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Yêu cầu ký xác nhận biên nhận - ${receiptInfo.hoTenNguoiNhan || 'Biên nhận'}`,
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
            <div style="padding: 28px 24px; text-align: center; border-bottom: 1px solid #e8e4dc; background: #fdfcfa;">
              <h1 style="font-family: Georgia, serif; font-size: 26px; font-weight: normal; color: #2a2520; margin: 0 0 6px 0;">
                Biên Nhận Điện Tử
              </h1>
              <p style="font-size: 12px; color: #8a8279; margin: 0; text-transform: uppercase;">
                Yêu cầu ký xác nhận
              </p>
            </div>
            
            <!-- Body -->
            <div style="padding: 32px 28px;">
              <p style="font-size: 17px; margin-bottom: 24px; color: #2a2520;">
                Kính gửi <strong style="color: #2a2520;">${customerName || 'Quý khách'}</strong>,
              </p>
              
              <p style="color: #5c574f; margin-bottom: 28px; font-size: 16px;">
                Chúng tôi xin gửi đến Quý khách thông tin biên nhận tiền và kính mời Quý khách ký xác nhận.
              </p>
              
              <!-- Receipt Info Box -->
              <div style="background: #fdfcfa; border: 1px solid #e8e4dc; border-left: 3px solid #c9a962; padding: 20px; border-radius: 4px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px 0; color: #2a2520; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                  Thông tin biên nhận
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279; width: 130px;">Người nhận tiền</td>
                    <td style="padding: 8px 0; color: #2a2520; font-weight: bold;">${receiptInfo.hoTenNguoiNhan || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279;">Đơn vị</td>
                    <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.donViNguoiNhan || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279;">Người gửi tiền</td>
                    <td style="padding: 8px 0; color: #2a2520; font-weight: bold;">${receiptInfo.hoTenNguoiGui || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279;">Đơn vị</td>
                    <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.donViNguoiGui || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279;">Lý do</td>
                    <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.lyDoNop || 'N/A'}</td>
                  </tr>
                  <tr style="background: #faf6eb;">
                    <td style="padding: 12px 8px; color: #2a2520; font-weight: bold;">Số tiền</td>
                    <td style="padding: 12px 8px; font-weight: bold; color: #b8963e; font-size: 18px;">
                      ${formatCurrency(receiptInfo.soTien)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279;">Bằng chữ</td>
                    <td style="padding: 8px 0; color: #5c574f; font-style: italic;">${receiptInfo.bangChu || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279;">Ngày</td>
                    <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.ngayThang}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #8a8279;">Địa điểm</td>
                    <td style="padding: 8px 0; color: #2a2520;">${receiptInfo.diaDiem}</td>
                  </tr>
                </table>
              </div>
              
              <!-- CTA Section -->
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #5c574f; margin-bottom: 20px; font-size: 15px;">
                  Vui lòng nhấn vào nút bên dưới để xem và ký xác nhận biên nhận:
                </p>
                <a href="${signingUrl}" 
                   style="display: inline-block; background: #2a2520; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px;">
                  Ký xác nhận tại đây
                </a>
              </div>
              
              <!-- Notice Box -->
              <div style="background: #faf6eb; border: 1px solid #e8dcc4; padding: 14px 16px; border-radius: 4px; margin-top: 24px;">
                <p style="margin: 0; color: #8a7a5c; font-size: 13px;">
                  <strong>Lưu ý:</strong> Link ký xác nhận này chỉ dành riêng cho Quý khách. 
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
                ${new Date().getFullYear()} ${receiptInfo.donViNguoiNhan || 'E-Receipt System'}
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
