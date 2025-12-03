import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// SMTP Configuration - Sử dụng Environment Variables trong production
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USERNAME || process.env.EMAIL_USER || 'cuongbc.work@gmail.com',
    pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || 'sundbytucuvaqsin',
  },
};

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_USER || 'cuongbc.work@gmail.com';

// Legacy format - gửi PDF đính kèm
interface SendPdfEmailRequest {
  pdfBase64: string;
  recipientEmail: string;
  subject?: string;
  formData?: {
    hoTenNguoiNop?: string;
    donVi?: string;
    lyDoNop?: string;
    soTien?: number;
    bangChu?: string;
    hoTenNguoiNhan?: string;
  };
}

// New format - gửi link mời ký (từ Dashboard)
interface SendInvitationEmailRequest {
  to: string;
  subject?: string;
  receiptId?: string;
  receiptInfo?: Record<string, unknown>;
  signUrl: string;
  // Signature status to determine who needs to sign
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
}

type SendEmailRequest = SendPdfEmailRequest | SendInvitationEmailRequest;

// Helper: Format currency
function formatCurrency(amount?: number): string {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

// Helper: Get field from receiptInfo (supports both legacy and new format)
function getField(receiptInfo: Record<string, unknown> | undefined, fieldId: string): string {
  if (!receiptInfo) return '';
  
  // Check new format (fields array)
  if (Array.isArray(receiptInfo.fields)) {
    const field = receiptInfo.fields.find((f: { id: string; value: string }) => f.id === fieldId);
    if (field) return field.value || '';
  }
  
  // Legacy format (direct properties)
  const value = receiptInfo[fieldId];
  return value?.toString() || '';
}

// Helper: Build email rows for all dynamic fields
function buildFieldRows(receiptInfo: Record<string, unknown> | undefined): string {
  if (!receiptInfo) return '';
  
  // If new format with fields array
  if (Array.isArray(receiptInfo.fields)) {
    return receiptInfo.fields.map((field: { id: string; label: string; value: string; type: string }) => {
      if (!field.value) return '';
      
      if (field.type === 'money') {
        const amount = parseInt(field.value.replace(/\D/g, '')) || 0;
        return `<tr style="background: #faf6eb;"><td style="padding: 12px 8px; color: #2a2520; font-weight: bold;">${field.label}</td><td style="padding: 12px 8px; font-weight: bold; color: #b8963e; font-size: 18px;">${formatCurrency(amount)}</td></tr>`;
      }
      
      // For textarea or text fields
      const style = field.type === 'textarea' 
        ? 'padding: 8px 0; color: #2a2520; white-space: pre-wrap;'
        : 'padding: 8px 0; color: #2a2520;';
      
      return `<tr><td style="padding: 8px 0; color: #8a8279; vertical-align: top;">${field.label}</td><td style="${style}">${field.value}</td></tr>`;
    }).filter(Boolean).join('');
  }
  
  // Legacy format - return empty (handled separately in old code path)
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    
    // Detect which format is being used
    const isInvitationFormat = 'to' in body && 'signUrl' in body;
    const isPdfFormat = 'pdfBase64' in body && 'recipientEmail' in body;
    
    if (isInvitationFormat) {
      // Handle invitation email (from Dashboard)
      const { to, subject, receiptInfo, signUrl, signatureNguoiNhan, signatureNguoiGui } = body as SendInvitationEmailRequest;
      
      if (!to || !signUrl) {
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
      
      const hoTenNguoiNhan = getField(receiptInfo, 'hoTenNguoiNhan');
      const hoTenNguoiGui = getField(receiptInfo, 'hoTenNguoiGui');
      
      // Determine who needs to sign based on missing signatures
      const hasNhanSig = signatureNguoiNhan && signatureNguoiNhan.startsWith('data:');
      const hasGuiSig = signatureNguoiGui && signatureNguoiGui.startsWith('data:');
      
      let recipientName = 'Quý khách';
      if (!hasNhanSig && !hasGuiSig) {
        // Both missing - prefer hoTenNguoiGui (người sẽ ký), nếu không có thì dùng hoTenNguoiNhan
        recipientName = (hoTenNguoiGui && hoTenNguoiGui.trim()) || (hoTenNguoiNhan && hoTenNguoiNhan.trim()) || 'Quý khách';
      } else if (!hasNhanSig) {
        // Missing nguoiNhan signature - send to nguoiNhan
        recipientName = (hoTenNguoiNhan && hoTenNguoiNhan.trim()) || 'Quý khách';
      } else if (!hasGuiSig) {
        // Missing nguoiGui signature - send to nguoiGui  
        recipientName = (hoTenNguoiGui && hoTenNguoiGui.trim()) || 'Quý khách';
      }
      const donViNguoiNhan = getField(receiptInfo, 'donViNguoiNhan');
      const donViNguoiGui = getField(receiptInfo, 'donViNguoiGui');
      const lyDoNop = getField(receiptInfo, 'lyDoNop');
      const soTienStr = getField(receiptInfo, 'soTien');
      const soTien = parseInt(soTienStr.replace(/\D/g, '')) || 0;
      
      const senderName = donViNguoiNhan || 'Biên nhận điện tử';
      
      // Check if using new format with dynamic fields
      const isNewFormat = receiptInfo && Array.isArray(receiptInfo.fields);
      const dynamicFieldRows = isNewFormat ? buildFieldRows(receiptInfo) : '';
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #2a2520; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #faf8f5;">
          <div style="background: #ffffff; border: 1px solid #e8e4dc; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(42, 37, 32, 0.06);">
            
            <div style="padding: 28px 24px; text-align: center; border-bottom: 1px solid #e8e4dc; background: #fdfcfa;">
              <h1 style="font-family: Georgia, serif; font-size: 26px; font-weight: normal; color: #2a2520; margin: 0 0 6px 0;">
                Biên Nhận Điện Tử
              </h1>
              <p style="font-size: 12px; color: #8a8279; margin: 0; text-transform: uppercase;">
                Yêu cầu ký xác nhận
              </p>
            </div>
            
            <div style="padding: 32px 28px;">
              <p style="font-size: 17px; margin-bottom: 24px; color: #2a2520;">
                Kính gửi <strong style="color: #2a2520;">${recipientName}</strong>,
              </p>
              
              <p style="color: #5c574f; margin-bottom: 28px; font-size: 16px;">
                Chúng tôi xin gửi đến Quý khách thông tin biên nhận tiền và kính mời Quý khách ký xác nhận.
              </p>
              
              ${receiptInfo ? `
              <div style="background: #fdfcfa; border: 1px solid #e8e4dc; border-left: 3px solid #c9a962; padding: 20px; border-radius: 4px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px 0; color: #2a2520; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                  Thông tin biên nhận
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  ${isNewFormat ? dynamicFieldRows : `
                  ${hoTenNguoiNhan ? `<tr><td style="padding: 8px 0; color: #8a8279; width: 130px;">Người nhận tiền</td><td style="padding: 8px 0; color: #2a2520; font-weight: bold;">${hoTenNguoiNhan}</td></tr>` : ''}
                  ${donViNguoiNhan ? `<tr><td style="padding: 8px 0; color: #8a8279;">Đơn vị</td><td style="padding: 8px 0; color: #2a2520;">${donViNguoiNhan}</td></tr>` : ''}
                  ${hoTenNguoiGui ? `<tr><td style="padding: 8px 0; color: #8a8279;">Người gửi tiền</td><td style="padding: 8px 0; color: #2a2520; font-weight: bold;">${hoTenNguoiGui}</td></tr>` : ''}
                  ${hoTenNguoiGui ? `<tr><td style="padding: 8px 0; color: #8a8279;">Đơn vị</td><td style="padding: 8px 0; color: #2a2520;">${donViNguoiGui}</td></tr>` : ''}
                  ${lyDoNop ? `<tr><td style="padding: 8px 0; color: #8a8279; vertical-align: top;">Lý do</td><td style="padding: 8px 0; color: #2a2520; white-space: pre-wrap;">${lyDoNop}</td></tr>` : ''}
                  ${soTien ? `<tr style="background: #faf6eb;"><td style="padding: 12px 8px; color: #2a2520; font-weight: bold;">Số tiền</td><td style="padding: 12px 8px; font-weight: bold; color: #b8963e; font-size: 18px;">${formatCurrency(soTien)}</td></tr>` : ''}
                  `}
                </table>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #5c574f; margin-bottom: 20px; font-size: 15px;">
                  Vui lòng nhấn vào nút bên dưới để xem và ký xác nhận biên nhận:
                </p>
                <a href="${signUrl}" 
                   style="display: inline-block; background: #2a2520; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px;">
                  Ký xác nhận tại đây
                </a>
              </div>
              
              <div style="background: #faf6eb; border: 1px solid #e8dcc4; padding: 14px 16px; border-radius: 4px; margin-top: 24px;">
                <p style="margin: 0; color: #8a7a5c; font-size: 13px;">
                  <strong>Lưu ý:</strong> Link ký xác nhận này chỉ dành riêng cho Quý khách. 
                  Vui lòng không chia sẻ cho người khác.
                </p>
              </div>
            </div>
            
            <div style="border-top: 1px solid #e8e4dc; padding: 20px; background: #fdfcfa; text-align: center;">
              <p style="color: #a8a29e; font-size: 12px; margin: 0;">
                Email này được gửi tự động từ hệ thống Biên nhận điện tử
              </p>
              <p style="color: #c4c0b8; font-size: 11px; margin: 12px 0 0 0;">
                ${new Date().getFullYear()} ${senderName}
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const mailOptions = {
        from: `"${senderName}" <${process.env.EMAIL_USER}>`,
        to,
        subject: subject || 'Yêu cầu ký xác nhận biên nhận',
        html: emailHtml,
      };
      
      await transporter.sendMail(mailOptions);
      console.log(`Invitation email sent to ${to}`);
      
      return NextResponse.json({
        success: true,
        message: 'Email đã được gửi thành công!',
      });
      
    } else if (isPdfFormat) {
      // Handle PDF attachment email (legacy)
      const { pdfBase64, recipientEmail, subject, formData } = body as SendPdfEmailRequest;
      
      if (!pdfBase64 || !recipientEmail) {
        return NextResponse.json(
          { error: 'Missing required fields: pdfBase64 and recipientEmail are required' },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport(SMTP_CONFIG);

      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
                                  .replace(/^data:image\/png;base64,/, '');
      const pdfBuffer = Buffer.from(base64Data, 'base64');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #2a2520; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #faf8f5;">
          <div style="background: #ffffff; border: 1px solid #e8e4dc; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(42, 37, 32, 0.06);">
            <div style="padding: 24px; text-align: center; border-bottom: 1px solid #e8e4dc; background: #fdfcfa;">
              <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: normal; color: #2a2520; margin: 0;">
                Giấy Biên Nhận Tiền
              </h1>
            </div>
            <div style="padding: 32px 28px;">
              <p style="font-size: 17px; margin-bottom: 24px; color: #2a2520;">Xin chào,</p>
              <p style="color: #5c574f; margin-bottom: 28px; font-size: 16px;">
                Đính kèm là giấy biên nhận tiền với thông tin như sau:
              </p>
              ${formData ? `
              <div style="background: #fdfcfa; border: 1px solid #e8e4dc; border-left: 3px solid #b8963e; padding: 18px; border-radius: 4px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 10px 0; color: #8a8279; width: 110px; border-bottom: 1px solid #e8e4dc;">Người nộp</td><td style="padding: 10px 0; color: #2a2520; font-weight: bold; border-bottom: 1px solid #e8e4dc;">${formData.hoTenNguoiNop || 'N/A'}</td></tr>
                  <tr><td style="padding: 10px 0; color: #8a8279; border-bottom: 1px solid #e8e4dc;">Đơn vị</td><td style="padding: 10px 0; color: #2a2520; border-bottom: 1px solid #e8e4dc;">${formData.donVi || 'N/A'}</td></tr>
                  <tr><td style="padding: 10px 0; color: #8a8279; border-bottom: 1px solid #e8e4dc;">Lý do nộp</td><td style="padding: 10px 0; color: #2a2520; border-bottom: 1px solid #e8e4dc;">${formData.lyDoNop || 'N/A'}</td></tr>
                  <tr style="background: #faf6eb;"><td style="padding: 12px 8px; color: #2a2520; font-weight: bold;">Số tiền</td><td style="padding: 12px 8px; font-weight: bold; color: #b8963e; font-size: 17px;">${formData.soTien ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(formData.soTien) : 'N/A'}</td></tr>
                  <tr><td style="padding: 10px 0; color: #8a8279; border-bottom: 1px solid #e8e4dc;">Bằng chữ</td><td style="padding: 10px 0; color: #5c574f; font-style: italic; border-bottom: 1px solid #e8e4dc;">${formData.bangChu || 'N/A'}</td></tr>
                  <tr><td style="padding: 10px 0; color: #8a8279;">Người nhận</td><td style="padding: 10px 0; color: #2a2520; font-weight: bold;">${formData.hoTenNguoiNhan || 'N/A'}</td></tr>
                </table>
              </div>
              ` : ''}
              <p style="color: #5c574f; font-size: 15px;">Vui lòng xem file PDF đính kèm để biết thêm chi tiết.</p>
            </div>
            <div style="border-top: 1px solid #e8e4dc; padding: 16px; background: #fdfcfa; text-align: center;">
              <p style="color: #a8a29e; font-size: 12px; margin: 0;">Email này được gửi tự động từ hệ thống Giấy Biên Nhận Tiền</p>
            </div>
          </div>
        </body>
        </html>
      `;

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

      await transporter.sendMail(mailOptions);
      console.log('PDF Email sent to:', recipientEmail);

      return NextResponse.json({
        success: true,
        message: 'Email đã được gửi thành công!',
      });
      
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Không thể gửi email' 
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
  });
}
