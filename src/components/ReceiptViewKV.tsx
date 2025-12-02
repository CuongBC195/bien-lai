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
import { 
  numberToVietnamese, 
  formatNumber, 
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
  signatureNguoiNhan?: string; // Chữ ký admin
  signatureNguoiGui?: string; // Chữ ký khách
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

interface ReceiptViewKVProps {
  receiptId: string;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ReceiptViewKV({ receiptId }: ReceiptViewKVProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Receipt data from server
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Signature state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureNguoiGui, setSignatureNguoiGui] = useState<string>('');
  const [signatureNguoiNhan, setSignatureNguoiNhan] = useState<string>('');
  
  // Action states
  const [exportStatus, setExportStatus] = useState<ActionStatus>('idle');
  const [sendStatus, setSendStatus] = useState<ActionStatus>('idle');
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch receipt on mount
  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/receipts/get?id=${receiptId}`);
        const data = await res.json();
        
        if (data.success && data.receipt) {
          setReceipt(data.receipt);
          // Load admin signature if exists
          if (data.receipt.signatureNguoiNhan) {
            setSignatureNguoiNhan(data.receipt.signatureNguoiNhan);
          }
          // If already signed, show success
          if (data.receipt.status === 'signed') {
            // Load customer signature if exists
            if (data.receipt.signatureNguoiGui) {
              setSignatureNguoiGui(data.receipt.signatureNguoiGui);
            }
            setShowSuccess(true);
          } else {
            // Not signed yet - make sure signature state is empty
            setSignatureNguoiGui('');
            setShowSuccess(false);
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
    if (!signatureNguoiGui) {
      alert('Vui lòng ký tên trước khi gửi!');
      return;
    }
    if (!receipt) return;

    setSendStatus('loading');

    try {
      // Update signature in database
      const signRes = await fetch('/api/receipts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: receipt.id,
          signatureNguoiGui: signatureNguoiGui,
        }),
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

        // Send notification (Email + Telegram)
        await fetch('/api/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            receiptData: receipt.info,
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
  if (error || !receipt) {
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

  // Main view - Customer signing (always show, with success message if needed)
  return (
    <div className="min-h-screen bg-gradient-glass py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Message - Show if already signed */}
        {showSuccess && (
          <div className="glass-card rounded-2xl p-6 mb-6 text-center border-2 border-green-400">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Biên lai đã được ký xác nhận!
            </h2>
            <p className="text-gray-500">
              Bạn có thể tải PDF để lưu trữ.
            </p>
          </div>
        )}

        {/* Header Bar */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/90 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Biên lai #{receipt.id}</h1>
              <p className="text-sm text-gray-500">
                {showSuccess 
                  ? 'Đã hoàn tất - Có thể tải PDF bên dưới'
                  : signatureNguoiGui 
                    ? 'Đã ký - Nhấn "Hoàn tất & Gửi" bên dưới để xác nhận' 
                    : 'Vui lòng ký xác nhận tại ô "Người gửi tiền" bên dưới'}
              </p>
            </div>
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

          {/* Body - Read-only */}
          <div className="space-y-5 text-base leading-relaxed">
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người nhận:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {receipt.info.hoTenNguoiNhan || '...'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người nhận:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {receipt.info.donViNguoiNhan || '...'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người gửi:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {receipt.info.hoTenNguoiGui || '...'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người gửi:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {receipt.info.donViNguoiGui || '...'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Lý do nộp:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {receipt.info.lyDoNop || '...'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Số tiền:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 font-semibold">
                {formatNumber(receipt.info.soTien)}
              </span>
              <span className="whitespace-nowrap">VNĐ</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Bằng chữ:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 italic text-gray-700">
                {receipt.info.bangChu || numberToVietnamese(receipt.info.soTien)}
              </span>
            </div>
          </div>

          {/* Footer with Signatures */}
          <footer className="mt-16">
            <div className="text-right italic mb-10">
              <span>{receipt.info.diaDiem || 'TP. Cần Thơ'}, </span>
              <span>{receipt.info.ngayThang || formatVietnameseDate(new Date())}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center">
              {/* Người gửi tiền - Khách ký */}
              <div>
                <p className="font-bold mb-2">Người gửi tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiGui && signatureNguoiGui.startsWith('data:') ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiGui} 
                        alt="Chữ ký người gửi" 
                        className="h-16 w-auto object-contain"
                        style={{ imageRendering: 'auto', minWidth: '80px' }}
                      />
                      {!showSuccess && (
                        <button
                          onClick={() => setSignatureNguoiGui('')}
                          className="absolute -top-2 -right-2 p-1 bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                          title="Xóa chữ ký"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors print:hidden"
                    >
                      <PenLine className="w-4 h-4" />
                      Ký xác nhận
                    </button>
                  )}
                </div>

                <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {receipt.info.hoTenNguoiGui || '...........................'}
                </p>
              </div>

              {/* Người nhận tiền */}
              <div>
                <p className="font-bold mb-2">Người nhận tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiNhan ? (
                    <img 
                      src={signatureNguoiNhan} 
                      alt="Chữ ký người nhận" 
                      className="h-16 w-auto object-contain"
                      style={{ imageRendering: 'auto', minWidth: '80px' }}
                    />
                  ) : (
                    <span className="text-gray-400 italic">Chưa ký</span>
                  )}
                </div>

                <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {receipt.info.hoTenNguoiNhan || '...........................'}
                </p>
              </div>
            </div>
          </footer>
        </div>

        {/* Action Buttons Below Receipt */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg flex flex-wrap justify-center gap-4 print:hidden">
          {/* Send Button - Show until success */}
          {!showSuccess && (
            <button
              onClick={handleSignAndSend}
              disabled={sendStatus === 'loading' || !signatureNguoiGui || !signatureNguoiGui.startsWith('data:')}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                sendStatus === 'success' 
                  ? 'bg-green-600 text-white' 
                  : sendStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-black text-white hover:bg-gray-800',
                (sendStatus === 'loading' || !signatureNguoiGui || !signatureNguoiGui.startsWith('data:')) && 'opacity-30 cursor-not-allowed'
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

          {/* Export PDF Button - Only show after send success or showSuccess */}
          {(showSuccess || sendStatus === 'success') && (
            <button
              onClick={handleExportPDF}
              disabled={exportStatus === 'loading'}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all border-2 border-black',
                exportStatus === 'success' 
                  ? 'bg-green-600 text-white border-green-600' 
                  : 'bg-white text-black hover:bg-gray-100'
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
                  Xuất PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onApply={(sig) => setSignatureNguoiGui(sig)}
      />
    </div>
  );
}
