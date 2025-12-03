'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileDown, 
  PenLine, 
  RotateCcw, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureModal from './SignatureModal';
import { ToastContainer, useToast } from './Toast';
import { 
  numberToVietnamese, 
  formatNumber, 
  formatVietnameseDate,
  cn 
} from '@/lib/utils';

// New interfaces to match ReceiptEditorKV
interface DynamicField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'money';
}

interface ReceiptData {
  title: string;
  fields: DynamicField[];
  ngayThang: string;
  diaDiem: string;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
}

// Legacy format for backward compatibility
interface LegacyReceiptInfo {
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

interface Receipt {
  id: string;
  // Support both old and new format
  info?: LegacyReceiptInfo;
  data?: ReceiptData;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

interface ReceiptViewKVProps {
  receiptId: string;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';
type SignatureTarget = 'nguoiNhan' | 'nguoiGui' | null;

export default function ReceiptViewKV({ receiptId }: ReceiptViewKVProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Receipt data from server
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Converted data for display
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  
  // Signature state - which one the customer needs to sign
  const [missingSignature, setMissingSignature] = useState<SignatureTarget>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<SignatureTarget>(null);
  
  // Local signature state
  const [signatureNguoiNhan, setSignatureNguoiNhan] = useState<string>('');
  const [signatureNguoiGui, setSignatureNguoiGui] = useState<string>('');
  
  // Action states
  const [exportStatus, setExportStatus] = useState<ActionStatus>('idle');
  const [sendStatus, setSendStatus] = useState<ActionStatus>('idle');
  const [showSuccess, setShowSuccess] = useState(false);

  // Toast notification
  const { toasts, showToast, removeToast } = useToast();

  // Convert legacy format to new format
  const convertLegacyToNew = (info: LegacyReceiptInfo): ReceiptData => {
    return {
      title: 'GIẤY BIÊN NHẬN TIỀN',
      fields: [
        { id: 'hoTenNguoiNhan', label: 'Họ và tên người nhận', value: info.hoTenNguoiNhan || '', type: 'text' },
        { id: 'donViNguoiNhan', label: 'Đơn vị người nhận', value: info.donViNguoiNhan || '', type: 'text' },
        { id: 'hoTenNguoiGui', label: 'Họ và tên người gửi', value: info.hoTenNguoiGui || '', type: 'text' },
        { id: 'donViNguoiGui', label: 'Đơn vị người gửi', value: info.donViNguoiGui || '', type: 'text' },
        { id: 'lyDoNop', label: 'Lý do nộp', value: info.lyDoNop || '', type: 'text' },
        { id: 'soTien', label: 'Số tiền', value: info.soTien?.toString() || '0', type: 'money' },
      ],
      ngayThang: info.ngayThang || formatVietnameseDate(new Date()),
      diaDiem: info.diaDiem || 'TP. Cần Thơ',
    };
  };

  // Get field value by id
  const getFieldValue = (fieldId: string): string => {
    if (!receiptData) return '';
    const field = receiptData.fields.find(f => f.id === fieldId);
    return field?.value || '';
  };

  // Get money amount
  const getSoTien = (): number => {
    const soTienField = receiptData?.fields.find(f => f.type === 'money');
    if (soTienField) {
      return parseInt(soTienField.value.replace(/\D/g, '')) || 0;
    }
    return 0;
  };

  // Fetch receipt on mount
  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/receipts/get?id=${receiptId}`);
        const data = await res.json();
        
        if (data.success && data.receipt) {
          const r = data.receipt as Receipt;
          setReceipt(r);
          
          // Convert to ReceiptData format
          let convertedData: ReceiptData;
          if (r.data) {
            // New format
            convertedData = r.data;
          } else if (r.info) {
            // Legacy format
            convertedData = convertLegacyToNew(r.info);
          } else {
            throw new Error('Invalid receipt format');
          }
          setReceiptData(convertedData);
          
          // Load existing signatures
          const sigNhan = r.signatureNguoiNhan || r.data?.signatureNguoiNhan || '';
          const sigGui = r.signatureNguoiGui || r.data?.signatureNguoiGui || '';
          setSignatureNguoiNhan(sigNhan);
          setSignatureNguoiGui(sigGui);
          
          // Determine which signature is missing
          const hasNhan = sigNhan && sigNhan.startsWith('data:');
          const hasGui = sigGui && sigGui.startsWith('data:');
          
          if (r.status === 'signed' || (hasNhan && hasGui)) {
            // Fully signed
            setShowSuccess(true);
            setMissingSignature(null);
          } else if (!hasNhan && !hasGui) {
            // Both missing - default to nguoiGui (sender)
            setMissingSignature('nguoiGui');
          } else if (!hasNhan) {
            // Missing nguoiNhan
            setMissingSignature('nguoiNhan');
          } else {
            // Missing nguoiGui
            setMissingSignature('nguoiGui');
          }
        } else {
          setError(data.error || 'Không tìm thấy biên lai');
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setError('Có lỗi xảy ra khi tải biên lai');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptId]);

  // Open signature modal for specific target
  const openSignatureModal = (target: SignatureTarget) => {
    setSignatureTarget(target);
    setIsSignatureModalOpen(true);
  };

  // Apply signature
  const handleApplySignature = (sig: string) => {
    if (signatureTarget === 'nguoiNhan') {
      setSignatureNguoiNhan(sig);
    } else if (signatureTarget === 'nguoiGui') {
      setSignatureNguoiGui(sig);
    }
    setIsSignatureModalOpen(false);
  };

  // Clear signature
  const clearSignature = (target: SignatureTarget) => {
    if (target === 'nguoiNhan') {
      setSignatureNguoiNhan('');
    } else if (target === 'nguoiGui') {
      setSignatureNguoiGui('');
    }
  };

  // Check if can send
  const canSend = (): boolean => {
    if (missingSignature === 'nguoiNhan') {
      return signatureNguoiNhan.startsWith('data:');
    } else if (missingSignature === 'nguoiGui') {
      return signatureNguoiGui.startsWith('data:');
    }
    return false;
  };

  // Get missing signature label
  const getMissingLabel = (): string => {
    if (missingSignature === 'nguoiNhan') {
      return 'Người nhận tiền';
    } else if (missingSignature === 'nguoiGui') {
      return 'Người gửi tiền';
    }
    return '';
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
    if (blob && receipt) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bien-nhan-${receipt.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Sign and send
  const handleSignAndSend = async () => {
    if (!canSend()) {
      showToast(`Vui lòng ký xác nhận tại ô "${getMissingLabel()}" trước khi gửi!`, 'error');
      return;
    }
    if (!receipt) return;

    setSendStatus('loading');

    try {
      // Prepare signature data
      const signatureData: { id: string; signatureNguoiNhan?: string; signatureNguoiGui?: string } = {
        id: receipt.id,
      };
      
      if (missingSignature === 'nguoiNhan') {
        signatureData.signatureNguoiNhan = signatureNguoiNhan;
      } else if (missingSignature === 'nguoiGui') {
        signatureData.signatureNguoiGui = signatureNguoiGui;
      }

      // Update signature in database
      const signRes = await fetch('/api/receipts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signatureData),
      });

      const signData = await signRes.json();
      if (!signData.success) {
        throw new Error(signData.error);
      }

      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture receipt image
      if (receiptRef.current) {
        const canvas = await html2canvas(receiptRef.current, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          ignoreElements: (element) => element.classList?.contains('print:hidden'),
        });
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

        // Build receipt data for notification
        const receiptInfo = {
          hoTenNguoiNhan: getFieldValue('hoTenNguoiNhan'),
          hoTenNguoiGui: getFieldValue('hoTenNguoiGui'),
          donViNguoiNhan: getFieldValue('donViNguoiNhan'),
          donViNguoiGui: getFieldValue('donViNguoiGui'),
          lyDoNop: getFieldValue('lyDoNop'),
          soTien: getSoTien(),
          bangChu: numberToVietnamese(getSoTien()),
          ngayThang: receiptData?.ngayThang || '',
          diaDiem: receiptData?.diaDiem || '',
        };

        // Send notification (Email + Telegram)
        await fetch('/api/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            receiptData: receiptInfo,
          }),
        });
      }

      setSendStatus('success');
      setShowSuccess(true);
    } catch (error) {
      console.error('Error signing:', error);
      setSendStatus('error');
      setTimeout(() => setSendStatus('idle'), 2000);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-glass flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-black/90 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang tải biên lai...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !receipt || !receiptData) {
    return (
      <div className="min-h-screen bg-gradient-glass flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Không tìm thấy biên lai
          </h2>
          <p className="text-gray-500 mb-6">
            {error || 'Biên lai không tồn tại hoặc đã bị xóa.'}
          </p>
          <p className="text-gray-400 text-sm">
            Mã: {receiptId}
          </p>
        </div>
      </div>
    );
  }

  // Render signature box
  const renderSignatureBox = (
    target: SignatureTarget, 
    label: string, 
    signature: string, 
    nameValue: string
  ) => {
    const isMissing = missingSignature === target;
    const hasSig = signature && signature.startsWith('data:');

    return (
      <div>
        <p className="font-bold mb-2">{label}</p>
        <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
        
        <div className="min-h-[100px] flex flex-col items-center justify-center">
          {hasSig ? (
            <div className="relative group">
              <img 
                src={signature} 
                alt={`Chữ ký ${label.toLowerCase()}`} 
                className="h-16 w-auto object-contain"
                style={{ imageRendering: 'auto', minWidth: '80px' }}
              />
              {isMissing && !showSuccess && (
                <button
                  onClick={() => clearSignature(target)}
                  className="absolute -top-2 -right-2 p-1 bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                  title="Xóa chữ ký"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : isMissing && !showSuccess ? (
            <button
              onClick={() => openSignatureModal(target)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-blue-400 rounded-xl text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-colors print:hidden"
            >
              <PenLine className="w-4 h-4" />
              Ký xác nhận
            </button>
          ) : (
            <span className="text-gray-400 italic">Chưa ký</span>
          )}
        </div>

        <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
          {nameValue || '...........................'}
        </p>
      </div>
    );
  };

  // Main view
  return (
    <div className="min-h-screen bg-gradient-glass py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        {showSuccess && (
          <div className="glass-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-center border-2 border-green-400">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              Biên lai đã được ký xác nhận!
            </h2>
            <p className="text-sm sm:text-base text-gray-500">
              Bạn có thể tải PDF để lưu trữ.
            </p>
          </div>
        )}

        {/* Header Bar */}
        <div className="glass-card rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/90 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base truncate">Biên lai #{receipt.id}</h1>
              <p className="text-xs sm:text-sm text-gray-500">
                {showSuccess 
                  ? 'Đã hoàn tất - Có thể tải PDF bên dưới'
                  : canSend()
                    ? `Đã ký - Nhấn "Hoàn tất & Gửi" để xác nhận` 
                    : `Vui lòng ký xác nhận tại ô "${getMissingLabel()}" bên dưới`}
              </p>
            </div>
          </div>
        </div>

        {/* Receipt Paper */}
        <div 
          ref={receiptRef}
          className="bg-white shadow-2xl mx-auto rounded-lg w-full max-w-[210mm]"
          style={{
            minHeight: 'auto',
            padding: 'clamp(16px, 5vw, 25mm) clamp(12px, 4vw, 25mm)',
            fontFamily: '"Times New Roman", Tinos, serif',
          }}
        >
          {/* Header */}
          <header className="text-center mb-4 sm:mb-8">
            <h2 className="text-sm sm:text-base font-bold tracking-wide">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </h2>
            <p className="text-sm sm:text-base mt-1">
              <span style={{ textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                Độc lập - Tự do - Hạnh phúc
              </span>
            </p>
            <div className="mt-4 sm:mt-8 text-gray-400 text-xs sm:text-base">
              -----------------------
            </div>
            <h1 className="text-lg sm:text-2xl font-bold mt-4 sm:mt-6 tracking-wider">
              {receiptData.title || 'GIẤY BIÊN NHẬN TIỀN'}
            </h1>
          </header>

          {/* Body - Dynamic Fields */}
          <div className="space-y-3 sm:space-y-5 text-sm sm:text-base leading-relaxed">
            {receiptData.fields.map((field) => (
              <div key={field.id} className={cn(
                "flex gap-1 sm:gap-2",
                field.type === 'textarea' 
                  ? "flex-col" 
                  : "flex-col sm:flex-row sm:items-baseline"
              )}>
                <span className="whitespace-nowrap text-gray-600 sm:text-black text-xs sm:text-base">{field.label}:</span>
                {field.type === 'textarea' ? (
                  <div className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 whitespace-pre-wrap break-words min-h-[1.5em]">
                    {field.value || '...'}
                  </div>
                ) : (
                  <span className={cn(
                    "flex-1 border-b border-dotted border-gray-400 px-2 py-1",
                    field.type === 'money' && "font-semibold"
                  )}>
                    {field.type === 'money' 
                      ? formatNumber(parseInt(field.value.replace(/\D/g, '')) || 0)
                      : (field.value || '...')}
                  </span>
                )}
                {field.type === 'money' && <span className="whitespace-nowrap">VNĐ</span>}
              </div>
            ))}
            
            {/* Bằng chữ - auto calculate from soTien */}
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
              <span className="whitespace-nowrap text-gray-600 sm:text-black text-xs sm:text-base">Bằng chữ:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 italic text-gray-700">
                {numberToVietnamese(getSoTien())}
              </span>
            </div>
          </div>

          {/* Footer with Signatures */}
          <footer className="mt-8 sm:mt-16">
            <div className="text-right italic mb-6 sm:mb-10 text-sm sm:text-base">
              <span>{receiptData.diaDiem || 'TP. Cần Thơ'}, </span>
              <span>{receiptData.ngayThang || formatVietnameseDate(new Date())}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 text-center">
              {/* Người gửi tiền */}
              {renderSignatureBox(
                'nguoiGui',
                'Người gửi tiền',
                signatureNguoiGui,
                getFieldValue('hoTenNguoiGui')
              )}

              {/* Người nhận tiền */}
              {renderSignatureBox(
                'nguoiNhan',
                'Người nhận tiền',
                signatureNguoiNhan,
                getFieldValue('hoTenNguoiNhan')
              )}
            </div>
          </footer>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 sm:mt-6 bg-white rounded-2xl p-4 sm:p-6 shadow-lg print:hidden">
          <div className="flex flex-col gap-3">
            {/* Send Button - Hiển thị khi chưa hoàn tất */}
            {!showSuccess && (
              <button
                onClick={handleSignAndSend}
                disabled={sendStatus === 'loading' || !canSend()}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all text-sm sm:text-base',
                  sendStatus === 'success' 
                    ? 'bg-green-600 text-white' 
                    : sendStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-black text-white hover:bg-gray-800',
                  (sendStatus === 'loading' || !canSend()) && 'opacity-30 cursor-not-allowed'
                )}
              >
                {sendStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : sendStatus === 'success' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Đã gửi!
                  </>
                ) : sendStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Thử lại
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Hoàn tất & Gửi
                  </>
                )}
              </button>
            )}

            {/* Export PDF Button - Riêng biệt, chỉ sáng khi đã hoàn tất */}
            <button
              onClick={handleExportPDF}
              disabled={exportStatus === 'loading' || (!showSuccess && sendStatus !== 'success')}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all border-2 text-sm sm:text-base',
                exportStatus === 'success' 
                  ? 'bg-green-600 text-white border-green-600' 
                  : (showSuccess || sendStatus === 'success')
                  ? 'bg-white text-black border-black hover:bg-gray-100'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              )}
            >
              {exportStatus === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xuất...
                </>
              ) : exportStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Đã tải!
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Lưu PDF
                </>
              )}
            </button>
          </div>
          
          {/* Hint text */}
          {!showSuccess && sendStatus !== 'success' && (
            <p className="text-xs text-gray-400 text-center mt-3">
              {canSend() 
                ? 'Nhấn "Hoàn tất & Gửi" để mở khóa nút Lưu PDF'
                : 'Vui lòng ký xác nhận trước để tiếp tục'}
            </p>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onApply={handleApplySignature}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
