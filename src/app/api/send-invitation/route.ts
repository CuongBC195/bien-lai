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

interface DocumentData {
  type?: 'receipt' | 'contract';
  title?: string;
  contractNumber?: string;
  signers?: any[];
}

interface RequestBody {
  customerEmail: string;
  customerName?: string;
  receiptInfo?: ReceiptInfo;
  documentData?: DocumentData; // NEW: For contracts
  receiptId?: string; // NEW: Receipt/Contract ID
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
    const { customerEmail, customerName, receiptInfo, documentData, receiptId, signingUrl } = body;

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

    // Determine document type and format subject/sender
    const isContract = documentData?.type === 'contract' || !!documentData?.title;
    const docTitle = documentData?.title || 'Văn bản';
    const docId = receiptId || 'N/A';

    const senderName = isContract ? 'Hợp đồng điện tử' : (receiptInfo?.donViNguoiNhan || 'Biên nhận điện tử');
    const subjectName = isContract
      ? `${docTitle} - ${docId}`
      : (receiptInfo?.hoTenNguoiNhan || customerName || 'Biên nhận');

    // Simplified email when no receiptInfo
    const hasReceiptInfo = receiptInfo && (receiptInfo.hoTenNguoiNhan || receiptInfo.soTien);

    const receiptInfoHtml = hasReceiptInfo ? `
      <div style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          Thông tin biên nhận
        </h3>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size: 14px;">
          ${receiptInfo?.hoTenNguoiNhan ? `
          <tr>
            <td style="padding: 10px 0; color: #6b7280; width: 150px; vertical-align: top;">Họ và tên người nhận</td>
            <td style="padding: 10px 0; color: #1a1a1a; font-weight: 600; vertical-align: top;">${receiptInfo.hoTenNguoiNhan}</td>
          </tr>` : ''}
          ${receiptInfo?.donViNguoiNhan ? `
          <tr>
            <td style="padding: 10px 0; color: #6b7280; vertical-align: top;">Đơn vị người nhận</td>
            <td style="padding: 10px 0; color: #1a1a1a; vertical-align: top;">${receiptInfo.donViNguoiNhan}</td>
          </tr>` : ''}
          ${receiptInfo?.hoTenNguoiGui ? `
          <tr>
            <td style="padding: 10px 0; color: #6b7280; vertical-align: top;">Họ và tên người gửi</td>
            <td style="padding: 10px 0; color: #1a1a1a; font-weight: 600; vertical-align: top;">${receiptInfo.hoTenNguoiGui}</td>
          </tr>` : ''}
          ${receiptInfo?.donViNguoiGui ? `
          <tr>
            <td style="padding: 10px 0; color: #6b7280; vertical-align: top;">Đơn vị người gửi</td>
            <td style="padding: 10px 0; color: #1a1a1a; vertical-align: top;">${receiptInfo.donViNguoiGui}</td>
          </tr>` : ''}
          ${receiptInfo?.lyDoNop ? `
          <tr>
            <td style="padding: 10px 0; color: #6b7280; vertical-align: top;">Lý do nộp</td>
            <td style="padding: 10px 0; color: #1a1a1a; vertical-align: top;">${receiptInfo.lyDoNop}</td>
          </tr>` : ''}
          ${receiptInfo?.soTien ? `
          <tr>
            <td style="padding: 12px 0; color: #1a1a1a; font-weight: 600; vertical-align: top;">Số tiền</td>
            <td style="padding: 12px 0; font-weight: 700; color: #1a1a1a; font-size: 18px; vertical-align: top;">
              ${formatCurrency(receiptInfo.soTien)}
            </td>
          </tr>` : ''}
        </table>
      </div>
    ` : '';

    // Plain text version for spam prevention
    const plainText = `
${isContract ? 'Hợp đồng điện tử' : 'Biên nhận điện tử'} - Yêu cầu ký xác nhận

Kính gửi ${customerName || 'Quý khách'},

${isContract
        ? `Chúng tôi xin gửi đến Quý khách ${docTitle} (Mã: ${docId}) và kính mời Quý khách xem xét và ký xác nhận.`
        : 'Chúng tôi xin gửi đến Quý khách thông tin biên nhận tiền và kính mời Quý khách ký xác nhận.'}

${hasReceiptInfo ? `
Thông tin biên nhận:
${receiptInfo?.hoTenNguoiNhan ? `Người nhận: ${receiptInfo.hoTenNguoiNhan}` : ''}
${receiptInfo?.donViNguoiNhan ? `Đơn vị: ${receiptInfo.donViNguoiNhan}` : ''}
${receiptInfo?.hoTenNguoiGui ? `Người gửi: ${receiptInfo.hoTenNguoiGui}` : ''}
${receiptInfo?.donViNguoiGui ? `Đơn vị: ${receiptInfo.donViNguoiGui}` : ''}
${receiptInfo?.lyDoNop ? `Lý do: ${receiptInfo.lyDoNop}` : ''}
${receiptInfo?.soTien ? `Số tiền: ${formatCurrency(receiptInfo.soTien)}` : ''}
` : ''}

Vui lòng nhấn vào link bên dưới để xem và ký xác nhận:
${signingUrl}

Lưu ý: Link ký xác nhận này chỉ dành riêng cho Quý khách. Vui lòng không chia sẻ cho người khác.

Email này được gửi tự động từ hệ thống ${senderName}
${process.env.ADMIN_EMAIL ? `Liên hệ: ${process.env.ADMIN_EMAIL}` : ''}
    `.trim();

    const mailOptions = {
      from: `"${senderName}" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: isContract
        ? `Yêu cầu ký xác nhận hợp đồng - ${docId}`
        : `Yêu cầu ký xác nhận biên nhận - ${subjectName}`,
      text: plainText, // Plain text version to avoid spam
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Yêu cầu ký xác nhận ${isContract ? 'hợp đồng' : 'biên nhận'}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); padding: 40px 20px;">
            <tr>
              <td align="center">
                <!-- Main Card Container -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);">
                  
                  <!-- Header with Glass Effect -->
                  <tr>
                    <td style="padding: 32px 28px; text-align: center; background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(0, 0, 0, 0.08);">
                      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px;">
                        ${isContract ? 'Hợp đồng điện tử' : 'Biên nhận điện tử'}
                      </h1>
                      <p style="margin: 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">
                        Yêu cầu ký xác nhận
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 28px;">
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                        Kính gửi <strong style="color: #1a1a1a;">${customerName || 'Quý khách'}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 15px; line-height: 1.7;">
                        ${isContract
          ? `Chúng tôi xin gửi đến Quý khách <strong style="color: #1a1a1a;">${docTitle}</strong> (Mã: ${docId}) và kính mời Quý khách xem xét và ký xác nhận.`
          : 'Chúng tôi xin gửi đến Quý khách thông tin biên nhận tiền và kính mời Quý khách ký xác nhận.'}
                      </p>
                      
                      ${receiptInfoHtml}
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin: 32px 0;">
                        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">
                          Vui lòng nhấn vào nút bên dưới để xem và ký xác nhận:
                        </p>
                        <a href="${signingUrl}" style="display: inline-block; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); transition: all 0.2s ease;">
                          ✍️ Ký xác nhận tại đây
                        </a>
                      </div>
                      
                      <!-- Notice Box -->
                      <div style="background: rgba(255, 251, 235, 0.8); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 16px; margin-top: 24px;">
                        <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                          <strong style="color: #78350f;">⚠️ Lưu ý:</strong> Link ký xác nhận này chỉ dành riêng cho Quý khách. Vui lòng không chia sẻ cho người khác.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 28px; background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-top: 1px solid rgba(0, 0, 0, 0.08); text-align: center;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                        Email này được gửi tự động từ hệ thống ${senderName}
                        ${process.env.ADMIN_EMAIL ? `<br><a href="mailto:${process.env.ADMIN_EMAIL}" style="color: #6b7280; text-decoration: none;">${process.env.ADMIN_EMAIL}</a>` : ''}
                      </p>
                      <p style="margin: 8px 0 0 0; color: #d1d5db; font-size: 11px;">
                        © ${new Date().getFullYear()} ${senderName}. Tất cả quyền được bảo lưu.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
