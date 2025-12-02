'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileDown, 
  Mail, 
  PenLine, 
  RotateCcw, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureModal from './SignatureModal';
import { 
  numberToVietnamese, 
  formatNumber, 
  parseFormattedNumber, 
  formatVietnameseDate,
  cn 
} from '@/lib/utils';

interface FormData {
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

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ReceiptForm() {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isModalOpenNguoiNhan, setIsModalOpenNguoiNhan] = useState(false);
  const [isModalOpenNguoiNop, setIsModalOpenNguoiNop] = useState(false);
  const [signatureNguoiNhan, setSignatureNguoiNhan] = useState<string>('');
  const [signatureNguoiNop, setSignatureNguoiNop] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<ExportStatus>('idle');
  const [currentDate, setCurrentDate] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    hoTenNguoiNhan: '',
    hoTenNguoiGui: '',
    donViNguoiNhan: '',
    donViNguoiGui: '',
    lyDoNop: '',
    soTien: 0,
    bangChu: '',
    ngayThang: '',
    diaDiem: 'TP. Cần Thơ',
  });

  // Set date on client side only to avoid hydration mismatch
  useEffect(() => {
    const now = new Date();
    setCurrentDate(formatVietnameseDate(now));
    setFormData(prev => ({
      ...prev,
      ngayThang: formatVietnameseDate(now)
    }));
  }, []);

  // Update bangChu when soTien changes
  useEffect(() => {
    if (formData.soTien > 0) {
      setFormData(prev => ({
        ...prev,
        bangChu: numberToVietnamese(prev.soTien)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        bangChu: ''
      }));
    }
  }, [formData.soTien]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === 'soTien') {
      const numericValue = parseFormattedNumber(value);
      setFormData(prev => ({
        ...prev,
        soTien: numericValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSignatureApplyNguoiNhan = (signatureDataUrl: string) => {
    setSignatureNguoiNhan(signatureDataUrl);
  };

  const handleSignatureApplyNguoiNop = (signatureDataUrl: string) => {
    setSignatureNguoiNop(signatureDataUrl);
  };

  const resetSignatureNguoiNhan = () => {
    setSignatureNguoiNhan('');
  };

  const resetSignatureNguoiNop = () => {
    setSignatureNguoiNop('');
  };

  // Helper function to get display value with N/A fallback
  const getDisplayValue = (value: string | number, isNumber = false): string => {
    if (isNumber) {
      return value && Number(value) > 0 ? formatNumber(Number(value)) : 'N/A';
    }
    return value && String(value).trim() ? String(value) : 'N/A';
  };

  const exportPDF = useCallback(async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;

    try {
      setExportStatus('loading');
      
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        ignoreElements: (element) => {
          return element.classList?.contains('print:hidden');
        },
        onclone: (clonedDoc) => {
          // Fix for unsupported color functions in html2canvas
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              color: inherit !important;
              background-color: inherit !important;
              border-color: inherit !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          // Replace empty input values with N/A
          const inputs = clonedDoc.querySelectorAll('input, textarea');
          inputs.forEach((input) => {
            const el = input as HTMLInputElement | HTMLTextAreaElement;
            if (!el.value || el.value.trim() === '') {
              el.value = 'N/A';
              el.style.color = '#374151';
            }
          });

          // Replace empty spans (like bangChu) with N/A
          const bangChuSpan = clonedDoc.querySelector('[data-field="bangChu"]');
          if (bangChuSpan && (!bangChuSpan.textContent || bangChuSpan.textContent === '...')) {
            bangChuSpan.textContent = 'N/A';
          }

          // Replace empty signature names with N/A
          const signatureNames = clonedDoc.querySelectorAll('[data-field="signatureName"]');
          signatureNames.forEach((el) => {
            if (el.textContent === '...........................') {
              el.textContent = 'N/A';
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
      
      return pdf.output('blob');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
      return null;
    }
  }, []);

  const handleExportPDF = async () => {
    const blob = await exportPDF();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bien-nhan-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleSendEmail = async () => {
    const blob = await exportPDF();
    if (!blob) return;

    setEmailStatus('loading');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pdfBase64: base64data,
            recipientEmail: 'recipient@example.com', // Can be made dynamic
            subject: 'Giấy biên nhận tiền',
            formData,
          }),
        });

        if (response.ok) {
          setEmailStatus('success');
        } else {
          setEmailStatus('error');
        }
        setTimeout(() => setEmailStatus('idle'), 2000);
      };
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailStatus('error');
      setTimeout(() => setEmailStatus('idle'), 2000);
    }
  };

  const getButtonContent = (status: ExportStatus, defaultText: string, Icon: React.ElementType) => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang xử lý...
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Thành công!
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            Có lỗi!
          </>
        );
      default:
        return (
          <>
            <Icon className="w-4 h-4" />
            {defaultText}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        

        {/* Receipt Paper */}
        <div 
          ref={receiptRef}
          className="bg-white shadow-2xl mx-auto"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '20mm 25mm',
            fontFamily: '"Times New Roman", Tinos, serif',
          }}
        >
          {/* Header */}
          <header className="text-center mb-8">
            <h2 className="text-base font-bold tracking-wide">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </h2>
            <p className="text-base mt-1">
              <span style={{ textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                Độc lập - Tự do - Hạnh phúc
              </span>
            </p>
            <div className="mt-8 text-gray-400">
              -----------------------
            </div>
            <h1 className="text-2xl font-bold mt-6 tracking-wider">
              GIẤY BIÊN NHẬN TIỀN
            </h1>
          </header>

          {/* Body */}
          <div className="space-y-5 text-base leading-relaxed">
            {/* Họ và tên người nhận */}
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người nhận:</span>
              <input
                type="text"
                name="hoTenNguoiNhan"
                value={formData.hoTenNguoiNhan}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-blue-500 outline-none px-2 py-1 bg-transparent"
                placeholder="Nguyễn Văn A"
              />
            </div>
            {/* Đơn vị người nhận */}
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người nhận:</span>
              <input
                type="text"
                name="donViNguoiNhan"
                value={formData.donViNguoiNhan}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-blue-500 outline-none px-2 py-1 bg-transparent"
                placeholder="Công ty TNHH ABC"
              />
            </div>

            {/* Họ và tên người gửi */}
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người gửi:</span>
              <input
                type="text"
                name="hoTenNguoiGui"
                value={formData.hoTenNguoiGui}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-blue-500 outline-none px-2 py-1 bg-transparent"
                placeholder="Trần Văn B"
              />
            </div>

            {/* Đơn vị người gửi */}
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người gửi:</span>
              <input
                type="text"
                name="donViNguoiGui"
                value={formData.donViNguoiGui}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-blue-500 outline-none px-2 py-1 bg-transparent"
                placeholder="Công ty XYZ"
              />
            </div>

            {/* Lý do nộp */}
            <div className="flex items-start gap-2">
              <span className="whitespace-nowrap pt-1">Lý do nộp:</span>
              <textarea
                name="lyDoNop"
                value={formData.lyDoNop}
                onChange={handleInputChange}
                rows={2}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-blue-500 outline-none px-2 py-1 bg-transparent resize-none overflow-hidden"
                placeholder="Thanh toán hợp đồng số..."
                style={{ minHeight: '2.5em' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
            </div>

            {/* Số tiền */}
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Số tiền:</span>
              <input
                type="text"
                name="soTien"
                value={formData.soTien > 0 ? formatNumber(formData.soTien) : ''}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-blue-500 outline-none px-2 py-1 bg-transparent"
                placeholder="0"
              />
              <span className="whitespace-nowrap">VNĐ</span>
            </div>

            {/* Bằng chữ */}
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Bằng chữ:</span>
              <span data-field="bangChu" className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 italic text-gray-700 min-h-[1.5em]">
                {formData.bangChu || '...'}
              </span>
            </div>
          </div>

          {/* Footer - Date and Signature */}
          <footer className="mt-16">
            {/* Date line */}
            <div className="text-right italic mb-10">
              <span>{formData.diaDiem}, </span>
              <input
                type="text"
                name="diaDiem"
                value={formData.diaDiem}
                onChange={handleInputChange}
                className="border-b border-dotted border-transparent hover:border-gray-400 focus:border-blue-500 outline-none bg-transparent w-32 text-center hidden"
              />
              <span>{currentDate}</span>
            </div>

            {/* Signature sections */}
            <div className="grid grid-cols-2 gap-8 text-center">
              {/* Người nộp tiền */}
              <div>
                <p className="font-bold mb-2">Người gửi tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                {/* Signature area for người nộp */}
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiNop ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiNop} 
                        alt="Chữ ký người nộp" 
                        className="max-h-20 max-w-full object-contain"
                      />
                      <button
                        onClick={resetSignatureNguoiNop}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        title="Xóa chữ ký"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsModalOpenNguoiNop(true)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors print:hidden"
                    >
                      <PenLine className="w-4 h-4" />
                      Ký xác nhận
                    </button>
                  )}
                </div>

                <p data-field="signatureName" className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {formData.hoTenNguoiGui || '...........................'}
                </p>
              </div>

              {/* Người nhận tiền */}
              <div>
                <p className="font-bold mb-2">Người nhận tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                {/* Signature area for người nhận */}
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiNhan ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiNhan} 
                        alt="Chữ ký người nhận" 
                        className="max-h-20 max-w-full object-contain"
                      />
                      <button
                        onClick={resetSignatureNguoiNhan}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        title="Xóa chữ ký"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsModalOpenNguoiNhan(true)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors print:hidden"
                    >
                      <PenLine className="w-4 h-4" />
                      Ký xác nhận
                    </button>
                  )}
                </div>

                {/* Tên người nhận */}
                <p data-field="signatureName" className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {formData.hoTenNguoiNhan || '...........................'}
                </p>
              </div>
            </div>
          </footer>
        </div>

        {/* Info text */}
        <p className="text-center text-gray-500 text-sm mt-4">
          * Nhấn &quot;Xuất PDF&quot; để tải file biên nhận về máy
        </p>
      </div>
{/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <button
            onClick={handleExportPDF}
            disabled={exportStatus === 'loading'}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all',
              'shadow-md hover:shadow-lg',
              exportStatus === 'success' 
                ? 'bg-green-600 text-white' 
                : exportStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700',
              exportStatus === 'loading' && 'opacity-75 cursor-not-allowed'
            )}
          >
            {getButtonContent(exportStatus, 'Xuất PDF', FileDown)}
          </button>
          
          <button
            onClick={handleSendEmail}
            disabled={emailStatus === 'loading'}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all',
              'shadow-md hover:shadow-lg',
              emailStatus === 'success' 
                ? 'bg-green-600 text-white' 
                : emailStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
              emailStatus === 'loading' && 'opacity-75 cursor-not-allowed'
            )}
          >
            {getButtonContent(emailStatus, 'Gửi Email', Mail)}
          </button>
        </div>
      {/* Signature Modal for Người nhận */}
      <SignatureModal
        isOpen={isModalOpenNguoiNhan}
        onClose={() => setIsModalOpenNguoiNhan(false)}
        onApply={handleSignatureApplyNguoiNhan}
      />

      {/* Signature Modal for Người nộp */}
      <SignatureModal
        isOpen={isModalOpenNguoiNop}
        onClose={() => setIsModalOpenNguoiNop(false)}
        onApply={handleSignatureApplyNguoiNop}
      />
    </div>
  );
}
