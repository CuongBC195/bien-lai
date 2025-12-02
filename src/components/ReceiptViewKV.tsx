'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Send,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  PenTool
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

interface ReceiptViewKVProps {
  receiptId: string;
  onSignComplete?: () => void;
}

export default function ReceiptViewKV({ receiptId, onSignComplete }: ReceiptViewKVProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);
  
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch receipt by ID
  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/receipts/get?id=${receiptId}`);
        const data = await res.json();
        
        if (data.success && data.receipt) {
          setReceipt(data.receipt);
          setIsSigned(data.receipt.status === 'signed');
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

  // Load existing signature if any
  useEffect(() => {
    if (receipt?.signaturePoints && sigCanvas.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sigCanvas.current.fromData(receipt.signaturePoints as any);
    }
  }, [receipt?.signaturePoints]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  // Clear signature
  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  // Sign and send
  const handleSign = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert('Vui lòng ký tên trước khi gửi!');
      return;
    }

    if (!receipt) return;

    setSigning(true);
    try {
      // Get signature points
      const signaturePoints = sigCanvas.current.toData();

      // Save signature to database
      const signRes = await fetch('/api/receipts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: receipt.id,
          signaturePoints,
        }),
      });

      const signData = await signRes.json();
      if (!signData.success) {
        throw new Error(signData.error);
      }

      setIsSigned(true);
      setSigning(false);
      setSending(true);

      // Capture receipt image
      if (receiptRef.current) {
        const canvas = await html2canvas(receiptRef.current, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
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

      setShowSuccess(true);
      onSignComplete?.();
    } catch (error) {
      console.error('Error signing:', error);
      alert('Có lỗi xảy ra khi ký!');
    } finally {
      setSigning(false);
      setSending(false);
    }
  };

  // Download PDF
  const handleDownload = async () => {
    if (!receiptRef.current || !receipt) return;

    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`bien-lai-${receipt.id}.pdf`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-gray-400">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="glass-dark rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-medium text-white mb-2">
            Không tìm thấy biên lai
          </h2>
          <p className="text-gray-400 mb-6">
            {error || 'Biên lai không tồn tại hoặc đã bị xóa.'}
          </p>
          <p className="text-gray-500 text-sm">
            Mã: {receiptId}
          </p>
        </div>
      </div>
    );
  }

  // Success state after signing
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="glass-dark rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-medium text-white mb-2">
            Ký xác nhận thành công!
          </h2>
          <p className="text-gray-400 mb-6">
            Biên lai đã được gửi đến quản trị viên qua Email và Telegram.
          </p>
          <button
            onClick={handleDownload}
            className="w-full bg-white text-black py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Tải PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 md:p-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="glass-dark rounded-xl p-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-light text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Biên lai: {receipt.id}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {isSigned ? 'Đã ký xác nhận' : 'Chờ ký xác nhận'}
            </p>
          </div>
          {isSigned && (
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-1">
              <Check className="w-4 h-4" />
              Đã ký
            </span>
          )}
        </div>
      </div>

      {/* Receipt Preview */}
      <div className="max-w-3xl mx-auto mb-6">
        <div 
          ref={receiptRef}
          className="bg-white rounded-xl p-6 md:p-8 shadow-lg"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {/* Header */}
          <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              BIÊN NHẬN TIỀN
            </h2>
            <p className="text-gray-500 text-sm">
              {receipt.info.donViNguoiNhan || 'E-Receipt System'}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4 text-gray-700">
            <div className="flex">
              <span className="w-40 text-gray-500">Người nhận tiền:</span>
              <span className="font-medium">{receipt.info.hoTenNguoiNhan || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="w-40 text-gray-500">Đơn vị:</span>
              <span>{receipt.info.donViNguoiNhan || 'N/A'}</span>
            </div>
            
            <div className="h-px bg-gray-200 my-4"></div>
            
            <div className="flex">
              <span className="w-40 text-gray-500">Người nộp tiền:</span>
              <span className="font-medium">{receipt.info.hoTenNguoiGui || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="w-40 text-gray-500">Đơn vị:</span>
              <span>{receipt.info.donViNguoiGui || 'N/A'}</span>
            </div>
            
            <div className="h-px bg-gray-200 my-4"></div>
            
            <div className="flex">
              <span className="w-40 text-gray-500">Lý do:</span>
              <span>{receipt.info.lyDoNop || 'N/A'}</span>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg my-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">Số tiền:</span>
                <span className="text-2xl font-bold text-amber-600">
                  {formatCurrency(receipt.info.soTien)} VNĐ
                </span>
              </div>
              <div className="text-gray-500 text-sm italic mt-1">
                ({receipt.info.bangChu})
              </div>
            </div>
            
            <div className="flex">
              <span className="w-40 text-gray-500">Ngày:</span>
              <span>{receipt.info.ngayThang}</span>
            </div>
            <div className="flex">
              <span className="w-40 text-gray-500">Địa điểm:</span>
              <span>{receipt.info.diaDiem}</span>
            </div>
          </div>

          {/* Signature Area */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center">
                <p className="font-medium text-gray-600 mb-2">Người nhận tiền</p>
                <p className="text-gray-400 text-sm">(Ký, ghi rõ họ tên)</p>
                <div className="h-24 border-b border-gray-300 mt-4"></div>
                <p className="mt-2 text-gray-700">{receipt.info.hoTenNguoiNhan}</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-600 mb-2">Người nộp tiền</p>
                <p className="text-gray-400 text-sm">(Ký, ghi rõ họ tên)</p>
                <div className="h-24 border-b border-gray-300 mt-4 relative">
                  {/* Show signature canvas or existing signature */}
                  {!isSigned && (
                    <SignatureCanvas
                      ref={sigCanvas}
                      canvasProps={{
                        className: 'absolute inset-0 w-full h-full',
                      }}
                      backgroundColor="transparent"
                    />
                  )}
                  {isSigned && receipt.signaturePoints && (
                    <SignatureCanvas
                      ref={sigCanvas}
                      canvasProps={{
                        className: 'absolute inset-0 w-full h-full pointer-events-none',
                      }}
                      backgroundColor="transparent"
                    />
                  )}
                </div>
                <p className="mt-2 text-gray-700">{receipt.info.hoTenNguoiGui}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-gray-400 text-xs">
              Mã biên lai: {receipt.id} | Tạo lúc: {new Date(receipt.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isSigned && (
        <div className="max-w-3xl mx-auto">
          <div className="glass-dark rounded-xl p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400">
                <PenTool className="w-4 h-4" />
                <span className="text-sm">Ký vào ô phía trên, sau đó nhấn Hoàn tất & Gửi</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearSignature}
                  className="px-4 py-2 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Xóa chữ ký
                </button>
                <button
                  onClick={handleSign}
                  disabled={signing || sending}
                  className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang ký...
                    </>
                  ) : sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Hoàn tất & Gửi
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSigned && (
        <div className="max-w-3xl mx-auto">
          <div className="glass-dark rounded-xl p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 text-green-400">
                <Check className="w-4 h-4" />
                <span className="text-sm">Biên lai đã được ký xác nhận</span>
              </div>
              <button
                onClick={handleDownload}
                className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Tải PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
