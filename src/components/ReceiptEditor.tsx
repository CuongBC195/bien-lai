'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileDown, 
  PenLine, 
  RotateCcw, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Save,
  Mail,
  Send
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureModal from './SignatureModal';
import { ReceiptData, saveReceipt, updateReceipt, generateId } from '@/lib/storage';
import { generateShareUrl, ShareableReceiptData } from '@/lib/url-utils';
import { 
  numberToVietnamese, 
  formatNumber, 
  parseFormattedNumber, 
  formatVietnameseDate,
  cn 
} from '@/lib/utils';

interface ReceiptEditorProps {
  initialData?: ReceiptData | null;
  onClose: () => void;
  onSave: () => void;
}

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

export default function ReceiptEditor({ initialData, onClose, onSave }: ReceiptEditorProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isModalOpenNguoiNhan, setIsModalOpenNguoiNhan] = useState(false);
  const [isModalOpenNguoiGui, setIsModalOpenNguoiGui] = useState(false);
  const [signatureNguoiNhan, setSignatureNguoiNhan] = useState<string>(initialData?.signatureNguoiNhan || '');
  const [signatureNguoiGui, setSignatureNguoiGui] = useState<string>(initialData?.signatureNguoiGui || '');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [saveStatus, setSaveStatus] = useState<ExportStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<ExportStatus>('idle');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [savedReceiptId, setSavedReceiptId] = useState<string>(initialData?.id || '');

  const [formData, setFormData] = useState<FormData>({
    hoTenNguoiNhan: initialData?.hoTenNguoiNhan || '',
    hoTenNguoiGui: initialData?.hoTenNguoiGui || '',
    donViNguoiNhan: initialData?.donViNguoiNhan || '',
    donViNguoiGui: initialData?.donViNguoiGui || '',
    lyDoNop: initialData?.lyDoNop || '',
    soTien: initialData?.soTien || 0,
    bangChu: initialData?.bangChu || '',
    ngayThang: initialData?.ngayThang || '',
    diaDiem: initialData?.diaDiem || 'TP. Cần Thơ',
  });

  useEffect(() => {
    const now = new Date();
    const dateStr = formatVietnameseDate(now);
    setCurrentDate(dateStr);
    if (!initialData?.ngayThang) {
      setFormData(prev => ({
        ...prev,
        ngayThang: dateStr
      }));
    }
  }, [initialData?.ngayThang]);

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

  const handleSave = () => {
    setSaveStatus('loading');
    
    try {
      const receiptData = {
        ...formData,
        signatureNguoiNhan,
        signatureNguoiGui,
      };

      if (initialData?.id || savedReceiptId) {
        const id = initialData?.id || savedReceiptId;
        updateReceipt(id, receiptData);
        setSavedReceiptId(id);
      } else {
        const newReceipt = saveReceipt(receiptData);
        setSavedReceiptId(newReceipt.id);
      }

      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error saving receipt:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const generateSigningUrl = (): string => {
    const shareData: ShareableReceiptData = {
      hoTenNguoiNhan: formData.hoTenNguoiNhan,
      hoTenNguoiGui: formData.hoTenNguoiGui,
      donViNguoiNhan: formData.donViNguoiNhan,
      donViNguoiGui: formData.donViNguoiGui,
      lyDoNop: formData.lyDoNop,
      soTien: formData.soTien,
      bangChu: formData.bangChu,
      ngayThang: formData.ngayThang,
      diaDiem: formData.diaDiem,
      signatureNguoiNhan: '',
      signatureNguoiGui: '',
      receiptId: savedReceiptId || initialData?.id,
    };
    return generateShareUrl(shareData);
  };

  const handleSendEmail = async () => {
    if (!customerEmail || !customerEmail.includes('@')) {
      alert('Vui lòng nhập email hợp lệ!');
      return;
    }

    if (!savedReceiptId && !initialData?.id) {
      handleSave();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setEmailStatus('loading');

    try {
      const signingUrl = generateSigningUrl();
      
      const response = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail,
          customerName: formData.hoTenNguoiGui,
          receiptInfo: {
            hoTenNguoiNhan: formData.hoTenNguoiNhan,
            donViNguoiNhan: formData.donViNguoiNhan,
            hoTenNguoiGui: formData.hoTenNguoiGui,
            donViNguoiGui: formData.donViNguoiGui,
            lyDoNop: formData.lyDoNop,
            soTien: formData.soTien,
            bangChu: formData.bangChu,
            ngayThang: formData.ngayThang,
            diaDiem: formData.diaDiem,
          },
          signingUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gửi email thất bại');
      }

      setEmailStatus('success');
      setShowEmailInput(false);
      setCustomerEmail('');
      setTimeout(() => setEmailStatus('idle'), 3000);
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailStatus('error');
      setTimeout(() => setEmailStatus('idle'), 3000);
    }
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
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              color: inherit !important;
              background-color: inherit !important;
              border-color: inherit !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          const inputs = clonedDoc.querySelectorAll('input, textarea');
          inputs.forEach((input) => {
            const el = input as HTMLInputElement | HTMLTextAreaElement;
            if (!el.value || el.value.trim() === '') {
              el.value = 'N/A';
              el.style.color = '#374151';
            }
          });

          const bangChuSpan = clonedDoc.querySelector('[data-field="bangChu"]');
          if (bangChuSpan && (!bangChuSpan.textContent || bangChuSpan.textContent === '...')) {
            bangChuSpan.textContent = 'N/A';
          }

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
    <div className="min-h-screen bg-gradient-glass py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Action Bar */}
        <div className="glass-card rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 glass-button-outline rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportPDF}
              disabled={exportStatus === 'loading'}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                exportStatus === 'success' 
                  ? 'bg-green-600 text-white' 
                  : exportStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'glass-button-outline',
                exportStatus === 'loading' && 'opacity-75 cursor-not-allowed'
              )}
            >
              {getButtonContent(exportStatus, 'Xuất PDF', FileDown)}
            </button>
            
            <button
              onClick={handleSave}
              disabled={saveStatus === 'loading'}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                saveStatus === 'success' 
                  ? 'bg-green-600 text-white' 
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'glass-button',
                saveStatus === 'loading' && 'opacity-75 cursor-not-allowed'
              )}
            >
              {getButtonContent(saveStatus, initialData ? 'Cập nhật' : 'Lưu', Save)}
            </button>

            <button
              onClick={() => setShowEmailInput(!showEmailInput)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                emailStatus === 'success' 
                  ? 'bg-green-600 text-white' 
                  : emailStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'glass-button-outline'
              )}
            >
              {emailStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Đã gửi!
                </>
              ) : emailStatus === 'error' ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Lỗi!
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Gửi Email
                </>
              )}
            </button>
          </div>
        </div>

        {/* Email Input Panel */}
        {showEmailInput && (
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Gửi email mời ký xác nhận</h3>
            <div className="flex gap-3">
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Nhập email khách hàng..."
                className="flex-1 px-4 py-3 glass-input rounded-xl"
              />
              <button
                onClick={handleSendEmail}
                disabled={emailStatus === 'loading' || !customerEmail}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                  'glass-button',
                  (emailStatus === 'loading' || !customerEmail) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {emailStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Gửi
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Email sẽ chứa thông tin biên nhận và link để khách hàng ký xác nhận.
            </p>
          </div>
        )}

        {/* Receipt Paper */}
        <div 
          ref={receiptRef}
          className="bg-white shadow-2xl mx-auto rounded-lg"
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
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người nhận:</span>
              <input
                type="text"
                name="hoTenNguoiNhan"
                value={formData.hoTenNguoiNhan}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent"
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người nhận:</span>
              <input
                type="text"
                name="donViNguoiNhan"
                value={formData.donViNguoiNhan}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent"
                placeholder="Công ty TNHH ABC"
              />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người gửi:</span>
              <input
                type="text"
                name="hoTenNguoiGui"
                value={formData.hoTenNguoiGui}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent"
                placeholder="Trần Văn B"
              />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người gửi:</span>
              <input
                type="text"
                name="donViNguoiGui"
                value={formData.donViNguoiGui}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent"
                placeholder="Công ty XYZ"
              />
            </div>

            <div className="flex items-start gap-2">
              <span className="whitespace-nowrap pt-1">Lý do nộp:</span>
              <textarea
                name="lyDoNop"
                value={formData.lyDoNop}
                onChange={handleInputChange}
                rows={2}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent resize-none overflow-hidden"
                placeholder="Thanh toán hợp đồng số..."
                style={{ minHeight: '2.5em' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Số tiền:</span>
              <input
                type="text"
                name="soTien"
                value={formData.soTien > 0 ? formatNumber(formData.soTien) : ''}
                onChange={handleInputChange}
                className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent"
                placeholder="0"
              />
              <span className="whitespace-nowrap">VNĐ</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Bằng chữ:</span>
              <span data-field="bangChu" className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 italic text-gray-700 min-h-[1.5em]">
                {formData.bangChu || '...'}
              </span>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-16">
            <div className="text-right italic mb-10">
              <span>{formData.diaDiem}, </span>
              <span>{currentDate}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center">
              {/* Người gửi tiền */}
              <div>
                <p className="font-bold mb-2">Người gửi tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiGui ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiGui} 
                        alt="Chữ ký người gửi" 
                        className="max-h-20 max-w-full object-contain"
                      />
                      <button
                        onClick={() => setSignatureNguoiGui('')}
                        className="absolute -top-2 -right-2 p-1 bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        title="Xóa chữ ký"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsModalOpenNguoiGui(true)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors print:hidden"
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
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiNhan ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiNhan} 
                        alt="Chữ ký người nhận" 
                        className="max-h-20 max-w-full object-contain"
                      />
                      <button
                        onClick={() => setSignatureNguoiNhan('')}
                        className="absolute -top-2 -right-2 p-1 bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        title="Xóa chữ ký"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsModalOpenNguoiNhan(true)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors print:hidden"
                    >
                      <PenLine className="w-4 h-4" />
                      Ký xác nhận
                    </button>
                  )}
                </div>

                <p data-field="signatureName" className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {formData.hoTenNguoiNhan || '...........................'}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <SignatureModal
        isOpen={isModalOpenNguoiNhan}
        onClose={() => setIsModalOpenNguoiNhan(false)}
        onApply={(sig) => setSignatureNguoiNhan(sig)}
      />

      <SignatureModal
        isOpen={isModalOpenNguoiGui}
        onClose={() => setIsModalOpenNguoiGui(false)}
        onApply={(sig) => setSignatureNguoiGui(sig)}
      />
    </div>
  );
}
