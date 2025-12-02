'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { FileDown, PenLine, RotateCcw, Loader2, CheckCircle2, AlertCircle, Send, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureModal from './SignatureModal';
import { ShareableReceiptData } from '@/lib/url-utils';
import { getReceiptById } from '@/lib/storage';
import { formatNumber, cn } from '@/lib/utils';

interface ReceiptViewProps {
  data: ShareableReceiptData;
}

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';
type SendStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ReceiptView({ data }: ReceiptViewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [signature, setSignature] = useState<string>(data.signatureNguoiGui || '');
  const [adminSignature, setAdminSignature] = useState<string>(data.signatureNguoiNhan || '');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [hasSigned, setHasSigned] = useState(!!data.signatureNguoiGui);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [hasSent, setHasSent] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

  useEffect(() => {
    if (data.receiptId && !data.signatureNguoiNhan) {
      const fullReceipt = getReceiptById(data.receiptId);
      if (fullReceipt?.signatureNguoiNhan) {
        setAdminSignature(fullReceipt.signatureNguoiNhan);
      }
    }
  }, [data.receiptId, data.signatureNguoiNhan]);

  const handleSignatureApply = (sig: string) => {
    setSignature(sig);
    setHasSigned(true);
  };

  const captureReceiptImage = useCallback(async (): Promise<string | null> => {
    if (!receiptRef.current) return null;

    try {
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
        }
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error capturing receipt image:', error);
      return null;
    }
  }, []);

  const handleSendReceipt = async () => {
    if (!hasSigned || sendStatus === 'loading') return;

    setSendStatus('loading');
    setSendMessage('');

    try {
      const imageBase64 = await captureReceiptImage();
      if (!imageBase64) {
        throw new Error('Không thể chụp ảnh biên nhận');
      }

      const response = await fetch('/api/send-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiptData: {
            ...data,
            signatureNguoiGui: signature,
          },
          imageBase64,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gửi thất bại');
      }

      setSendStatus('success');
      setHasSent(true);
      setSendMessage('Đã gửi thành công!');
      setTimeout(() => setSendStatus('idle'), 3000);
    } catch (error) {
      console.error('Error sending receipt:', error);
      setSendStatus('error');
      setSendMessage(error instanceof Error ? error.message : 'Có lỗi khi gửi');
      setTimeout(() => setSendStatus('idle'), 3000);
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
        {/* Header for signer */}
        <div className="glass-card rounded-2xl p-5 mb-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-black/90 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Biên nhận tiền</h2>
          <p className="text-gray-500 text-sm mt-1">
            Vui lòng xem xét thông tin và ký xác nhận bên dưới
          </p>
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

          {/* Body - Read Only */}
          <div className="space-y-5 text-base leading-relaxed">
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người nhận:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {data.hoTenNguoiNhan || 'N/A'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người nhận:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {data.donViNguoiNhan || 'N/A'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Họ và tên người gửi:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {data.hoTenNguoiGui || 'N/A'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Đơn vị người gửi:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {data.donViNguoiGui || 'N/A'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Lý do nộp:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {data.lyDoNop || 'N/A'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Số tiền:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1">
                {data.soTien > 0 ? formatNumber(data.soTien) : 'N/A'}
              </span>
              <span className="whitespace-nowrap">VNĐ</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">Bằng chữ:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 italic text-gray-700">
                {data.bangChu || 'N/A'}
              </span>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-16">
            <div className="text-right italic mb-10">
              <span>{data.diaDiem}, </span>
              <span>{data.ngayThang}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center">
              {/* Người gửi tiền - Can Sign */}
              <div>
                <p className="font-bold mb-2">Người gửi tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signature ? (
                    <div className="relative group">
                      <img 
                        src={signature} 
                        alt="Chữ ký" 
                        className="h-16 w-auto object-contain" 
                        style={{ imageRendering: 'auto', minWidth: '80px' }}
                      />
                      <button
                        onClick={() => {
                          setSignature('');
                          setHasSigned(false);
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        title="Ký lại"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-gray-400 rounded-xl text-gray-600 hover:border-gray-600 hover:bg-gray-50 transition-colors print:hidden font-medium"
                    >
                      <PenLine className="w-5 h-5" />
                      Ký xác nhận
                    </button>
                  )}
                </div>

                <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {data.hoTenNguoiGui || '...........................'}
                </p>
              </div>

              {/* Người nhận tiền - Read Only */}
              <div>
                <p className="font-bold mb-2">Người nhận tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {adminSignature ? (
                    <img 
                      src={adminSignature} 
                      alt="Chữ ký người nhận" 
                      className="h-16 w-auto object-contain"
                      style={{ imageRendering: 'auto', minWidth: '80px' }}
                    />
                  ) : (
                    <span className="text-gray-400 italic">Chưa ký</span>
                  )}
                </div>

                <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {data.hoTenNguoiNhan || '...........................'}
                </p>
              </div>
            </div>
          </footer>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center mt-6">
          {!hasSigned && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 glass-button rounded-xl font-medium"
            >
              <PenLine className="w-5 h-5" />
              Ký xác nhận
            </button>
          )}
          
          {hasSigned && !hasSent && (
            <button
              onClick={handleSendReceipt}
              disabled={sendStatus === 'loading'}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                sendStatus === 'success' 
                  ? 'bg-green-600 text-white' 
                  : sendStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'glass-button',
                sendStatus === 'loading' && 'opacity-75 cursor-not-allowed'
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
          
          {hasSigned && hasSent && (
            <button
              onClick={handleExportPDF}
              disabled={exportStatus === 'loading'}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                exportStatus === 'success' 
                  ? 'bg-green-600 text-white' 
                  : exportStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'glass-button',
                exportStatus === 'loading' && 'opacity-75 cursor-not-allowed'
              )}
            >
              {getButtonContent(exportStatus, 'Tải PDF', FileDown)}
            </button>
          )}
        </div>

        {!hasSigned && (
          <p className="text-center text-gray-500 text-sm mt-4">
            Vui lòng ký xác nhận để có thể gửi và tải PDF
          </p>
        )}

        {hasSigned && !hasSent && (
          <p className="text-center text-amber-600 text-sm mt-4 font-medium">
            Vui lòng bấm "Hoàn tất & Gửi" để xác nhận biên nhận
          </p>
        )}

        {sendMessage && (
          <p className={cn(
            'text-center text-sm mt-4 font-medium',
            sendStatus === 'success' ? 'text-green-600' : 'text-red-600'
          )}>
            {sendMessage}
          </p>
        )}

        {hasSent && (
          <div className="glass-card rounded-2xl p-5 mt-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-gray-900 font-semibold">Biên nhận đã được gửi thành công!</p>
            <p className="text-gray-500 text-sm mt-1">Bạn có thể tải PDF để lưu giữ.</p>
          </div>
        )}
      </div>

      <SignatureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApply={handleSignatureApply}
      />
    </div>
  );
}
