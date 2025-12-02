'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Save, 
  FileDown,
  Mail,
  X,
  PenLine,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Link,
  Send
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureModal from './SignatureModal';
import { ToastContainer, useToast } from './Toast';
import { 
  numberToVietnamese, 
  formatNumber, 
  parseFormattedNumber,
  formatVietnameseDate,
  cn 
} from '@/lib/utils';

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

interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  color?: string;
}

interface Receipt {
  id: string;
  info: ReceiptInfo;
  signaturePoints: SignaturePoint[][] | null;
  signatureNguoiNhan?: string;
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

interface ReceiptEditorKVProps {
  receipt?: Receipt | null;
  onSave: () => void;
  onCancel: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ReceiptEditorKV({ receipt, onSave, onCancel }: ReceiptEditorKVProps) {
  const isEditing = !!receipt;
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Form data
  const [formData, setFormData] = useState<ReceiptInfo>({
    hoTenNguoiNhan: receipt?.info?.hoTenNguoiNhan || '',
    hoTenNguoiGui: receipt?.info?.hoTenNguoiGui || '',
    donViNguoiNhan: receipt?.info?.donViNguoiNhan || '',
    donViNguoiGui: receipt?.info?.donViNguoiGui || '',
    lyDoNop: receipt?.info?.lyDoNop || '',
    soTien: receipt?.info?.soTien || 0,
    bangChu: receipt?.info?.bangChu || '',
    ngayThang: receipt?.info?.ngayThang || '',
    diaDiem: receipt?.info?.diaDiem || 'TP. Cần Thơ',
  });

  // Signature states
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureNguoiNhan, setSignatureNguoiNhan] = useState<string>(receipt?.signatureNguoiNhan || '');

  // Action states
  const [saveStatus, setSaveStatus] = useState<ActionStatus>('idle');
  const [exportStatus, setExportStatus] = useState<ActionStatus>('idle');
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(receipt?.id || null);
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const [justCreated, setJustCreated] = useState(false);

  // Email panel
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Toast notification
  const { toasts, showToast, removeToast } = useToast();

  // Set date on mount
  useEffect(() => {
    if (!receipt?.info?.ngayThang) {
      const now = new Date();
      setFormData(prev => ({
        ...prev,
        ngayThang: formatVietnameseDate(now)
      }));
    }
  }, [receipt?.info?.ngayThang]);

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

  // Handle input change
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

  // Save receipt
  const handleSave = async () => {
    setSaveStatus('loading');
    try {
      const url = isEditing ? '/api/receipts/update' : '/api/receipts/create';
      const body = isEditing 
        ? { id: receipt.id, info: formData, signatureNguoiNhan }
        : { info: formData, signatureNguoiNhan };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      if (data.success) {
        const newId = data.receipt?.id || receipt?.id;
        setSavedReceiptId(newId);
        setSaveStatus('success');
        
        if (!isEditing) {
          setJustCreated(true);
        } else {
          setTimeout(() => {
            setSaveStatus('idle');
            onSave();
          }, 1500);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // Export PDF
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
      link.download = `bien-nhan-${savedReceiptId || new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Copy link
  const handleCopyLink = async () => {
    if (!savedReceiptId) return;
    const url = `${window.location.origin}/?id=${savedReceiptId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShowLinkCopied(true);
      setTimeout(() => setShowLinkCopied(false), 2000);
    } catch (error) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowLinkCopied(true);
      setTimeout(() => setShowLinkCopied(false), 2000);
    }
  };

  // Send invitation email
  const handleSendEmail = async () => {
    if (!customerEmail) {
      showToast('Vui lòng nhập email!', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      let receiptId = savedReceiptId;
      if (!receiptId) {
        // Save first
        const createRes = await fetch('/api/receipts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ info: formData, signatureNguoiNhan }),
        });
        const createData = await createRes.json();
        if (!createData.success) {
          throw new Error(createData.error);
        }
        receiptId = createData.receipt.id;
        setSavedReceiptId(receiptId);
      }

      const signingUrl = `${window.location.origin}/?id=${receiptId}`;
      const res = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail,
          customerName: formData.hoTenNguoiGui,
          receiptInfo: formData,
          signingUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Đã gửi email mời ký thành công!', 'success');
        setShowEmailPanel(false);
        setCustomerEmail('');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showToast('Có lỗi xảy ra khi gửi email!', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const getButtonContent = (status: ActionStatus, defaultText: string, Icon: React.ElementType) => {
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
        {/* Success - Link Created Panel */}
        {justCreated && savedReceiptId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-6 w-full max-w-lg shadow-xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Tạo biên lai thành công!
                </h2>
                <p className="text-gray-500">
                  Mã biên lai: <code className="bg-gray-100 px-2 py-1 rounded font-mono">{savedReceiptId}</code>
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link chia sẻ cho khách hàng ký:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?id=${savedReceiptId}`}
                    className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm bg-gray-50"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      'px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2',
                      showLinkCopied ? 'bg-green-600 text-white' : 'glass-button'
                    )}
                  >
                    {showLinkCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Đã copy!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmailPanel(true)}
                  className="flex-1 py-2.5 glass-button-outline rounded-xl flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Gửi qua Email
                </button>
                <button
                  onClick={onSave}
                  className="flex-1 py-2.5 glass-button rounded-xl"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Panel */}
        {showEmailPanel && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Gửi email mời ký
                </h2>
                <button
                  onClick={() => setShowEmailPanel(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email khách hàng</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full glass-input rounded-xl px-4 py-2.5"
                  />
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="w-full glass-button py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Gửi email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="glass-card rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 glass-button-outline rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại
          </button>

          <div className="flex flex-wrap gap-3">
            {savedReceiptId && (
              <button
                onClick={handleCopyLink}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
                  showLinkCopied ? 'bg-green-100 text-green-700' : 'glass-button-outline'
                )}
                title="Copy link chia sẻ"
              >
                {showLinkCopied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                {showLinkCopied ? 'Đã copy!' : 'Copy link'}
              </button>
            )}
            
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
              {getButtonContent(saveStatus, isEditing ? 'Cập nhật' : 'Lưu', Save)}
            </button>

            <button
              onClick={() => setShowEmailPanel(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium glass-button-outline"
            >
              <Mail className="w-4 h-4" />
              Gửi Email
            </button>
          </div>
        </div>

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
              <span>{formData.ngayThang}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center">
              {/* Người gửi tiền - Khách sẽ ký */}
              <div>
                <p className="font-bold mb-2">Người gửi tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  <span className="text-gray-400 italic text-sm print:hidden">
                    Khách hàng sẽ ký khi nhận link
                  </span>
                </div>

                <p data-field="signatureName" className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {formData.hoTenNguoiGui || '...........................'}
                </p>
              </div>

              {/* Người nhận tiền - Admin ký */}
              <div>
                <p className="font-bold mb-2">Người nhận tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiNhan ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiNhan} 
                        alt="Chữ ký người nhận" 
                        className="h-16 w-auto object-contain"
                        style={{ imageRendering: 'auto', minWidth: '80px' }}
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
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-gray-400 rounded-xl text-gray-600 hover:border-gray-600 hover:bg-gray-50 transition-colors print:hidden font-medium"
                    >
                      <PenLine className="w-5 h-5" />
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

        {/* Info text */}
        <p className="text-center text-gray-500 text-sm mt-4">
          * Nhấn &quot;Lưu&quot; để tạo biên nhận, sau đó copy link gửi cho khách hàng ký xác nhận
        </p>
      </div>

      {/* Signature Modal for Admin */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onApply={(sig) => setSignatureNguoiNhan(sig)}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
